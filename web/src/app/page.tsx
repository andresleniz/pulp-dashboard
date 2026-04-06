'use client'

import { useEffect, useState } from 'react'
import TopNav from '@/components/layout/TopNav'
import MarketHeatmap from '@/components/global/MarketHeatmap'
import Link from 'next/link'
import type { Market, MarketSummary, PricingRecommendation, SentimentScore } from '@/types'
import clsx from 'clsx'

function SentimentBadge({ sentiment }: { sentiment: 'bullish' | 'neutral' | 'bearish' }) {
  const c = { bullish: 'badge-bullish', neutral: 'badge-neutral', bearish: 'badge-bearish' }
  return <span className={c[sentiment]}>{sentiment}</span>
}

function PressureArrow({ pressure }: { pressure: 'up' | 'flat' | 'down' }) {
  if (pressure === 'up') return <span className="text-emerald-400 font-bold">▲</span>
  if (pressure === 'down') return <span className="text-red-400 font-bold">▼</span>
  return <span className="text-slate-400 font-bold">—</span>
}

export default function GlobalOverviewPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [summaries, setSummaries] = useState<MarketSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/markets')
      .then(r => r.json())
      .then(async (data: Market[]) => {
        setMarkets(data)

        // Fetch pricing for each market
        const summaryPromises = data.map(async (market): Promise<MarketSummary> => {
          try {
            const res = await fetch(`/api/pricing/${market.id}`)
            const priceData = await res.json() as {
              recommendations: PricingRecommendation[]
              sentimentScore: SentimentScore
            }
            const recs = priceData.recommendations || []
            const sentiment = priceData.sentimentScore

            const avgPrice = recs.length > 0
              ? recs.reduce((s, r) => s + r.currentAvgPrice, 0) / recs.length
              : 0
            const recPrice = recs.length > 0
              ? recs.reduce((s, r) => s + r.priceMid, 0) / recs.length
              : 0
            const avgConf = recs.length > 0
              ? Math.round(recs.reduce((s, r) => s + r.confidenceScore, 0) / recs.length)
              : 50

            const priceDiff = recPrice - avgPrice
            const pressure: 'up' | 'flat' | 'down' =
              priceDiff > avgPrice * 0.015 ? 'up' :
              priceDiff < -avgPrice * 0.015 ? 'down' : 'flat'

            return {
              market,
              currentAvgPrice: Math.round(avgPrice),
              recommendedPrice: Math.round(recPrice),
              pricePressure: pressure,
              sentiment: sentiment?.overall || 'neutral',
              confidence: avgConf,
              recommendations: recs,
            }
          } catch {
            return {
              market,
              currentAvgPrice: 0,
              recommendedPrice: 0,
              pricePressure: 'flat',
              sentiment: 'neutral',
              confidence: 50,
              recommendations: [],
            }
          }
        })

        const resolved = await Promise.all(summaryPromises)
        setSummaries(resolved)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const attentionMarkets = summaries.filter(s => {
    const diff = s.currentAvgPrice > 0
      ? Math.abs((s.recommendedPrice - s.currentAvgPrice) / s.currentAvgPrice * 100)
      : 0
    return diff > 2
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopNav breadcrumb={['Global Overview']} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Global Market Overview</h1>
            <p className="text-slate-400 text-sm mt-1">Pricing intelligence across all markets — click a region to drill down</p>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          )}
        </div>

        {/* Heatmap */}
        <div className="card-dark overflow-hidden">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">World Market Map</div>
          <MarketHeatmap summaries={summaries} />
        </div>

        {/* Summary Cards */}
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Market Summary</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {summaries.map(summary => {
              const priceDiffPct = summary.currentAvgPrice > 0
                ? ((summary.recommendedPrice - summary.currentAvgPrice) / summary.currentAvgPrice * 100)
                : 0

              return (
                <Link
                  key={summary.market.id}
                  href={`/markets/${summary.market.id}`}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-brand-600/50 hover:bg-slate-800/80 transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors">
                        {summary.market.name}
                      </span>
                      {summary.market.benchmark_flag && (
                        <span className="text-xs text-amber-400 bg-amber-900/30 border border-amber-700/30 px-1.5 py-0.5 rounded">BM</span>
                      )}
                    </div>
                    <PressureArrow pressure={summary.pricePressure} />
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-slate-500 mb-1">Current Avg Price</div>
                    <div className="text-xl font-bold text-white">
                      ${summary.currentAvgPrice > 0 ? summary.currentAvgPrice.toLocaleString() : '—'}
                      <span className="text-xs text-slate-500 font-normal">/t</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-slate-500 mb-1">Recommended Price</div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-white">
                        ${summary.recommendedPrice > 0 ? summary.recommendedPrice.toLocaleString() : '—'}
                      </span>
                      {priceDiffPct !== 0 && summary.currentAvgPrice > 0 && (
                        <span className={clsx(
                          'text-xs font-medium',
                          priceDiffPct > 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {priceDiffPct > 0 ? '+' : ''}{priceDiffPct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <SentimentBadge sentiment={summary.sentiment} />
                    <div className="text-xs text-slate-500">
                      Conf: <span className={clsx(
                        'font-medium',
                        summary.confidence >= 70 ? 'text-emerald-400' :
                        summary.confidence >= 40 ? 'text-yellow-400' : 'text-red-400'
                      )}>{summary.confidence}%</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Attention Required */}
        {attentionMarkets.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <div className="text-xs text-amber-400 uppercase tracking-wider font-medium">
                Pricing Decisions Required ({attentionMarkets.length})
              </div>
            </div>
            <div className="space-y-2">
              {attentionMarkets.map(s => {
                const diff = s.currentAvgPrice > 0
                  ? (s.recommendedPrice - s.currentAvgPrice) / s.currentAvgPrice * 100
                  : 0
                const action = diff > 0 ? 'INCREASE' : 'REDUCE'
                const color = diff > 0 ? 'border-emerald-700/50 bg-emerald-900/10' : 'border-red-700/50 bg-red-900/10'
                const textColor = diff > 0 ? 'text-emerald-400' : 'text-red-400'

                return (
                  <Link
                    key={s.market.id}
                    href={`/markets/${s.market.id}`}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:opacity-90 ${color}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded border ${
                        diff > 0 ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-400' :
                        'bg-red-900/40 border-red-700/50 text-red-400'
                      }`}>{action}</span>
                      <div>
                        <span className="text-white font-medium text-sm">{s.market.name}</span>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Current ${s.currentAvgPrice}/t → Recommended ${s.recommendedPrice}/t
                        </div>
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${textColor}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {!loading && attentionMarkets.length === 0 && summaries.length > 0 && (
          <div className="flex items-center gap-3 p-4 bg-emerald-900/10 border border-emerald-700/30 rounded-xl">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-emerald-300 text-sm">All markets are within recommended price ranges. No immediate action required.</span>
          </div>
        )}
      </div>
    </div>
  )
}
