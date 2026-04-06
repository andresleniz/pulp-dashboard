import { NextRequest, NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { mockGrades } from '@/lib/mockData'
import {
  getOrders, addOrder, getCustomers, findOrCreateCustomer, MOCK_NOW,
} from '@/lib/dataStore'
import type { Order } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')
    const gradeId  = searchParams.get('gradeId')
    const months   = parseInt(searchParams.get('months') || '3', 10)

    if (useMockData) {
      const refYM   = MOCK_NOW.getFullYear() * 12 + (MOCK_NOW.getMonth() + 1)
      let orders = getOrders().filter(o => o.year * 12 + o.month >= refYM - months)
      if (marketId) {
        const mId = parseInt(marketId)
        const customerIds = getCustomers()
          .filter(c => c.market_id === mId)
          .map(c => c.id)
        orders = orders.filter(o => customerIds.includes(o.customer_id))
      }
      if (gradeId) orders = orders.filter(o => o.grade_id === parseInt(gradeId))
      return NextResponse.json(orders)
    }

    const now    = new Date()
    const refYM  = now.getFullYear() * 12 + (now.getMonth() + 1)
    const cutYM  = refYM - months
    const cutYear  = Math.floor((cutYM - 1) / 12)
    const cutMonth = ((cutYM - 1) % 12) + 1

    const params: unknown[] = [cutYear, cutMonth]
    let sql = `
      SELECT o.*, c.name as customer_name, g.name as grade_name, c.market_id
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN grades g ON g.id = o.grade_id
      WHERE (o.year * 12 + o.month) >= ($1 * 12 + $2)
    `
    if (marketId) { params.push(parseInt(marketId)); sql += ` AND c.market_id = $${params.length}` }
    if (gradeId)  { params.push(parseInt(gradeId));  sql += ` AND o.grade_id = $${params.length}` }
    sql += ' ORDER BY o.year DESC, o.month DESC'

    const result = await query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/orders error:', err)
    return NextResponse.json([])
  }
}

interface OrderInput {
  // name-based (CSV upload with market context)
  customer_name?: string
  grade_name?: string
  market_id?: number
  // id-based (direct integration)
  customer_id?: number
  grade_id?: number
  // required order fields — year+month is the canonical time model
  year: number
  month: number
  volume: number
  list_price: number
  net_price: number
  rebates?: number
  discounts?: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as OrderInput[]

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: 'Expected a non-empty array of orders' }, { status: 400 })
    }

    if (useMockData) {
      let inserted = 0
      for (const row of body) {
        // Resolve customer_id
        let customerId = row.customer_id
        if (!customerId) {
          if (!row.customer_name || !row.market_id) continue
          customerId = findOrCreateCustomer(row.customer_name, row.market_id).id
        }

        // Resolve grade_id
        let gradeId = row.grade_id
        if (!gradeId && row.grade_name) {
          const found = mockGrades.find(
            g => g.name.toLowerCase() === row.grade_name!.toLowerCase()
          )
          gradeId = found?.id ?? mockGrades[0]?.id ?? 1
        }
        if (!gradeId) gradeId = 1

        const newOrder: Order = {
          id: Date.now() + inserted,
          customer_id: customerId,
          grade_id: gradeId,
          year: row.year,
          month: row.month,
          date: `${row.year}-${String(row.month).padStart(2, '0')}-01`,
          volume: row.volume,
          list_price: row.list_price,
          net_price: row.net_price,
          rebates: row.rebates ?? 0,
          discounts: row.discounts ?? 0,
          created_at: new Date().toISOString(),
        }
        addOrder(newOrder)
        inserted++
      }
      return NextResponse.json({ inserted })
    }

    // ── Real PostgreSQL mode ──────────────────────────────────────────────────
    let inserted = 0
    for (const row of body) {
      let customerId = row.customer_id
      if (!customerId) {
        if (!row.customer_name || !row.market_id) continue
        // Upsert customer
        await query(
          `INSERT INTO customers (name, market_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [row.customer_name, row.market_id]
        )
        const res = await query(
          'SELECT id FROM customers WHERE name = $1 AND market_id = $2',
          [row.customer_name, row.market_id]
        )
        customerId = res.rows[0]?.id
        if (!customerId) continue
      }

      let gradeId = row.grade_id
      if (!gradeId && row.grade_name) {
        const res = await query(
          'SELECT id FROM grades WHERE LOWER(name) = LOWER($1)', [row.grade_name]
        )
        gradeId = res.rows[0]?.id ?? 1
      }
      if (!gradeId) gradeId = 1

      const derivedDate = `${row.year}-${String(row.month).padStart(2, '0')}-01`
      await query(
        `INSERT INTO orders (customer_id, grade_id, year, month, date, volume, list_price, net_price, rebates, discounts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [customerId, gradeId, row.year, row.month, derivedDate, row.volume,
         row.list_price, row.net_price, row.rebates ?? 0, row.discounts ?? 0]
      )
      inserted++
    }
    return NextResponse.json({ inserted })
  } catch (err) {
    console.error('POST /api/orders error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
