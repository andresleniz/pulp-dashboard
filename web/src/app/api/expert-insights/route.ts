import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { getExpertInsights, addExpertInsight } from '@/lib/dataStore'
import type { ExpertInsight } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')
    const gradeId  = searchParams.get('gradeId')

    if (useMockData) {
      let insights = getExpertInsights()
      if (marketId) insights = insights.filter(i => i.market_id === parseInt(marketId))
      if (gradeId)  insights = insights.filter(i => i.grade_id  === parseInt(gradeId))
      return NextResponse.json(insights)
    }

    const params: unknown[] = []
    let sql = 'SELECT * FROM expert_insights WHERE 1=1'
    if (marketId) { params.push(parseInt(marketId)); sql += ` AND market_id = $${params.length}` }
    if (gradeId)  { params.push(parseInt(gradeId));  sql += ` AND grade_id  = $${params.length}` }
    sql += ' ORDER BY date DESC'

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/expert-insights error:', err)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      source: string
      market_id: number
      grade_id: number
      price_forecast_low: number
      price_forecast_high: number
      sentiment: 'bullish' | 'neutral' | 'bearish'
      date: string
    }

    if (!body.source || !body.market_id || !body.grade_id ||
        !body.price_forecast_low || !body.price_forecast_high ||
        !body.sentiment || !body.date) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (useMockData) {
      const newInsight: ExpertInsight = {
        id: Date.now(),
        source:              body.source,
        market_id:           body.market_id,
        grade_id:            body.grade_id,
        price_forecast_low:  body.price_forecast_low,
        price_forecast_high: body.price_forecast_high,
        sentiment:           body.sentiment,
        date:                body.date,
        created_at:          new Date().toISOString(),
      }
      addExpertInsight(newInsight)
      return NextResponse.json(newInsight, { status: 201 })
    }

    const result = await query(
      `INSERT INTO expert_insights
         (source, market_id, grade_id, price_forecast_low, price_forecast_high, sentiment, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.source, body.market_id, body.grade_id,
       body.price_forecast_low, body.price_forecast_high, body.sentiment, body.date]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error('POST /api/expert-insights error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
