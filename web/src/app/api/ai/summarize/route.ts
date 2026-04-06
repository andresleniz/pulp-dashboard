/**
 * POST /api/ai/summarize
 *
 * Generates a grounded market narrative from reviewed AI signals.
 * Requires reviewed analyzed_texts records — does not use pending_review data.
 *
 * Body:
 *   market_id: number
 *   market_name: string
 *   sentiment_score: SentimentScore
 *   recommendation?: PricingRecommendation
 */

import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { getAnalyzedTexts } from '@/lib/dataStore'
import { generateMarketNarrative } from '@/lib/ai/aiSummaryService'
import { isAIAvailable } from '@/lib/ai/aiClient'
import type { ExtractedSignal } from '@/lib/ai/aiSchemas'
import type { SentimentScore, PricingRecommendation } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      market_id: number
      market_name: string
      sentiment_score: SentimentScore
      recommendation?: PricingRecommendation
    }

    if (!body.market_id || !body.market_name || !body.sentiment_score) {
      return NextResponse.json(
        { error: 'market_id, market_name, and sentiment_score are required' },
        { status: 400 },
      )
    }

    // Gather reviewed signals for this market
    let reviewedSignals: ExtractedSignal[] = []

    if (useMockData) {
      const records = getAnalyzedTexts().filter(
        at =>
          at.market_id === body.market_id &&
          at.review_status === 'approved' &&
          at.final_structured_json !== null,
      )
      reviewedSignals = records.map(r => r.final_structured_json!).filter(Boolean)
    } else {
      const result = await query(
        `SELECT final_structured_json FROM analyzed_texts
         WHERE market_id = $1 AND review_status = 'approved'
           AND final_structured_json IS NOT NULL
         ORDER BY created_at DESC LIMIT 10`,
        [body.market_id],
      )
      reviewedSignals = result.rows
        .map((r: { final_structured_json: string | ExtractedSignal }) => {
          const val = r.final_structured_json
          if (typeof val === 'string') {
            try { return JSON.parse(val) as ExtractedSignal } catch { return null }
          }
          return val as ExtractedSignal
        })
        .filter(Boolean) as ExtractedSignal[]
    }

    if (!isAIAvailable() && reviewedSignals.length === 0) {
      return NextResponse.json({
        ai_available: false,
        marketSummary: 'AI not configured and no reviewed signals available.',
        bullishFactors: [],
        bearishFactors: [],
        watchouts: [],
        recommendationExplanation: null,
      })
    }

    const narrative = await generateMarketNarrative(
      body.market_name,
      body.sentiment_score,
      reviewedSignals,
      body.recommendation ?? null,
    )

    return NextResponse.json({ ai_available: isAIAvailable(), ...narrative })
  } catch (err) {
    console.error('POST /api/ai/summarize error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
