export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { getMeetingNotes, addMeetingNote } from '@/lib/dataStore'
import { processMeetingNote } from '@/lib/meetingNotesService'
import type { MeetingNote } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')

    if (useMockData) {
      let notes = getMeetingNotes()
      if (marketId) notes = notes.filter(n => n.market_id === parseInt(marketId))
      return NextResponse.json(notes.sort((a, b) => b.date.localeCompare(a.date)))
    }

    const params: unknown[] = []
    let sql = 'SELECT * FROM meeting_notes WHERE 1=1'
    if (marketId) { params.push(parseInt(marketId)); sql += ` AND market_id = $${params.length}` }
    sql += ' ORDER BY date DESC'

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/meeting-notes error:', err)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      market_id: number
      customer_id?: number
      date: string
      source_type: 'customer_meeting' | 'internal_meeting' | 'agent_call'
      raw_text: string
      tags?: string[]
    }

    if (!body.market_id || !body.raw_text || !body.date || !body.source_type) {
      return NextResponse.json(
        { error: 'market_id, raw_text, date, and source_type are required' },
        { status: 400 }
      )
    }

    const tags = body.tags || []
    const { sentiment, extractedSignals } = processMeetingNote(body.raw_text, tags)

    if (useMockData) {
      const newNote: MeetingNote = {
        id:                  Date.now(),
        market_id:           body.market_id,
        customer_id:         body.customer_id || null,
        date:                body.date,
        source_type:         body.source_type,
        raw_text:            body.raw_text,
        extracted_sentiment: sentiment,
        extracted_signals:   extractedSignals,
        tags,
        created_at:          new Date().toISOString(),
      }
      addMeetingNote(newNote)
      return NextResponse.json(newNote, { status: 201 })
    }

    const result = await query(
      `INSERT INTO meeting_notes
         (market_id, customer_id, date, source_type, raw_text, extracted_sentiment, extracted_signals, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        body.market_id,
        body.customer_id || null,
        body.date,
        body.source_type,
        body.raw_text,
        sentiment,
        JSON.stringify(extractedSignals),
        JSON.stringify(tags),
      ]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error('POST /api/meeting-notes error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
