'use client'

import type { ExpertInsight, Grade } from '@/types'
import { format, parseISO } from 'date-fns'

interface ExpertInsightsPanelProps {
  insights: ExpertInsight[]
  grades: Grade[]
  currentAvgPrice?: number
}

function SentimentBadge({ sentiment }: { sentiment: 'bullish' | 'neutral' | 'bearish' }) {
  const classes = {
    bullish: 'badge-bullish',
    neutral: 'badge-neutral',
    bearish: 'badge-bearish',
  }
  return <span className={classes[sentiment]}>{sentiment}</span>
}

export default function ExpertInsightsPanel({ insights, grades, currentAvgPrice }: ExpertInsightsPanelProps) {
  const getGrade = (id: number) => grades.find(g => g.id === id)

  if (insights.length === 0) {
    return (
      <div className="card-dark">
        <div className="text-sm font-semibold text-white mb-3">Expert Insights</div>
        <div className="text-slate-500 text-sm text-center py-6">
          No expert insights available. Add insights via Data Ingestion.
        </div>
      </div>
    )
  }

  return (
    <div className="card-dark">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-white">Expert Insights</div>
        <span className="text-xs text-slate-500">{insights.length} insights</span>
      </div>

      <div className="space-y-3">
        {insights.map(insight => {
          const grade = getGrade(insight.grade_id)
          const range = insight.price_forecast_high - insight.price_forecast_low
          const currentPct = currentAvgPrice && range > 0
            ? Math.max(0, Math.min(100, ((currentAvgPrice - insight.price_forecast_low) / range) * 100))
            : null

          return (
            <div key={insight.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-brand-400 bg-brand-900/30 border border-brand-700/30 px-2 py-0.5 rounded">
                    {insight.source}
                  </span>
                  {grade && (
                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                      {grade.name}
                    </span>
                  )}
                  <SentimentBadge sentiment={insight.sentiment} />
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {format(parseISO(insight.date), 'MMM d, yyyy')}
                </span>
              </div>

              {/* Price range visualization */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Price Forecast Range</span>
                  <span className="font-semibold text-white">
                    ${insight.price_forecast_low.toFixed(0)} — ${insight.price_forecast_high.toFixed(0)}/ton
                  </span>
                </div>
                <div className="relative h-5 rounded-md overflow-visible">
                  {/* Range bar */}
                  <div
                    className="absolute inset-0 rounded-md"
                    style={{
                      background: insight.sentiment === 'bullish'
                        ? 'linear-gradient(to right, #065f46, #10b981)'
                        : insight.sentiment === 'bearish'
                          ? 'linear-gradient(to right, #7f1d1d, #ef4444)'
                          : 'linear-gradient(to right, #78350f, #f59e0b)',
                      opacity: 0.3,
                    }}
                  />

                  {/* Current price marker */}
                  {currentPct !== null && (
                    <div
                      className="absolute top-0 bottom-0 flex items-center justify-center -translate-x-1/2"
                      style={{ left: `${currentPct}%` }}
                    >
                      <div className="w-0.5 h-full bg-white/50" />
                      <div className="absolute top-0 w-3 h-3 bg-white rounded-full -translate-y-0.5 -translate-x-1/2 left-1/2 shadow-lg" />
                    </div>
                  )}
                </div>
                {currentPct !== null && (
                  <div className="text-xs text-slate-500 mt-1">
                    Current avg price ${currentAvgPrice?.toFixed(0)} is{' '}
                    {currentAvgPrice! < insight.price_forecast_low
                      ? 'below'
                      : currentAvgPrice! > insight.price_forecast_high
                        ? 'above'
                        : 'within'}{' '}
                    the forecast range
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                <span className="text-red-400">${insight.price_forecast_low}/t floor</span>
                <span className="text-emerald-400">${insight.price_forecast_high}/t ceiling</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
