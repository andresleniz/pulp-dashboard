/**
 * GET  /api/ai/analyzed-texts?marketId=&status=
 *   Returns analyzed text records, optionally filtered by market and review status.
 *
 * PATCH /api/ai/analyzed-texts
 *   Updates review status and/or user corrections for a record.
 *   Body: { id, review_status?, user_corrected_json?, final_structured_json? }
 */

export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { getAnalyzedTexts, updateAnalyzedText } from '@/lib/dataStore'
import type { AnalyzedText, ReviewStatus, ExtractedSignal } from '@/lib/ai/aiSchemas'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')
    const status = searchParams.get('status') as ReviewStatus | null

    if (useMockData) {
      let records = getAnalyzedTexts()
      if (marketId) records = records.filter(r => r.market_id === parseInt(marketId))
      if (status) records = records.filter(r => r.review_status === status)
      return NextResponse.json(
        [...records].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      )
    }

    const params: unknown[] = []
    let sql = 'SELECT * FROM analyzed_texts WHERE 1=1'
    if (marketId) { params.push(parseInt(marketId)); sql += ` AND market_id = $${params.length}` }
    if (status) { params.push(status); sql += ` AND review_status = $${params.length}` }
    sql += ' ORDER BY created_at DESC LIMIT 50'

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/ai/analyzed-texts error:', err)
    return NextResponse.json([], { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      id: number
      review_status?: ReviewStatus
      user_corrected_json?: Partial<ExtractedSignal>
      final_structured_json?: ExtractedSignal
    }

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const validStatuses: ReviewStatus[] = ['pending_review', 'approved', 'rejected', 'edited']
    if (body.review_status && !validStatuses.includes(body.review_status)) {
      return NextResponse.json({ error: 'Invalid review_status' }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (useMockData) {
      const updated = updateAnalyzedText(body.id, {
        ...(body.review_status !== undefined && { review_status: body.review_status }),
        ...(body.user_corrected_json !== undefined && { user_corrected_json: body.user_corrected_json }),
        ...(body.final_structured_json !== undefined && { final_structured_json: body.final_structured_json }),
        updated_at: now,
      })
      if (!updated) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 })
      }
      return NextResponse.json(updated)
    }

    // Build dynamic UPDATE
    const setClauses: string[] = ['updated_at = NOW()']
    const params: unknown[] = []

    if (body.review_status !== undefined) {
      params.push(body.review_status)
      setClauses.push(`review_status = $${params.length}`)
    }
    if (body.user_corrected_json !== undefined) {
      params.push(JSON.stringify(body.user_corrected_json))
      setClauses.push(`user_corrected_json = $${params.length}`)
    }
    if (body.final_structured_json !== undefined) {
      params.push(JSON.stringify(body.final_structured_json))
      setClauses.push(`final_structured_json = $${params.length}`)
    }

    params.push(body.id)
    const sql = `UPDATE analyzed_texts SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`
    const result = await query(sql, params)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0] as AnalyzedText)
  } catch (err) {
    console.error('PATCH /api/ai/analyzed-texts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
