'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { format } from 'date-fns'
import type { Order, Contract, Customer } from '@/types'

interface VolumeTrendChartProps {
  orders: Order[]
  contracts: Contract[]
  customers: Customer[]
}

interface ChartPoint {
  month: string
  volume: number
  target: number
  aboveTarget: number | null
  belowTarget: number | null
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null
  const vol = payload.find(p => p.name === 'Actual Volume')
  const target = payload.find(p => p.name === 'Contract Target')
  const diff = vol && target ? vol.value - target.value : null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <div className="text-slate-300 font-semibold mb-2">{label}</div>
      {payload.filter(p => p.value).map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-medium">{p.value?.toLocaleString()} t</span>
        </div>
      ))}
      {diff !== null && (
        <div className={`mt-1 pt-1 border-t border-slate-700 ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {diff >= 0 ? '+' : ''}{diff.toLocaleString()} t vs target
        </div>
      )}
    </div>
  )
}

export default function VolumeTrendChart({ orders, contracts, customers }: VolumeTrendChartProps) {
  // Monthly target = sum of yearly_volume / 12 for customers in this market
  const monthlyTarget = contracts.reduce((sum, c) => {
    const customer = customers.find(cu => cu.id === c.customer_id)
    if (customer) return sum + c.yearly_volume / 12
    return sum
  }, 0)

  const monthMap: Record<string, number> = {}
  for (const order of orders) {
    const month = format(new Date(order.year, order.month - 1, 1), 'MMM yyyy')
    monthMap[month] = (monthMap[month] || 0) + order.volume
  }

  const data: ChartPoint[] = Object.entries(monthMap)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([month, volume]) => ({
      month,
      volume: Math.round(volume),
      target: Math.round(monthlyTarget),
      aboveTarget: volume >= monthlyTarget ? Math.round(volume) : null,
      belowTarget: volume < monthlyTarget ? Math.round(volume) : null,
    }))

  if (data.length === 0) {
    return (
      <div className="card-dark flex items-center justify-center h-48 text-slate-500 text-sm">
        No volume data available.
      </div>
    )
  }

  const lastPoint = data[data.length - 1]
  const lastVsPct = monthlyTarget > 0 ? ((lastPoint.volume - monthlyTarget) / monthlyTarget * 100) : 0

  return (
    <div className="card-dark">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-white">Volume Trend</div>
        <div className={`text-xs font-medium px-2 py-1 rounded-full ${lastVsPct >= 0 ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
          {lastVsPct >= 0 ? 'Over' : 'Under'} target by {Math.abs(lastVsPct).toFixed(1)}%
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="volumeGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="volumeRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />

          {monthlyTarget > 0 && (
            <ReferenceLine
              y={monthlyTarget}
              stroke="#f59e0b"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: 'Target', position: 'right', fill: '#f59e0b', fontSize: 11 }}
            />
          )}

          <Area
            type="monotone"
            dataKey="volume"
            name="Actual Volume"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#volumeGreen)"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs text-slate-600 text-center">
        Tons/month — dashed line = contract target ({Math.round(monthlyTarget).toLocaleString()} t/mo)
      </div>
    </div>
  )
}
