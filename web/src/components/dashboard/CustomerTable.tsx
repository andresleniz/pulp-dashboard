'use client'

import type { Customer, Order, Contract, Grade } from '@/types'
import clsx from 'clsx'

interface CustomerTableProps {
  customers: Customer[]
  orders: Order[]
  contracts: Contract[]
  grades: Grade[]
  marketAvgPrice: number
}

interface CustomerRow {
  customer: Customer
  grade: Grade | null
  monthlyVolume: number
  contractTarget: number
  volumeVsContract: number
  avgNetPrice: number
  priceVsMarket: number
  churnRisk: 'High' | 'Medium' | 'Low'
}

export default function CustomerTable({
  customers, orders, contracts, grades, marketAvgPrice
}: CustomerTableProps) {
  const now = new Date()
  const refYM = now.getFullYear() * 12 + (now.getMonth() + 1)

  const rows: CustomerRow[] = customers.map(customer => {
    const custOrders = orders.filter(o => o.customer_id === customer.id)
    const lastMonthOrders = custOrders.filter(o => o.year * 12 + o.month >= refYM - 1)
    const prevMonthOrders = custOrders.filter(o => {
      const ym = o.year * 12 + o.month
      return ym >= refYM - 2 && ym < refYM - 1
    })

    const monthlyVolume = lastMonthOrders.reduce((s, o) => s + o.volume, 0)
    const prevVolume = prevMonthOrders.reduce((s, o) => s + o.volume, 0)

    const contract = contracts.find(c => c.customer_id === customer.id)
    const contractTarget = contract ? contract.yearly_volume / 12 : 0

    const volumeVsContract = contractTarget > 0 ? (monthlyVolume / contractTarget) * 100 : 0

    const avgNetPrice = lastMonthOrders.length > 0
      ? lastMonthOrders.reduce((s, o) => s + o.net_price, 0) / lastMonthOrders.length
      : (custOrders.length > 0
        ? custOrders.reduce((s, o) => s + o.net_price, 0) / custOrders.length
        : 0)

    const priceVsMarket = marketAvgPrice > 0 ? avgNetPrice - marketAvgPrice : 0

    // Churn risk logic
    const volumeTrend = prevVolume > 0 ? (monthlyVolume - prevVolume) / prevVolume : 0
    const pricePremium = marketAvgPrice > 0 ? (avgNetPrice - marketAvgPrice) / marketAvgPrice : 0
    let churnRisk: 'High' | 'Medium' | 'Low' = 'Low'
    if (volumeTrend < -0.15 || volumeVsContract < 70 || pricePremium > 0.05) {
      churnRisk = 'High'
    } else if (volumeTrend < -0.05 || volumeVsContract < 85 || pricePremium > 0.02) {
      churnRisk = 'Medium'
    }

    // Dominant grade
    const gradeCounts: Record<number, number> = {}
    for (const o of custOrders) {
      gradeCounts[o.grade_id] = (gradeCounts[o.grade_id] || 0) + 1
    }
    const dominantGradeId = Object.entries(gradeCounts).sort(([, a], [, b]) => b - a)[0]?.[0]
    const grade = dominantGradeId ? grades.find(g => g.id === parseInt(dominantGradeId)) ?? null : null

    return {
      customer,
      grade,
      monthlyVolume: Math.round(monthlyVolume),
      contractTarget: Math.round(contractTarget),
      volumeVsContract: Math.round(volumeVsContract),
      avgNetPrice: Math.round(avgNetPrice),
      priceVsMarket: Math.round(priceVsMarket),
      churnRisk,
    }
  }).filter(r => r.monthlyVolume > 0 || r.contractTarget > 0)

  const churnColors = {
    High: 'bg-red-900/40 text-red-300 border-red-700/50',
    Medium: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
    Low: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  }

  return (
    <div className="card-dark">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-white">Customer Overview</div>
        <span className="text-xs text-slate-500">{rows.length} customers</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700">
              <th className="text-left pb-3 pr-4">Customer</th>
              <th className="text-left pb-3 pr-4">Grade</th>
              <th className="text-right pb-3 pr-4">Vol (t/mo)</th>
              <th className="text-left pb-3 pr-4 min-w-32">vs Contract</th>
              <th className="text-right pb-3 pr-4">Net Price</th>
              <th className="text-right pb-3 pr-4">vs Market</th>
              <th className="text-center pb-3">Churn Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(row => (
              <tr key={row.customer.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 pr-4 text-white font-medium">{row.customer.name}</td>
                <td className="py-3 pr-4">
                  {row.grade ? (
                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                      {row.grade.name}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-right text-white">
                  {row.monthlyVolume.toLocaleString()}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden min-w-16">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          row.volumeVsContract >= 100 ? 'bg-emerald-500' :
                          row.volumeVsContract >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${Math.min(110, row.volumeVsContract)}%` }}
                      />
                    </div>
                    <span className={clsx(
                      'text-xs font-medium w-10 text-right',
                      row.volumeVsContract >= 110 ? 'text-emerald-400' :
                      row.volumeVsContract >= 80 ? 'text-slate-300' : 'text-red-400'
                    )}>
                      {row.volumeVsContract.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-600">
                      {row.contractTarget.toLocaleString()} t target
                    </span>
                    {row.volumeVsContract >= 110 && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
                        OVER
                      </span>
                    )}
                    {row.volumeVsContract < 80 && row.volumeVsContract >= 50 && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-700/40">
                        UNDER
                      </span>
                    )}
                    {row.volumeVsContract < 50 && row.contractTarget > 0 && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-700/40">
                        CRITICAL
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="text-white">${row.avgNetPrice}</span>
                  <span className="text-slate-500 text-xs">/t</span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className={clsx(
                    'font-medium',
                    row.priceVsMarket > 0 ? 'text-emerald-400' :
                    row.priceVsMarket < 0 ? 'text-red-400' : 'text-slate-400'
                  )}>
                    {row.priceVsMarket > 0 ? '+' : ''}{row.priceVsMarket}
                  </span>
                  <span className="text-slate-500 text-xs">/t</span>
                </td>
                <td className="py-3 text-center">
                  <span className={clsx(
                    'text-xs font-medium px-2 py-0.5 rounded-full border',
                    churnColors[row.churnRisk]
                  )}>
                    {row.churnRisk}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 text-sm">
                  No customer data available for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
