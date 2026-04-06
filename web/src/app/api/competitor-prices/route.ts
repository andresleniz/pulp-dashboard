import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { getCompetitorPrices, addCompetitorPrice } from '@/lib/dataStore'
import type { CompetitorPrice } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')
    const gradeId  = searchParams.get('gradeId')

    if (useMockData) {
      let prices = getCompetitorPrices()
      if (marketId) prices = prices.filter(p => p.market_id === parseInt(marketId))
      if (gradeId)  prices = prices.filter(p => p.grade_id  === parseInt(gradeId))
      return NextResponse.json(prices)
    }

    const params: unknown[] = []
    let sql = 'SELECT * FROM competitor_prices WHERE 1=1'
    if (marketId) { params.push(parseInt(marketId)); sql += ` AND market_id = $${params.length}` }
    if (gradeId)  { params.push(parseInt(gradeId));  sql += ` AND grade_id  = $${params.length}` }
    sql += ' ORDER BY date DESC'

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/competitor-prices error:', err)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      market_id: number
      grade_id: number
      price: number
      date: string
      source?: string
    }

    if (!body.market_id || !body.grade_id || !body.price || !body.date) {
      return NextResponse.json(
        { error: 'market_id, grade_id, price, and date are required' },
        { status: 400 }
      )
    }

    if (useMockData) {
      const newPrice: CompetitorPrice = {
        id: Date.now(),
        market_id: body.market_id,
        grade_id:  body.grade_id,
        price:     body.price,
        date:      body.date,
        source:    body.source || '',
        created_at: new Date().toISOString(),
      }
      addCompetitorPrice(newPrice)
      return NextResponse.json(newPrice, { status: 201 })
    }

    const result = await query(
      'INSERT INTO competitor_prices (market_id, grade_id, price, date, source) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [body.market_id, body.grade_id, body.price, body.date, body.source || null]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error('POST /api/competitor-prices error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
