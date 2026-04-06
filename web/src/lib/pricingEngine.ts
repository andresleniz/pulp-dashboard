import type {
  Order, CompetitorPrice, ExpertInsight,
  SentimentScore, MeetingNote, PricingRecommendation,
} from '@/types'
import type { AISignalsInput } from '@/lib/ai/aiSchemas'
import { subDays, parseISO } from 'date-fns'

// year*12+month — comparable integer for month arithmetic
function toYM(year: number, month: number): number { return year * 12 + month }

export interface PricingEngineInputs {
  marketId: number
  gradeId: number
  gradeName: string
  recentOrders: Order[]
  competitorPrices: CompetitorPrice[]
  expertInsights: ExpertInsight[]
  sentimentScore: SentimentScore
  meetingNotes: MeetingNote[]
  chinaBaselinePrice?: number
  referenceDate?: Date  // use mock-pinned date in demo mode; defaults to real current date
  // Optional AI-derived signals from reviewed analyzed texts.
  // AI does NOT set prices. These are secondary signals that adjust the band
  // and confidence, always with explicit explanation lines in the trace.
  aiSignals?: AISignalsInput
}

export function computePricingRecommendation(inputs: PricingEngineInputs): PricingRecommendation {
  const {
    marketId, gradeId, gradeName, recentOrders, competitorPrices,
    expertInsights, sentimentScore, meetingNotes, chinaBaselinePrice,
    referenceDate, aiSignals,
  } = inputs

  const now = referenceDate ?? new Date()
  const drivers: string[] = []
  const risks: string[] = []

  // ─────────────────────────────────────────────────────────
  // STEP 1: Net price baselines — last month, prior month, last 3 months
  // Uses year+month arithmetic — immune to day-of-month drift
  // ─────────────────────────────────────────────────────────
  const cutoff30 = subDays(now, 30) // kept for competitor prices / meeting notes (date-only)
  const refYM    = toYM(now.getFullYear(), now.getMonth() + 1)

  const last30Orders = recentOrders.filter(o => toYM(o.year, o.month) >= refYM - 1)
  const prev30Orders = recentOrders.filter(o => {
    const ym = toYM(o.year, o.month)
    return ym >= refYM - 2 && ym < refYM - 1
  })
  const last90Orders = recentOrders.filter(o => toYM(o.year, o.month) >= refYM - 3)

  // Avg net price last 30 days (fall back to 90-day avg if no recent orders)
  const avgLast30 = last30Orders.length > 0
    ? last30Orders.reduce((s, o) => s + o.net_price, 0) / last30Orders.length
    : last90Orders.length > 0
      ? last90Orders.reduce((s, o) => s + o.net_price, 0) / last90Orders.length
      : 1000 // absolute fallback

  const avgPrev30 = prev30Orders.length > 0
    ? prev30Orders.reduce((s, o) => s + o.net_price, 0) / prev30Orders.length
    : null

  // Net price trend driver
  if (avgPrev30 !== null) {
    const trendPct = ((avgLast30 - avgPrev30) / avgPrev30) * 100
    if (trendPct > 1) {
      drivers.push(`Net price trending UP +${trendPct.toFixed(1)}% vs prior 30 days ($${avgPrev30.toFixed(0)} → $${avgLast30.toFixed(0)})`)
    } else if (trendPct < -1) {
      risks.push(`Net price trending DOWN ${trendPct.toFixed(1)}% vs prior 30 days ($${avgPrev30.toFixed(0)} → $${avgLast30.toFixed(0)})`)
    } else {
      drivers.push(`Net price stable at ~$${avgLast30.toFixed(0)}/ton (±1% vs prior month)`)
    }
  } else {
    drivers.push(`Our avg net price (last 30d): $${avgLast30.toFixed(0)}/ton`)
  }

  // ─────────────────────────────────────────────────────────
  // STEP 2: Competitor price — grade-specific, last 30 days
  // ─────────────────────────────────────────────────────────
  const recentCompPrices = competitorPrices.filter(
    cp => cp.market_id === marketId && cp.grade_id === gradeId && parseISO(cp.date) >= cutoff30
  )
  const avgCompPrice = recentCompPrices.length > 0
    ? recentCompPrices.reduce((s, cp) => s + cp.price, 0) / recentCompPrices.length
    : null

  if (avgCompPrice !== null) {
    const spreadVsComp = avgLast30 - avgCompPrice
    if (spreadVsComp > 20) {
      risks.push(`Our price $${spreadVsComp.toFixed(0)} ABOVE competitor avg ($${avgCompPrice.toFixed(0)}) — volume risk`)
    } else if (spreadVsComp < -20) {
      drivers.push(`Our price $${Math.abs(spreadVsComp).toFixed(0)} BELOW competitor avg ($${avgCompPrice.toFixed(0)}) — room to increase`)
    } else {
      drivers.push(`Competitor avg price: $${avgCompPrice.toFixed(0)}/ton (spread: ${spreadVsComp >= 0 ? '+' : ''}${spreadVsComp.toFixed(0)})`)
    }
  }

  // ─────────────────────────────────────────────────────────
  // STEP 3: Baseline = avg(our price, competitor price if available)
  // Formula: baseline = (avgLast30 + avgCompPrice) / 2  OR  avgLast30
  // ─────────────────────────────────────────────────────────
  let baseline = avgCompPrice !== null
    ? (avgLast30 + avgCompPrice) / 2
    : avgLast30

  // ─────────────────────────────────────────────────────────
  // STEP 4: Sentiment adjustment (±2–4% range)
  // ─────────────────────────────────────────────────────────
  let sentAdj = 0
  const sentMagnitude = 0.02 + Math.min(Math.abs(sentimentScore.score), 0.8) * 0.025
  if (sentimentScore.overall === 'bullish') {
    sentAdj = baseline * sentMagnitude
    drivers.push(`Bullish composite sentiment (score: ${sentimentScore.score.toFixed(2)}) → +${(sentAdj / baseline * 100).toFixed(1)}%`)
  } else if (sentimentScore.overall === 'bearish') {
    sentAdj = -baseline * sentMagnitude
    risks.push(`Bearish composite sentiment (score: ${sentimentScore.score.toFixed(2)}) → ${(sentAdj / baseline * 100).toFixed(1)}%`)
  }
  baseline += sentAdj

  // ─────────────────────────────────────────────────────────
  // STEP 5: Expert forecast range constraints
  // ─────────────────────────────────────────────────────────
  const relevantInsights = expertInsights.filter(
    ei => ei.market_id === marketId && ei.grade_id === gradeId
  )

  if (relevantInsights.length > 0) {
    const avgLow = relevantInsights.reduce((s, ei) => s + ei.price_forecast_low, 0) / relevantInsights.length
    const avgHigh = relevantInsights.reduce((s, ei) => s + ei.price_forecast_high, 0) / relevantInsights.length

    if (baseline < avgLow) {
      const push = (avgLow - baseline) * 0.5 // push halfway toward floor
      baseline += push
      drivers.push(`Price below expert range floor ($${avgLow.toFixed(0)}) — adjusted up +$${push.toFixed(0)}`)
    } else if (baseline > avgHigh) {
      const pull = (baseline - avgHigh) * 0.5 // pull halfway toward ceiling
      baseline -= pull
      risks.push(`Price above expert ceiling ($${avgHigh.toFixed(0)}) — constrained by -$${pull.toFixed(0)}`)
    } else {
      drivers.push(`Within expert forecast band: $${avgLow.toFixed(0)}–$${avgHigh.toFixed(0)}/ton`)
    }
  }

  // ─────────────────────────────────────────────────────────
  // STEP 6: Volume trend — reduce aggressiveness if declining
  // ─────────────────────────────────────────────────────────
  const vol30 = last30Orders.reduce((s, o) => s + o.volume, 0)
  const vol30to60 = prev30Orders.reduce((s, o) => s + o.volume, 0)

  if (vol30to60 > 0) {
    const volumeTrendPct = ((vol30 - vol30to60) / vol30to60) * 100
    if (volumeTrendPct < -10) {
      const pull = baseline * 0.01
      baseline -= pull
      risks.push(`Volume declining ${volumeTrendPct.toFixed(1)}% month-over-month — reduced price aggressiveness`)
    } else if (volumeTrendPct > 10) {
      drivers.push(`Volume growing ${volumeTrendPct.toFixed(1)}% month-over-month — supports pricing power`)
    }
  }

  // ─────────────────────────────────────────────────────────
  // STEP 7: China benchmark pressure (non-China markets only)
  // ─────────────────────────────────────────────────────────
  if (chinaBaselinePrice && chinaBaselinePrice > baseline) {
    const spread = chinaBaselinePrice - baseline
    const pressure = spread * 0.3 // absorb 30% of China premium
    baseline += pressure
    drivers.push(`China benchmark ($${chinaBaselinePrice.toFixed(0)}) above current — upward pressure +$${pressure.toFixed(0)}`)
  } else if (chinaBaselinePrice && chinaBaselinePrice < baseline * 0.97) {
    risks.push(`China benchmark ($${chinaBaselinePrice.toFixed(0)}) significantly below — may constrain increases`)
  }

  // ─────────────────────────────────────────────────────────
  // STEP 8: Meeting notes override layer (last 7 days)
  // ─────────────────────────────────────────────────────────
  const last7Days = subDays(now, 7)
  const recentNotes = meetingNotes.filter(mn => parseISO(mn.date) >= last7Days)
  const bullishNotes = recentNotes.filter(mn => mn.extracted_sentiment === 'bullish')
  const bearishNotes = recentNotes.filter(mn => mn.extracted_sentiment === 'bearish')

  let meetingConflict = false

  if (bullishNotes.length > bearishNotes.length) {
    baseline += baseline * 0.01
    drivers.push(`Recent bullish field intelligence (${bullishNotes.length} of ${recentNotes.length} notes in last 7d)`)
    // Conflict: bullish notes but model/market is bearish
    if (sentimentScore.overall === 'bearish') {
      meetingConflict = true
    }
  } else if (bearishNotes.length > bullishNotes.length) {
    baseline -= baseline * 0.01
    risks.push(`Recent bearish field intelligence (${bearishNotes.length} of ${recentNotes.length} notes in last 7d)`)
    // Conflict: bearish notes but model/market is bullish
    if (sentimentScore.overall === 'bullish') {
      meetingConflict = true
    }
  }

  // Signal-level adjustments from ALL meeting notes (not just last 7d)
  const allSignals = meetingNotes.flatMap(mn => mn.extracted_signals)
  const hasPriceResistance = allSignals.includes('price_resistance')
  const hasCompetitorIncreasing = allSignals.includes('competitor_increasing')
  const hasTightSupply = allSignals.includes('tight_supply')

  // ─────────────────────────────────────────────────────────
  // STEP 9: Price band construction (±3% around midpoint)
  // ─────────────────────────────────────────────────────────
  let priceLow = baseline * 0.97
  let priceMid = baseline
  let priceHigh = baseline * 1.03

  if (hasPriceResistance) {
    priceHigh *= 0.98
    risks.push('Price resistance in field notes — high band constrained -2%')
  }
  if (hasCompetitorIncreasing) {
    priceLow *= 1.02
    drivers.push('Competitor price increases confirmed — floor raised +2%')
  }
  if (hasTightSupply) {
    priceLow *= 1.015
    priceMid *= 1.015
    priceHigh *= 1.015
    drivers.push('Tight supply conditions — full band lifted +1.5%')
  }

  // ─────────────────────────────────────────────────────────
  // STEP 9b: AI-derived signal adjustments (secondary influence only)
  //
  // Rules:
  //   - AI does not set final prices. Period.
  //   - AI contributes band adjustments of ≤2% per signal, capped total
  //   - Every adjustment is logged in drivers/risks for full traceability
  //   - High ambiguity or low confidence reduces impact to zero
  //   - AI signals only apply when reviewedRecordCount > 0
  // ─────────────────────────────────────────────────────────
  if (aiSignals && aiSignals.reviewedRecordCount > 0) {
    const aiConfidenceFactor = Math.min(aiSignals.sentimentConfidence / 100, 1)
    const hasHighAmbiguity = aiSignals.totalAmbiguityFlags > 4

    // Price pressure — upward/downward from AI interpretation
    if (
      aiSignals.pricePressureSignal === 'upward' &&
      !hasHighAmbiguity &&
      aiConfidenceFactor > 0.4
    ) {
      const boost = baseline * 0.01 * aiConfidenceFactor
      priceLow += boost
      priceMid += boost
      drivers.push(
        `AI-interpreted field intelligence suggests upward price pressure (${aiSignals.reviewedRecordCount} reviewed ${aiSignals.reviewedRecordCount === 1 ? 'source' : 'sources'}, confidence: ${aiSignals.sentimentConfidence}%) → +$${boost.toFixed(0)} band lift`,
      )
    } else if (
      aiSignals.pricePressureSignal === 'downward' &&
      !hasHighAmbiguity &&
      aiConfidenceFactor > 0.4
    ) {
      const pull = baseline * 0.01 * aiConfidenceFactor
      priceHigh -= pull
      priceMid -= pull
      risks.push(
        `AI analysis of expert excerpt suggests downward price pressure (${aiSignals.reviewedRecordCount} reviewed ${aiSignals.reviewedRecordCount === 1 ? 'source' : 'sources'}, confidence: ${aiSignals.sentimentConfidence}%) → -$${pull.toFixed(0)} band constraint`,
      )
    }

    // Competitor increase evidence from AI text analysis
    if (aiSignals.hasCompetitorIncreaseEvidence && !hasPriceResistance) {
      priceLow *= 1.01
      drivers.push('AI detected competitor increase language, supporting upward pricing bias')
    }

    // AI price resistance evidence
    if (aiSignals.hasPriceResistanceEvidence) {
      priceHigh *= 0.99
      risks.push('AI analysis of recent meeting notes indicates high customer resistance — high band constrained')
    }

    // Add all AI explanation lines to drivers (already filtered in aiSummaryService)
    for (const line of aiSignals.explanationLines) {
      if (
        !line.includes('upward') &&
        !line.includes('downward') &&
        !line.includes('competitor') &&
        !line.includes('resistance')
      ) {
        drivers.push(line)
      }
    }

    // High ambiguity warning
    if (hasHighAmbiguity) {
      risks.push(
        `AI flagged ${aiSignals.totalAmbiguityFlags} ambiguities across analyzed texts — interpret with caution`,
      )
    }
  }

  // ─────────────────────────────────────────────────────────
  // STEP 10: Confidence score
  // Base: 30 (minimal), max achievable: 100
  // +15 if orders exist (we have own price data)
  // +5  if recent orders within 30d (fresh data)
  // +20 if competitor prices available
  // +20 if expert forecast available
  // +10 if signals consistent across sources
  // -15 if field notes conflict with model direction
  // +5  if AI signals consistent with model direction (reviewed records)
  // -10 if AI ambiguity is high
  // ─────────────────────────────────────────────────────────
  let confidence = 30

  if (recentOrders.length > 0) confidence += 15
  if (last30Orders.length > 0) confidence += 5
  if (recentCompPrices.length > 0) confidence += 20
  if (relevantInsights.length > 0) confidence += 20

  // Signal consistency: all three sentiment sources agree
  const sourceSentiments = [
    sentimentScore.sources.news > 0.1 ? 'bullish' : sentimentScore.sources.news < -0.1 ? 'bearish' : 'neutral',
    sentimentScore.sources.expert > 0.1 ? 'bullish' : sentimentScore.sources.expert < -0.1 ? 'bearish' : 'neutral',
    sentimentScore.sources.meetingNotes > 0.1 ? 'bullish' : sentimentScore.sources.meetingNotes < -0.1 ? 'bearish' : 'neutral',
  ]
  if (new Set(sourceSentiments).size === 1) confidence += 10

  if (meetingConflict) {
    confidence -= 15
    risks.push('Field intelligence contradicts pricing model direction — confidence reduced')
  }

  // AI confidence adjustments — transparent, bounded
  if (aiSignals && aiSignals.reviewedRecordCount > 0) {
    const aiAligned =
      (sentimentScore.overall === 'bullish' && aiSignals.sentimentBias === 'bullish') ||
      (sentimentScore.overall === 'bearish' && aiSignals.sentimentBias === 'bearish') ||
      (sentimentScore.overall === 'neutral' && aiSignals.sentimentBias === 'neutral')
    if (aiAligned) {
      confidence += 5
    }
    if (aiSignals.totalAmbiguityFlags > 4) {
      confidence -= 10
    }
  }

  confidence = Math.max(0, Math.min(100, confidence))

  // ─────────────────────────────────────────────────────────
  // STEP 11: Volume/margin impact estimates
  // Elasticity: -0.5 (standard pulp demand elasticity)
  // ─────────────────────────────────────────────────────────
  const priceDiffPct = avgLast30 > 0 ? ((priceMid - avgLast30) / avgLast30) * 100 : 0
  const expectedVolumeImpact = priceDiffPct * -0.5
  const expectedMarginImpact = priceDiffPct * 0.7

  // ─────────────────────────────────────────────────────────
  // STEP 12: Priceband recommendation
  // Based on: where priceMid sits vs current + sentiment + confidence
  // ─────────────────────────────────────────────────────────
  const priceChangeFromCurrent = avgLast30 > 0 ? (priceMid - avgLast30) / avgLast30 : 0
  let priceband: 'low' | 'mid' | 'high' = 'mid'

  if (priceChangeFromCurrent > 0.015 && sentimentScore.overall !== 'bearish' && confidence >= 50) {
    priceband = 'high'
  } else if (priceChangeFromCurrent < -0.015 || sentimentScore.overall === 'bearish' || confidence < 40) {
    priceband = 'low'
  }
  // Strong bullish consensus overrides low confidence threshold
  if (sentimentScore.overall === 'bullish' && confidence >= 65 && priceChangeFromCurrent >= 0) {
    priceband = 'high'
  }

  // ─────────────────────────────────────────────────────────
  // STEP 13: Reasoning (explicit formula path)
  // ─────────────────────────────────────────────────────────
  const formulaSteps = [
    `Baseline: ${avgCompPrice !== null ? `avg(our $${avgLast30.toFixed(0)}, comp $${avgCompPrice.toFixed(0)}) = $${((avgLast30 + avgCompPrice) / 2).toFixed(0)}` : `our avg $${avgLast30.toFixed(0)} (no competitor data)`}`,
    sentAdj !== 0 ? `Sentiment adj: ${sentAdj > 0 ? '+' : ''}$${sentAdj.toFixed(0)} (${sentimentScore.overall})` : 'Sentiment adj: $0 (neutral)',
    relevantInsights.length > 0 ? `Expert constraint: applied` : 'Expert constraint: none (no data)',
    chinaBaselinePrice ? `China benchmark: applied` : 'China benchmark: n/a',
    meetingConflict ? `⚠ Field intelligence conflict detected` : '',
  ].filter(Boolean)

  const aiReasoningNote = aiSignals && aiSignals.reviewedRecordCount > 0
    ? ` AI signals: ${aiSignals.reviewedRecordCount} reviewed ${aiSignals.reviewedRecordCount === 1 ? 'text' : 'texts'} (bias: ${aiSignals.sentimentBias ?? 'none'}, pressure: ${aiSignals.pricePressureSignal}).`
    : ' AI signals: none (no reviewed texts or AI not configured).'

  const reasoning =
    `Formula: ${formulaSteps.join(' → ')}. ` +
    `Orders used: ${recentOrders.length} (30d: ${last30Orders.length}). ` +
    `Competitor data points: ${recentCompPrices.length}. ` +
    `Expert forecasts: ${relevantInsights.length}. ` +
    `Sentiment: ${sentimentScore.overall} (${sentimentScore.score.toFixed(2)}).` +
    aiReasoningNote +
    ` Recommended band: ${priceband.toUpperCase()}.`

  return {
    marketId,
    gradeId,
    gradeName,
    priceLow: Math.round(priceLow * 100) / 100,
    priceMid: Math.round(priceMid * 100) / 100,
    priceHigh: Math.round(priceHigh * 100) / 100,
    currentAvgPrice: Math.round(avgLast30 * 100) / 100,
    confidenceScore: confidence,
    expectedVolumeImpact: Math.round(expectedVolumeImpact * 10) / 10,
    expectedMarginImpact: Math.round(expectedMarginImpact * 10) / 10,
    topDrivers: drivers,
    riskFlags: risks,
    priceband,
    reasoning,
  }
}
