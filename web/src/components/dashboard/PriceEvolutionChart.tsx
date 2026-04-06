'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { Order, CompetitorPrice, ExpertInsight } from '@/types'

// Build 'MMM yyyy' key from order year+month (avoids parseISO dependency on order.date accuracy)
function orderMonthKey(o: Order): string {
  return format(new Date(o.year, o.month - 1, 1), 'MMM yyyy')
}

interface PriceEvolutionChartProps {
  orders: Order[]
  competitorPrices: CompetitorPrice[]
  expertInsights: ExpertInsight[]
  gradeId?: number
}

interface ChartPoint {
  month: string
  netPrice?: number
  listPrice?: number
  competitorPrice?: number
  expertLow?: number
  expertHigh?: number
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null
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
    </div>
  )
}

export default function PriceEvolutionChart({
  orders, competitorPrices, expertInsights, gradeId
}: PriceEvolutionChartProps) {
  // Build month-keyed data
  const monthMap: Record<string, ChartPoint> = {}

  const filteredOrders = gradeId ? orders.filter(o => o.grade_id === gradeId) : orders
  const filteredComp = gradeId ? competitorPrices.filter(cp => cp.grade_id === gradeId) : competitorPrices
  const filteredInsights = gradeId ? expertInsights.filter(ei => ei.grade_id === gradeId) : expertInsights

  for (const order of filteredOrders) {
    const month = orderMonthKey(order)
    if (!monthMap[month]) monthMap[month] = { month }
    const existing = monthMap[month]
    if (existing.netPrice === undefined) {
      existing.netPrice = order.net_price
      existing.listPrice = order.list_price
    } else {
      // Average
      existing.netPrice = (existing.netPrice + order.net_price) / 2
      existing.listPrice = ((existing.listPrice ?? 0) + order.list_price) / 2
    }
  }

  for (const cp of filteredComp) {
    const month = format(parseISO(cp.date), 'MMM yyyy')
    if (!monthMap[month]) monthMap[month] = { month }
    const existing = monthMap[month]
    if (existing.competitorPrice === undefined) {
      existing.competitorPrice = cp.price
    } else {
      existing.competitorPrice = (existing.competitorPrice + cp.price) / 2
    }
  }

  for (const ei of filteredInsights) {
    const month = format(parseISO(ei.date), 'MMM yyyy')
    if (!monthMap[month]) monthMap[month] = { month }
    const existing = monthMap[month]
    existing.expertLow = ei.price_forecast_low
    existing.expertHigh = ei.price_forecast_high
  }

  const data = Object.values(monthMap).sort((a, b) => {
    const dateA = new Date(a.month)
    const dateB = new Date(b.month)
    return dateA.getTime() - dateB.getTime()
  })

  if (data.length === 0) {
    return (
      <div className="card-dark flex items-center justify-center h-48 text-slate-500 text-sm">
        No price data available for selected filters.
      </div>
    )
  }

  return (
    <div className="card-dark">
      <div className="text-sm font-semibold text-white mb-4">Price Evolution</div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
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
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
          />

          {/* Expert range area */}
          <Area
            type="monotone"
            dataKey="expertHigh"
            fill="#334155"
            stroke="none"
            fillOpacity={0.3}
            name="Expert High"
          />
          <Area
            type="monotone"
            dataKey="expertLow"
            fill="#0d1117"
            stroke="none"
            fillOpacity={1}
            name="Expert Low"
          />

          <Line
            type="monotone"
            dataKey="listPrice"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            name="List Price"
          />
          <Line
            type="monotone"
            dataKey="netPrice"
            stroke="#0ea5e9"
            strokeWidth={2.5}
            dot={{ fill: '#0ea5e9', r: 4 }}
            name="Net Price"
          />
          <Line
            type="monotone"
            dataKey="competitorPrice"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ fill: '#f97316', r: 3 }}
            strokeDasharray="4 2"
            name="Competitor Avg"
          />
          <Line
            type="monotone"
            dataKey="expertLow"
            stroke="#64748b"
            strokeWidth={1}
            dot={false}
            name="Expert Low"
          />
          <Line
            type="monotone"
            dataKey="expertHigh"
            stroke="#64748b"
            strokeWidth={1}
            dot={false}
            name="Expert High"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs text-slate-600 text-center">
        USD/ton — shaded area = expert forecast range
      </div>
    </div>
  )
}
