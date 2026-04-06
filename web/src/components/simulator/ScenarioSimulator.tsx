'use client'

import { useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import type { ScenarioResult } from '@/types'
import { runScenario, generateScenarioCurve } from '@/lib/scenarioEngine'
import clsx from 'clsx'

interface ScenarioSimulatorProps {
  currentPrice: number
  currentVolume: number
  currentMargin?: number
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs shadow-xl">
      <div className="text-slate-300 font-semibold mb-1">Price change: {label}%</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function ScenarioSimulator({ currentPrice, currentVolume, currentMargin = 200 }: ScenarioSimulatorProps) {
  const [priceChangePct, setPriceChangePct] = useState(0)
  const [elasticity, setElasticity] = useState(-0.5)

  const result: ScenarioResult = runScenario({
    currentPrice,
    currentVolume,
    currentMargin,
    priceChangePct,
    elasticity,
  })

  const priceRange = Array.from({ length: 41 }, (_, i) => -20 + i)
  const curveData = generateScenarioCurve(
    { currentPrice, currentVolume, currentMargin, elasticity },
    priceRange
  ).map(r => ({
    pct: r.priceChangePct,
    volume: Math.round(r.expectedVolume),
    margin: Math.round(r.expectedMargin),
    revenue: Math.round(r.expectedRevenue / 1000),
  }))

  const formatPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
  const formatCurrency = (v: number) => `$${v >= 0 ? '' : '-'}${Math.abs(v).toLocaleString()}`

  const metricCards = [
    {
      label: 'Volume Change',
      value: formatPct(result.expectedVolumeChangePct),
      positive: result.expectedVolumeChangePct >= 0,
    },
    {
      label: 'New Volume',
      value: `${result.expectedVolume.toLocaleString()} t`,
      positive: result.expectedVolume >= currentVolume,
    },
    {
      label: 'Revenue Change',
      value: `${result.expectedRevenueChangePct >= 0 ? '+' : ''}${result.expectedRevenueChangePct.toFixed(1)}%`,
      positive: result.expectedRevenueChangePct >= 0,
    },
    {
      label: 'Margin Change',
      value: `${result.expectedMarginChangePct >= 0 ? '+' : ''}${result.expectedMarginChangePct.toFixed(1)}%`,
      positive: result.expectedMarginChangePct >= 0,
    },
  ]

  return (
    <div className="card-dark space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand-900/40 border border-brand-700/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Price Scenario Simulator</div>
          <div className="text-xs text-slate-500">Base: ${currentPrice}/t · {currentVolume.toLocaleString()} t/mo</div>
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-400">Price Change</label>
            <span className={clsx(
              'text-sm font-semibold',
              priceChangePct > 0 ? 'text-emerald-400' : priceChangePct < 0 ? 'text-red-400' : 'text-slate-400'
            )}>
              {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={0.5}
            value={priceChangePct}
            onChange={e => setPriceChangePct(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-brand-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>-20%</span>
            <span>0</span>
            <span>+20%</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            New price: <span className="text-white font-medium">${(currentPrice * (1 + priceChangePct / 100)).toFixed(0)}/t</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-400">Price Elasticity of Demand</label>
            <span className="text-sm font-semibold text-slate-300">{elasticity.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={-2}
            max={0}
            step={0.1}
            value={elasticity}
            onChange={e => setElasticity(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>-2.0 (elastic)</span>
            <span>0 (inelastic)</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {Math.abs(elasticity) < 0.5 ? 'Inelastic — volume not very sensitive to price' :
             Math.abs(elasticity) < 1 ? 'Moderately elastic demand' :
             'Highly elastic — price changes significantly affect volume'}
          </div>
        </div>
      </div>

      {/* Output Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metricCards.map(card => (
          <div key={card.label} className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
            <div className="text-xs text-slate-500 mb-1">{card.label}</div>
            <div className={clsx(
              'text-lg font-bold',
              card.positive ? 'text-emerald-400' : 'text-red-400'
            )}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Curve Chart */}
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Volume vs Price Change Curve</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={curveData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="pct"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v}%`}
            />
            <YAxis
              yAxisId="volume"
              orientation="left"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k t`}
              axisLine={{ stroke: '#334155' }}
              width={55}
            />
            <YAxis
              yAxisId="revenue"
              orientation="right"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(v: number) => `$${v}k`}
              axisLine={{ stroke: '#334155' }}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
            <ReferenceLine yAxisId="volume" x={0} stroke="#334155" strokeDasharray="4 2" />
            <ReferenceLine
              yAxisId="volume"
              x={priceChangePct}
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeDasharray="4 2"
              label={{ value: 'Selected', position: 'top', fill: '#0ea5e9', fontSize: 10 }}
            />
            <Line
              yAxisId="volume"
              type="monotone"
              dataKey="volume"
              name="Expected Volume (t)"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              name="Revenue ($k)"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
