import { NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { mockMarkets } from '@/lib/mockData'

export async function GET() {
  try {
    if (useMockData) {
      return NextResponse.json(mockMarkets)
    }
    const result = await query('SELECT * FROM markets ORDER BY name')
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/markets error:', err)
    return NextResponse.json(mockMarkets)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name: string; region: string; benchmark_flag?: boolean }
    const { name, region, benchmark_flag = false } = body

    if (!name || !region) {
      return NextResponse.json({ error: 'name and region are required' }, { status: 400 })
    }

    if (useMockData) {
      const newMarket = {
        id: Date.now(),
        name,
        region,
        benchmark_flag,
        created_at: new Date().toISOString(),
      }
      return NextResponse.json(newMarket, { status: 201 })
    }

    const result = await query(
      'INSERT INTO markets (name, region, benchmark_flag) VALUES ($1, $2, $3) RETURNING *',
      [name, region, benchmark_flag]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error('POST /api/markets error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
