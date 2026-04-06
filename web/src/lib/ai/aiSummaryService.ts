/**
 * AI summary service.
 *
 * Generates grounded, factual narratives from structured stored signals.
 *
 * Critical constraint: the narrative ONLY references facts from the provided
 * structured data. It never invents market information.
 * If data is sparse, it says so explicitly.
 *
 * The narrative is explanatory only — the rules engine remains the decision source.
 */

import { callAI } from './aiClient'
import type { ExtractedSignal } from './aiSchemas'
import type { PricingRecommendation, SentimentScore } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketNarrativeResult {
  available: boolean
  marketSummary: string
  recommendationExplanation: string | null
  bullishFactors: string[]
  bearishFactors: string[]
  watchouts: string[]
  model?: string
  error?: string
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a commercial analyst for a pulp and paper trading company.
Generate concise, factual market summaries for a sales director audience.

Rules:
- ONLY reference facts present in the provided structured data
- If data is sparse or absent, state that explicitly — do not invent market conditions
- Never claim a price direction unless a signal explicitly supports it
- Write in direct commercial language — no filler, no hedging waffle
- Return ONLY valid JSON, no markdown, no other text`

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateMarketNarrative(
  marketName: string,
  sentimentScore: SentimentScore,
  recentSignals: ExtractedSignal[],
  recommendation: PricingRecommendation | null,
): Promise<MarketNarrativeResult> {
  // Sparse-data fast path — no AI call needed
  if (recentSignals.length === 0) {
    return {
      available: true,
      marketSummary: `No AI-analyzed texts available for ${marketName} yet. Add meeting notes, market news, or expert report excerpts and analyze them to generate AI market intelligence.`,
      recommendationExplanation: null,
      bullishFactors: [],
      bearishFactors: [],
      watchouts: ['No reviewed AI signals available — add and analyze text sources first'],
    }
  }

  // Build compact signal summary (max 6 most recent)
  const signalSummary = recentSignals.slice(0, 6).map(s => ({
    type: s.source_type,
    sentiment: s.sentiment,
    confidence: s.sentiment_confidence,
    demand: s.demand_signal,
    supply: s.supply_signal,
    price_pressure: s.price_pressure_signal,
    themes: s.key_themes,
    risks: s.risks.slice(0, 3),
    opportunities: s.opportunities.slice(0, 3),
    competitor_actions: s.competitor_action_signal.slice(0, 3),
    summary: s.summary_short,
    ambiguities: s.ambiguity_flags.slice(0, 2),
  }))

  const prompt = `Generate a market intelligence summary for ${marketName}.

COMPOSITE SENTIMENT: ${sentimentScore.overall} (weighted score: ${sentimentScore.score.toFixed(2)})
Source breakdown — News: ${sentimentScore.sources.news.toFixed(2)}, Expert: ${sentimentScore.sources.expert.toFixed(2)}, Field notes: ${sentimentScore.sources.meetingNotes.toFixed(2)}

REVIEWED AI SIGNALS (${recentSignals.length} records):
${JSON.stringify(signalSummary, null, 2)}

${recommendation ? `RULES-BASED RECOMMENDATION (do not override — explain only):
- Recommended band: ${recommendation.priceband.toUpperCase()} ($${recommendation.priceLow}–$${recommendation.priceHigh}/ton, mid: $${recommendation.priceMid})
- Confidence: ${recommendation.confidenceScore}/100
- Top drivers: ${recommendation.topDrivers.slice(0, 4).join(' | ')}
- Risk flags: ${recommendation.riskFlags.slice(0, 3).join(' | ')}` : 'No recommendation data available.'}

Return exactly this JSON (no other text):
{
  "market_summary": "<2-3 sentence overview of current conditions based ONLY on the data above>",
  "recommendation_explanation": <"<1-2 sentence natural-language explanation of why the rules engine reached its recommendation>" or null if no recommendation>,
  "bullish_factors": ["<up to 4 bullish factors drawn directly from the signals above>"],
  "bearish_factors": ["<up to 4 bearish factors drawn directly from the signals above>"],
  "watchouts": ["<up to 3 key watchpoints or ambiguities>"]
}`

  const result = await callAI(SYSTEM_PROMPT, prompt, 2048)

  if (!result.available) {
    return {
      available: false,
      marketSummary: '',
      recommendationExplanation: null,
      bullishFactors: [],
      bearishFactors: [],
      watchouts: [],
      error: result.error || 'AI service unavailable',
      model: result.model,
    }
  }

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    const raw = jsonMatch ? jsonMatch[0] : result.content
    const parsed = JSON.parse(raw)

    return {
      available: true,
      marketSummary: typeof parsed.market_summary === 'string' ? parsed.market_summary : '',
      recommendationExplanation: typeof parsed.recommendation_explanation === 'string'
        ? parsed.recommendation_explanation
        : null,
      bullishFactors: Array.isArray(parsed.bullish_factors) ? parsed.bullish_factors : [],
      bearishFactors: Array.isArray(parsed.bearish_factors) ? parsed.bearish_factors : [],
      watchouts: Array.isArray(parsed.watchouts) ? parsed.watchouts : [],
      model: result.model,
    }
  } catch {
    return {
      available: false,
      marketSummary: '',
      recommendationExplanation: null,
      bullishFactors: [],
      bearishFactors: [],
      watchouts: [],
      error: 'Failed to parse AI narrative response',
      model: result.model,
    }
  }
}

// ─── Derive AI pricing signals from reviewed analyzed texts ───────────────────
// Used by the pricing engine — aggregates reviewed AI records into one signal set.

import type { AISignalsInput } from './aiSchemas'

export function deriveAISignalsFromReviewed(signals: ExtractedSignal[]): AISignalsInput {
  if (signals.length === 0) {
    return {
      sentimentBias: null,
      sentimentConfidence: 0,
      pricePressureSignal: 'unclear',
      demandSignal: 'unclear',
      supplySignal: 'unclear',
      competitorActionFlags: [],
      hasPriceResistanceEvidence: false,
      hasCompetitorIncreaseEvidence: false,
      totalAmbiguityFlags: 0,
      explanationLines: [],
      reviewedRecordCount: 0,
    }
  }

  // Sentiment majority vote
  const sentiments = signals.map(s => s.sentiment)
  const bullishCount = sentiments.filter(s => s === 'bullish').length
  const bearishCount = sentiments.filter(s => s === 'bearish').length
  const neutralCount = sentiments.filter(s => s === 'neutral').length

  let sentimentBias: 'bullish' | 'neutral' | 'bearish' | null = null
  if (bullishCount > bearishCount && bullishCount > neutralCount) sentimentBias = 'bullish'
  else if (bearishCount > bullishCount && bearishCount > neutralCount) sentimentBias = 'bearish'
  else sentimentBias = 'neutral'

  const avgConfidence = Math.round(
    signals.reduce((s, x) => s + x.sentiment_confidence, 0) / signals.length,
  )

  // Price pressure majority
  const pressures = signals.map(s => s.price_pressure_signal)
  const upward = pressures.filter(p => p === 'upward').length
  const downward = pressures.filter(p => p === 'downward').length
  const flat = pressures.filter(p => p === 'flat').length
  let pricePressureSignal: AISignalsInput['pricePressureSignal'] = 'unclear'
  if (upward >= downward && upward >= flat && upward > 0) pricePressureSignal = 'upward'
  else if (downward > upward && downward >= flat && downward > 0) pricePressureSignal = 'downward'
  else if (flat > 0) pricePressureSignal = 'flat'

  // Demand signal majority
  const demands = signals.map(s => s.demand_signal)
  const stronger = demands.filter(d => d === 'stronger').length
  const weaker = demands.filter(d => d === 'weaker').length
  let demandSignal: AISignalsInput['demandSignal'] = 'unclear'
  if (stronger > weaker && stronger > 0) demandSignal = 'stronger'
  else if (weaker > stronger && weaker > 0) demandSignal = 'weaker'
  else if (demands.filter(d => d === 'unchanged').length > 0) demandSignal = 'unchanged'

  // Supply signal majority
  const supplies = signals.map(s => s.supply_signal)
  const tighter = supplies.filter(s => s === 'tighter').length
  const looser = supplies.filter(s => s === 'looser').length
  let supplySignal: AISignalsInput['supplySignal'] = 'unclear'
  if (tighter > looser && tighter > 0) supplySignal = 'tighter'
  else if (looser > tighter && looser > 0) supplySignal = 'looser'
  else if (supplies.filter(s => s === 'unchanged').length > 0) supplySignal = 'unchanged'

  // Competitor actions — flatten and deduplicate
  const competitorActionFlags = [
    ...new Set(signals.flatMap(s => s.competitor_action_signal)),
  ].slice(0, 6)

  // Evidence flags from competitor action text
  const allActionText = competitorActionFlags.join(' ').toLowerCase()
  const hasCompetitorIncreaseEvidence =
    allActionText.includes('increas') ||
    allActionText.includes('hike') ||
    allActionText.includes('rais') ||
    signals.some(s => s.price_pressure_signal === 'upward' && s.competitors_mentioned.length > 0)

  // Price resistance from bearish signals with downward pressure
  const hasPriceResistanceEvidence =
    signals.some(
      s =>
        s.price_pressure_signal === 'downward' &&
        (s.sentiment === 'bearish' || s.risks.some(r => r.toLowerCase().includes('resist'))),
    ) ||
    signals.some(s => s.key_themes.some(t => t.toLowerCase().includes('resistance')))

  // Ambiguity total
  const totalAmbiguityFlags = signals.reduce((n, s) => n + s.ambiguity_flags.length, 0)

  // Build explanation lines for the pricing engine trace
  const explanationLines: string[] = []

  if (sentimentBias !== 'neutral' && sentimentBias !== null) {
    explanationLines.push(
      `AI analysis of ${signals.length} reviewed ${signals.length === 1 ? 'text' : 'texts'} indicates ${sentimentBias} commercial sentiment (avg confidence: ${avgConfidence}%)`,
    )
  }
  if (pricePressureSignal !== 'unclear') {
    explanationLines.push(
      `AI-interpreted price pressure signal: ${pricePressureSignal} (from ${pressures.filter(p => p === pricePressureSignal).length}/${signals.length} sources)`,
    )
  }
  if (hasCompetitorIncreaseEvidence) {
    explanationLines.push(
      'AI detected competitor price increase language — supporting upward pricing bias',
    )
  }
  if (hasPriceResistanceEvidence) {
    explanationLines.push(
      'AI analysis indicates customer price resistance evidence — high band constrained',
    )
  }
  if (totalAmbiguityFlags > 3) {
    explanationLines.push(
      `AI flagged ${totalAmbiguityFlags} ambiguities across analyzed texts — confidence reduced`,
    )
  }
  if (demandSignal !== 'unclear') {
    explanationLines.push(`AI demand signal: ${demandSignal}`)
  }
  if (supplySignal !== 'unclear') {
    explanationLines.push(`AI supply signal: ${supplySignal}`)
  }

  return {
    sentimentBias,
    sentimentConfidence: avgConfidence,
    pricePressureSignal,
    demandSignal,
    supplySignal,
    competitorActionFlags,
    hasPriceResistanceEvidence,
    hasCompetitorIncreaseEvidence,
    totalAmbiguityFlags,
    explanationLines,
    reviewedRecordCount: signals.length,
  }
}
