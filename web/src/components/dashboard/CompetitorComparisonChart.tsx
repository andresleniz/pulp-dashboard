'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LabelList,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { Order, CompetitorPrice } from '@/types'

function orderMonthKey(o: Order): string {
  return format(new Date(o.year, o.month - 1, 1), 'MMM yy')
}

interface CompetitorComparisonChartProps {
  orders: Order[]
  competitorPrices: CompetitorPrice[]
  gradeId?: number
}

interface ChartPoint {
  month: string
  ourPrice?: number
  competitorPrice?: number
  difference?: number
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null
  const our = payload.find(p => p.name === 'Our Net Price')
  const comp = payload.find(p => p.name === 'Competitor Price')
  const diff = our && comp ? our.value - comp.value : null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <div className="text-slate-300 font-semibold mb-2">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-medium">${p.value?.toFixed(0)}/t</span>
        </div>
      ))}
      {diff !== null && (
        <div className={`mt-1 pt-1 border-t border-slate-700 ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          Spread: {diff > 0 ? '+' : ''}{diff.toFixed(0)} USD/t
        </div>
      )}
    </div>
  )
}

export default function CompetitorComparisonChart({ orders, competitorPrices, gradeId }: CompetitorComparisonChartProps) {
  const monthMap: Record<string, ChartPoint> = {}

  const filteredOrders = gradeId ? orders.filter(o => o.grade_id === gradeId) : orders
  const filteredComp = gradeId ? competitorPrices.filter(cp => cp.grade_id === gradeId) : competitorPrices

  for (const order of filteredOrders) {
    const month = orderMonthKey(order)
    if (!monthMap[month]) monthMap[month] = { month }
    const ex = monthMap[month]
    ex.ourPrice = ex.ourPrice === undefined ? order.net_price : (ex.ourPrice + order.net_price) / 2
  }

  for (const cp of filteredComp) {
    const month = format(parseISO(cp.date), 'MMM yy')
    if (!monthMap[month]) monthMap[month] = { month }
    const ex = monthMap[month]
    ex.competitorPrice = ex.competitorPrice === undefined ? cp.price : (ex.competitorPrice + cp.price) / 2
  }

  const data = Object.values(monthMap)
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
    .map(d => ({
      ...d,
      ourPrice: d.ourPrice ? Math.round(d.ourPrice) : undefined,
      competitorPrice: d.competitorPrice ? Math.round(d.competitorPrice) : undefined,
    }))

  if (data.length === 0) {
    return (
      <div className="card-dark flex items-center justify-center h-48 text-slate-500 text-sm">
        No comparison data available.
      </div>
    )
  }

  return (
    <div className="card-dark">
      <div className="text-sm font-semibold text-white mb-4">Our Price vs Competitors</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickFormatter={(v: number) => `$${v}`}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />

          <Bar dataKey="ourPrice" name="Our Net Price" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={32}>
            <LabelList dataKey="ourPrice" position="top" formatter={(v: number) => `$${v}`} style={{ fill: '#94a3b8', fontSize: 9 }} />
          </Bar>
          <Bar dataKey="competitorPrice" name="Competitor Price" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={32}>
            <LabelList dataKey="competitorPrice" position="top" formatter={(v: number) => `$${v}`} style={{ fill: '#94a3b8', fontSize: 9 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs text-slate-600 text-center">USD/ton — monthly average</div>
    </div>
  )
}
