export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { getCustomers } from '@/lib/dataStore'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')

    if (useMockData) {
      let customers = getCustomers()
      if (marketId) customers = customers.filter(c => c.market_id === parseInt(marketId))
      return NextResponse.json(customers)
    }

    const params: unknown[] = []
    let sql = 'SELECT * FROM customers WHERE 1=1'
    if (marketId) { params.push(parseInt(marketId)); sql += ` AND market_id = $${params.length}` }
    sql += ' ORDER BY name'

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/customers error:', err)
    return NextResponse.json([])
  }
}
