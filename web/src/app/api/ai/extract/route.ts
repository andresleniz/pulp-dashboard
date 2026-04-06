/**
 * POST /api/ai/extract
 *
 * Analyzes a pasted text and returns extracted commercial signals.
 * Stores the raw AI output with status=pending_review.
 * Human review is required before AI output affects the pricing engine.
 *
 * Body:
 *   text: string
 *   source_type: 'meeting_note' | 'market_news' | 'expert_report' | 'internal_note'
 *   market_id?: number
 *   customer_id?: number
 *   grade_id?: number
 */

import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { getAnalyzedTexts, addAnalyzedText } from '@/lib/dataStore'
import { extractSignals } from '@/lib/ai/aiExtractionService'
import { isAIAvailable, PROMPT_VERSION } from '@/lib/ai/aiClient'
import type { AnalyzedText } from '@/lib/ai/aiSchemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      text: string
      source_type: 'meeting_note' | 'market_news' | 'expert_report' | 'internal_note'
      market_id?: number
      customer_id?: number
      grade_id?: number
    }

    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    if (!body.source_type) {
      return NextResponse.json({ error: 'source_type is required' }, { status: 400 })
    }

    const validSourceTypes = ['meeting_note', 'market_news', 'expert_report', 'internal_note']
    if (!validSourceTypes.includes(body.source_type)) {
      return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 })
    }

    // Check AI availability — return graceful response if unavailable
    if (!isAIAvailable()) {
      return NextResponse.json(
        {
          ai_available: false,
          error: 'AI service not configured. Set ANTHROPIC_API_KEY in environment.',
        },
        { status: 503 },
      )
    }

    // Run extraction
    const extraction = await extractSignals(body.text, body.source_type)

    if (!extraction.success || !extraction.data) {
      return NextResponse.json(
        {
          ai_available: true,
          success: false,
          error: extraction.error || 'Extraction failed',
          model: extraction.model,
        },
        { status: 422 },
      )
    }

    const now = new Date().toISOString()

    // Store with pending_review status — not yet trusted by pricing engine
    if (useMockData) {
      const record: AnalyzedText = {
        id: Date.now(),
        source_type: body.source_type,
        market_id: body.market_id ?? null,
        customer_id: body.customer_id ?? null,
        grade_id: body.grade_id ?? null,
        raw_text: body.text,
        ai_output_json: extraction.data,
        user_corrected_json: null,
        final_structured_json: null,
        ai_summary_short: extraction.data.summary_short,
        ai_summary_long: extraction.data.summary_long,
        ai_model: extraction.model ?? null,
        prompt_version: extraction.promptVersion,
        review_status: 'pending_review',
        created_at: now,
        updated_at: now,
      }
      addAnalyzedText(record)
      return NextResponse.json({ success: true, record }, { status: 201 })
    }

    // PostgreSQL mode
    const result = await query(
      `INSERT INTO analyzed_texts
         (source_type, market_id, customer_id, grade_id, raw_text,
          ai_output_json, ai_summary_short, ai_summary_long,
          ai_model, prompt_version, review_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        body.source_type,
        body.market_id ?? null,
        body.customer_id ?? null,
        body.grade_id ?? null,
        body.text,
        JSON.stringify(extraction.data),
        extraction.data.summary_short,
        extraction.data.summary_long,
        extraction.model ?? null,
        extraction.promptVersion,
        'pending_review',
      ],
    )

    return NextResponse.json({ success: true, record: result.rows[0] }, { status: 201 })
  } catch (err) {
    console.error('POST /api/ai/extract error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
