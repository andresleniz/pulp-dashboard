export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { getMarketNews, addMarketNews } from '@/lib/dataStore'
import type { MarketNews } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')

    if (useMockData) {
      let news = getMarketNews()
      if (marketId) news = news.filter(n => n.market_id === parseInt(marketId))
      return NextResponse.json(news.sort((a, b) => b.date.localeCompare(a.date)))
    }

    const params: unknown[] = []
    let sql = 'SELECT * FROM market_news WHERE 1=1'
    if (marketId) { params.push(parseInt(marketId)); sql += ` AND market_id = $${params.length}` }
    sql += ' ORDER BY date DESC'

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/market-news error:', err)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      market_id: number
      title: string
      summary?: string
      sentiment: 'bullish' | 'neutral' | 'bearish'
      date: string
    }

    if (!body.market_id || !body.title || !body.sentiment || !body.date) {
      return NextResponse.json(
        { error: 'market_id, title, sentiment, and date are required' },
        { status: 400 }
      )
    }

    if (useMockData) {
      const newNews: MarketNews = {
        id:         Date.now(),
        market_id:  body.market_id,
        title:      body.title,
        summary:    body.summary || '',
        sentiment:  body.sentiment,
        date:       body.date,
        created_at: new Date().toISOString(),
      }
      addMarketNews(newNews)
      return NextResponse.json(newNews, { status: 201 })
    }

    const result = await query(
      'INSERT INTO market_news (market_id, title, summary, sentiment, date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [body.market_id, body.title, body.summary || null, body.sentiment, body.date]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error('POST /api/market-news error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
