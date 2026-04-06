'use client'

import { useState } from 'react'
import type { PricingRecommendation, Grade } from '@/types'
import PriceBand from '@/components/ui/PriceBand'
import ConfidenceScore from '@/components/ui/ConfidenceScore'
import clsx from 'clsx'

interface DecisionLayerProps {
  recommendations: PricingRecommendation[]
  grades: Grade[]
  marketName: string
}

export default function DecisionLayer({ recommendations, grades, marketName }: DecisionLayerProps) {
  const [selectedGradeId, setSelectedGradeId] = useState<number>(recommendations[0]?.gradeId ?? grades[0]?.id ?? 1)

  const rec = recommendations.find(r => r.gradeId === selectedGradeId) || recommendations[0]
  const selectedGrade = grades.find(g => g.id === selectedGradeId)

  if (!rec) {
    return (
      <div className="card-dark p-6 text-slate-400 text-center">
        No pricing data available. Add orders and competitor prices to generate recommendations.
      </div>
    )
  }

  const priceDiff = rec.priceMid - rec.currentAvgPrice
  const priceDiffPct = rec.currentAvgPrice > 0 ? (priceDiff / rec.currentAvgPrice) * 100 : 0
  const hasLowConfidence = rec.confidenceScore < 60
  const meetingConflict = rec.riskFlags.some(r => r.toLowerCase().includes('conflict'))

  const recommendedAction = rec.priceband === 'high' ? 'INCREASE' : rec.priceband === 'low' ? 'REDUCE' : 'HOLD'

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-900/40 to-slate-900 border-b border-slate-700 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pricing Decision</div>
            <h2 className="text-xl font-bold text-white">
              {marketName} — {selectedGrade?.name || 'All Grades'}
            </h2>
          </div>

          {/* Grade selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Grade:</span>
            <select
              value={selectedGradeId}
              onChange={e => setSelectedGradeId(parseInt(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {recommendations.map(r => (
                <option key={r.gradeId} value={r.gradeId}>{r.gradeName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Warning banners */}
      {hasLowConfidence && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-yellow-900/20 border-b border-yellow-700/30 text-yellow-300 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 17c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Low confidence score ({rec.confidenceScore}/100) — verify inputs for best accuracy
        </div>
      )}
      {meetingConflict && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-orange-900/20 border-b border-orange-700/30 text-orange-300 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Meeting notes conflict with model direction — review recent signals
        </div>
      )}

      <div className="p-5 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Metric Cards */}
        <div className="xl:col-span-2 space-y-5">
          {/* Price metrics row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Recommended Price */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Recommended Price</div>
              <div className="text-3xl font-bold text-white">${rec.priceMid.toFixed(0)}</div>
              <div className="text-xs text-slate-500 mt-1">/ton USD</div>
              <div className={clsx(
                'flex items-center gap-1 mt-2 text-sm font-medium',
                priceDiff > 0 ? 'text-emerald-400' : priceDiff < 0 ? 'text-red-400' : 'text-slate-400'
              )}>
                {priceDiff > 0 ? '▲' : priceDiff < 0 ? '▼' : '—'}
                {Math.abs(priceDiffPct).toFixed(1)}% vs current
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Current avg: ${rec.currentAvgPrice.toFixed(0)}
              </div>
            </div>

            {/* Volume Impact */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Expected Volume Impact</div>
              <div className={clsx(
                'text-3xl font-bold',
                rec.expectedVolumeImpact >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {rec.expectedVolumeImpact >= 0 ? '+' : ''}{rec.expectedVolumeImpact.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">vs previous period</div>
              <div className="text-xs text-slate-500 mt-2">
                Estimated elasticity: -0.5
              </div>
            </div>

            {/* Margin Impact */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Expected Margin Impact</div>
              <div className={clsx(
                'text-3xl font-bold',
                rec.expectedMarginImpact >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {rec.expectedMarginImpact >= 0 ? '+' : ''}{rec.expectedMarginImpact.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">vs previous period</div>
              <div className="text-xs text-slate-500 mt-2">
                Margin amplification ~0.7x
              </div>
            </div>
          </div>

          {/* Price Band */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-4">Price Band Visualization</div>
            <PriceBand
              low={rec.priceLow}
              mid={rec.priceMid}
              high={rec.priceHigh}
              current={rec.currentAvgPrice}
              recommended={rec.priceMid}
            />
          </div>

          {/* Drivers & Risks */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Top Price Drivers</div>
              <ol className="space-y-2">
                {rec.topDrivers.slice(0, 5).map((driver, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-brand-400 font-semibold shrink-0">{i + 1}.</span>
                    <span className="text-slate-300">{driver}</span>
                  </li>
                ))}
                {rec.topDrivers.length === 0 && (
                  <li className="text-slate-500 text-sm">No specific drivers identified</li>
                )}
              </ol>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Risk Flags</div>
              <ul className="space-y-2">
                {rec.riskFlags.slice(0, 5).map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 17c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-slate-300">{risk}</span>
                  </li>
                ))}
                {rec.riskFlags.length === 0 && (
                  <li className="flex items-center gap-2 text-slate-500 text-sm">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    No risk flags identified
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Right: Confidence + Decision */}
        <div className="flex flex-col gap-5">
          {/* Confidence Score */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex flex-col items-center">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-4">Confidence Score</div>
            <ConfidenceScore score={rec.confidenceScore} size={96} />
            <div className="mt-4 text-center text-xs text-slate-500 leading-relaxed">
              {rec.confidenceScore >= 70 && 'High confidence — sufficient data across all sources'}
              {rec.confidenceScore >= 40 && rec.confidenceScore < 70 && 'Moderate confidence — some data gaps present'}
              {rec.confidenceScore < 40 && 'Low confidence — insufficient data, add more inputs'}
            </div>
          </div>

          {/* Pricing Decision Buttons */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-4">Pricing Decision</div>
            <div className="space-y-2">
              {(['REDUCE', 'HOLD', 'INCREASE'] as const).map(action => {
                const isRecommended = action === recommendedAction
                return (
                  <button
                    key={action}
                    className={clsx(
                      'w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all border',
                      isRecommended
                        ? action === 'INCREASE'
                          ? 'bg-emerald-700 text-white border-emerald-500 shadow-lg shadow-emerald-900/50 ring-2 ring-emerald-500/30'
                          : action === 'REDUCE'
                            ? 'bg-red-800 text-white border-red-600 shadow-lg shadow-red-900/50 ring-2 ring-red-500/30'
                            : 'bg-brand-700 text-white border-brand-500 shadow-lg shadow-brand-900/50 ring-2 ring-brand-500/30'
                        : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700 hover:text-slate-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{action}</span>
                      {isRecommended && (
                        <span className="text-xs opacity-80">Recommended</span>
                      )}
                    </div>
                    {isRecommended && (
                      <div className="text-xs mt-1 opacity-80 text-left">
                        {action === 'INCREASE' && `Target: $${rec.priceHigh.toFixed(0)}/ton`}
                        {action === 'REDUCE' && `Target: $${rec.priceLow.toFixed(0)}/ton`}
                        {action === 'HOLD' && `Target: $${rec.priceMid.toFixed(0)}/ton`}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Reasoning */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Model Reasoning</div>
            <p className="text-xs text-slate-400 leading-relaxed">{rec.reasoning}</p>
          </div>

          {/* AI-derived signals explanation */}
          {rec.topDrivers.some(d => d.startsWith('AI')) || rec.riskFlags.some(r => r.startsWith('AI')) ? (
            <div className="bg-brand-900/15 border border-brand-700/25 rounded-xl p-4">
              <div className="text-xs text-brand-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="text-xs font-bold bg-brand-700/40 px-1.5 py-0.5 rounded">AI</span>
                AI-Interpreted Field Intelligence
              </div>
              <div className="space-y-1.5">
                {rec.topDrivers
                  .filter(d => d.startsWith('AI') || d.toLowerCase().includes('ai analysis') || d.toLowerCase().includes('ai-interpreted') || d.toLowerCase().includes('ai detected'))
                  .map((line, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-emerald-500 shrink-0 mt-0.5">▲</span>{line}
                    </div>
                  ))}
                {rec.riskFlags
                  .filter(r => r.startsWith('AI') || r.toLowerCase().includes('ai analysis') || r.toLowerCase().includes('ai-interpreted') || r.toLowerCase().includes('ai flagged') || r.toLowerCase().includes('ai detected'))
                  .map((line, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-amber-500 shrink-0 mt-0.5">!</span>{line}
                    </div>
                  ))}
              </div>
              <div className="text-xs text-slate-600 mt-2 pt-2 border-t border-brand-700/20">
                AI provides interpretation only. The rules engine above is the final pricing source.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
