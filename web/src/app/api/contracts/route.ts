import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { getContracts, getCustomers } from '@/lib/dataStore'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId   = searchParams.get('marketId')
    const customerId = searchParams.get('customerId')

    if (useMockData) {
      let contracts = getContracts()
      if (marketId) {
        const mId = parseInt(marketId)
        const customerIds = getCustomers().filter(c => c.market_id === mId).map(c => c.id)
        contracts = contracts.filter(c => customerIds.includes(c.customer_id))
      }
      if (customerId) {
        contracts = contracts.filter(c => c.customer_id === parseInt(customerId))
      }
      return NextResponse.json(contracts)
    }

    const params: unknown[] = []
    let sql = 'SELECT c.* FROM contracts c JOIN customers cu ON cu.id = c.customer_id WHERE 1=1'
    if (marketId)   { params.push(parseInt(marketId));   sql += ` AND cu.market_id  = $${params.length}` }
    if (customerId) { params.push(parseInt(customerId)); sql += ` AND c.customer_id = $${params.length}` }
    sql += ' ORDER BY c.id'

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/contracts error:', err)
    return NextResponse.json([])
  }
}
