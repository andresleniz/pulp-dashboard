export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { mockGrades, mockMarkets } from '@/lib/mockData'
import {
  getOrders, getCompetitorPrices, getExpertInsights,
  getMarketNews, getMeetingNotes, getCustomers, getAnalyzedTexts, MOCK_NOW,
} from '@/lib/dataStore'
import { computePricingRecommendation } from '@/lib/pricingEngine'
import { computeSentimentScore } from '@/lib/sentimentService'
import { deriveAISignalsFromReviewed } from '@/lib/ai/aiSummaryService'
import { subMonths } from 'date-fns'
import type { Order, CompetitorPrice, ExpertInsight, MarketNews, MeetingNote } from '@/types'
import type { ExtractedSignal } from '@/lib/ai/aiSchemas'

export async function GET(
  request: NextRequest,
  { params }: { params: { marketId: string } }
) {
  try {
    const marketId     = parseInt(params.marketId)
    const { searchParams } = new URL(request.url)
    const gradeIdParam = searchParams.get('gradeId')
    const referenceDate = useMockData ? MOCK_NOW : new Date()
    const since         = subMonths(referenceDate, 3) // kept for competitor prices date filter
    const refYM         = referenceDate.getFullYear() * 12 + (referenceDate.getMonth() + 1)

    let orders: Order[]
    let competitorPrices: CompetitorPrice[]
    let expertInsights: ExpertInsight[]
    let marketNews: MarketNews[]
    let meetingNotes: MeetingNote[]
    let grades: { id: number; name: string }[]

    if (useMockData) {
      const customerIds = getCustomers()
        .filter(c => c.market_id === marketId)
        .map(c => c.id)

      orders           = getOrders().filter(o =>
        customerIds.includes(o.customer_id) && o.year * 12 + o.month >= refYM - 3
      )
      competitorPrices = getCompetitorPrices().filter(cp => cp.market_id === marketId)
      expertInsights   = getExpertInsights().filter(ei => ei.market_id === marketId)
      marketNews       = getMarketNews().filter(mn => mn.market_id === marketId)
      meetingNotes     = getMeetingNotes().filter(mn => mn.market_id === marketId)
      grades           = mockGrades
    } else {
      const [oRes, cpRes, eiRes, mnRes, noteRes, gRes] = await Promise.all([
        query(
          `SELECT o.* FROM orders o
           JOIN customers c ON c.id = o.customer_id
           WHERE c.market_id = $1 AND (o.year * 12 + o.month) >= $2`,
          [marketId, refYM - 3]
        ),
        query('SELECT * FROM competitor_prices WHERE market_id = $1', [marketId]),
        query('SELECT * FROM expert_insights WHERE market_id = $1', [marketId]),
        query('SELECT * FROM market_news WHERE market_id = $1 ORDER BY date DESC', [marketId]),
        query('SELECT * FROM meeting_notes WHERE market_id = $1 ORDER BY date DESC', [marketId]),
        query('SELECT * FROM grades ORDER BY name'),
      ])
      orders           = oRes.rows
      competitorPrices = cpRes.rows
      expertInsights   = eiRes.rows
      marketNews       = mnRes.rows
      meetingNotes     = noteRes.rows
      grades           = gRes.rows
    }

    const sentimentScore = computeSentimentScore(marketNews, expertInsights, meetingNotes)

    // Gather reviewed AI signals for this market — secondary influence only
    let reviewedAISignals: ExtractedSignal[] = []
    if (useMockData) {
      reviewedAISignals = getAnalyzedTexts()
        .filter(at => at.market_id === marketId && at.review_status === 'approved' && at.final_structured_json !== null)
        .map(at => at.final_structured_json!)
    } else {
      const aiRes = await query(
        `SELECT final_structured_json FROM analyzed_texts WHERE market_id = $1 AND review_status = 'approved' AND final_structured_json IS NOT NULL ORDER BY created_at DESC LIMIT 10`,
        [marketId],
      )
      reviewedAISignals = aiRes.rows
        .map((r: { final_structured_json: string | ExtractedSignal }) => {
          const v = r.final_structured_json
          if (typeof v === 'string') { try { return JSON.parse(v) } catch { return null } }
          return v
        })
        .filter(Boolean) as ExtractedSignal[]
    }
    const aiSignals = deriveAISignalsFromReviewed(reviewedAISignals)

    // China market for benchmark reference
    let chinaMarket: { id: number } | undefined
    if (useMockData) {
      chinaMarket = mockMarkets.find(m => m.benchmark_flag)
    } else {
      const chinaRes = await query('SELECT id FROM markets WHERE benchmark_flag = true LIMIT 1', [])
      chinaMarket = chinaRes.rows[0]
    }
    const allCompetitorPrices = useMockData ? getCompetitorPrices() : competitorPrices

    const gradesToProcess = gradeIdParam
      ? grades.filter(g => g.id === parseInt(gradeIdParam))
      : grades

    const recommendations = gradesToProcess.map(grade => {
      const gradeOrders      = orders.filter(o => o.grade_id === grade.id)
      const gradeCompPrices  = competitorPrices.filter(cp => cp.grade_id === grade.id)
      const gradeInsights    = expertInsights.filter(ei => ei.grade_id === grade.id)

      // Grade-specific China baseline (non-China markets only)
      let chinaBaselinePrice: number | undefined
      if (chinaMarket && chinaMarket.id !== marketId) {
        const chinaGradeCompPrices = allCompetitorPrices.filter(
          cp => cp.market_id === chinaMarket!.id && cp.grade_id === grade.id
        )
        if (chinaGradeCompPrices.length > 0) {
          chinaBaselinePrice = chinaGradeCompPrices.reduce((s, cp) => s + cp.price, 0) /
            chinaGradeCompPrices.length
        }
      }

      return computePricingRecommendation({
        marketId,
        gradeId:          grade.id,
        gradeName:        grade.name,
        recentOrders:     gradeOrders,
        competitorPrices: gradeCompPrices,
        expertInsights:   gradeInsights,
        sentimentScore,
        meetingNotes,
        chinaBaselinePrice,
        referenceDate,
        aiSignals,
      })
    })

    return NextResponse.json({ recommendations, sentimentScore })
  } catch (err) {
    console.error(`GET /api/pricing/${params.marketId} error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
