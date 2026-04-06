'use client'

/**
 * AIMarketIntelligencePanel
 *
 * Shows the AI market intelligence summary on the dashboard:
 *   - AI-generated market summary (grounded in reviewed signals)
 *   - Bullish / bearish factors from AI analysis
 *   - Competitor action signals
 *   - Recent analyzed items with review status
 *   - Ambiguity warnings
 *
 * This panel is EXPLANATORY only.
 * The rules engine remains the final pricing decision source.
 */

import { useEffect, useState } from 'react'
import type { AnalyzedText } from '@/lib/ai/aiSchemas'
import type { SentimentScore, PricingRecommendation } from '@/types'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'

interface AIMarketIntelligencePanelProps {
  marketId: number
  marketName: string
  sentimentScore: SentimentScore | null
  recommendation: PricingRecommendation | null
  onReviewComplete?: () => void
}

interface NarrativeData {
  ai_available: boolean
  marketSummary?: string
  recommendationExplanation?: string | null
  bullishFactors?: string[]
  bearishFactors?: string[]
  watchouts?: string[]
  model?: string
  error?: string
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  meeting_note: 'Meeting Note',
  market_news: 'News',
  expert_report: 'Expert Report',
  internal_note: 'Internal Note',
}

const REVIEW_STATUS_CONFIG = {
  pending_review: { label: 'Pending', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/30' },
  approved: { label: 'Approved', color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/30' },
  rejected: { label: 'Rejected', color: 'text-red-400 bg-red-900/30 border-red-700/30' },
  edited: { label: 'Edited', color: 'text-brand-400 bg-brand-900/30 border-brand-700/30' },
}

export default function AIMarketIntelligencePanel({
  marketId,
  marketName,
  sentimentScore,
  recommendation,
  onReviewComplete,
}: AIMarketIntelligencePanelProps) {
  const [records, setRecords] = useState<AnalyzedText[]>([])
  const [narrative, setNarrative] = useState<NarrativeData | null>(null)
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [loadingNarrative, setLoadingNarrative] = useState(false)
  const [narrativeLoaded, setNarrativeLoaded] = useState(false)

  // ── Load analyzed text records ───────────────────────────────────────────────
  useEffect(() => {
    setLoadingRecords(true)
    fetch(`/api/ai/analyzed-texts?marketId=${marketId}`)
      .then(r => r.json())
      .then((data: AnalyzedText[]) => {
        setRecords(Array.isArray(data) ? data.slice(0, 10) : [])
      })
      .catch(() => setRecords([]))
      .finally(() => setLoadingRecords(false))
  }, [marketId])

  // ── Generate narrative ───────────────────────────────────────────────────────
  const generateNarrative = async () => {
    if (!sentimentScore) return
    setLoadingNarrative(true)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_id: marketId,
          market_name: marketName,
          sentiment_score: sentimentScore,
          recommendation,
        }),
      })
      const data = await res.json() as NarrativeData
      setNarrative(data)
      setNarrativeLoaded(true)
    } catch {
      setNarrative({ ai_available: false, error: 'Failed to generate narrative' })
    } finally {
      setLoadingNarrative(false)
    }
  }

  // ── Quick approve/reject from panel ─────────────────────────────────────────
  const handleStatusChange = async (id: number, status: 'approved' | 'rejected') => {
    const record = records.find(r => r.id === id)
    if (!record) return

    // For approved, finalize with ai_output_json as final
    const body: Record<string, unknown> = { id, review_status: status }
    if (status === 'approved' && record.ai_output_json) {
      body.final_structured_json = record.ai_output_json
    }

    await fetch('/api/ai/analyzed-texts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setRecords(prev =>
      prev.map(r => r.id === id ? { ...r, review_status: status } : r),
    )
    onReviewComplete?.()
  }

  const approvedCount = records.filter(r => r.review_status === 'approved').length
  const pendingCount = records.filter(r => r.review_status === 'pending_review').length

  // ── Competitor actions from approved records ─────────────────────────────────
  const competitorActions = records
    .filter(r => r.review_status === 'approved' && r.final_structured_json)
    .flatMap(r => r.final_structured_json?.competitor_action_signal ?? [])
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card-dark">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="text-brand-400">AI</span> Market Intelligence
              <span className="text-xs font-normal text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">
                Interpretation layer — pricing still rules-based
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {approvedCount} approved signal{approvedCount !== 1 ? 's' : ''} · {pendingCount} pending review
            </div>
          </div>
          <button
            onClick={generateNarrative}
            disabled={loadingNarrative || !sentimentScore}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 hover:bg-brand-600 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
          >
            {loadingNarrative ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              'Generate Narrative'
            )}
          </button>
        </div>

        {/* Narrative */}
        {narrativeLoaded && narrative && (
          <div className="space-y-4">
            {!narrative.ai_available && (
              <div className="text-xs text-slate-500 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                AI narrative unavailable: {narrative.error || 'AI service not configured'}
              </div>
            )}

            {narrative.marketSummary && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Market Summary</div>
                <p className="text-sm text-slate-300 leading-relaxed">{narrative.marketSummary}</p>
              </div>
            )}

            {narrative.recommendationExplanation && (
              <div className="bg-brand-900/20 border border-brand-700/30 rounded-lg px-4 py-3">
                <div className="text-xs text-brand-400 uppercase tracking-wider mb-2">
                  AI-Interpreted Field Intelligence
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {narrative.recommendationExplanation}
                </p>
                <div className="text-xs text-slate-600 mt-2">
                  Note: the recommendation above is generated by the rules-based pricing engine, not by AI.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {(narrative.bullishFactors?.length ?? 0) > 0 && (
                <div>
                  <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Bullish Signals</div>
                  <ul className="space-y-1">
                    {narrative.bullishFactors!.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                        <span className="text-emerald-500 mt-0.5 shrink-0">▲</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(narrative.bearishFactors?.length ?? 0) > 0 && (
                <div>
                  <div className="text-xs text-red-400 uppercase tracking-wider mb-2">Bearish Signals</div>
                  <ul className="space-y-1">
                    {narrative.bearishFactors!.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                        <span className="text-red-500 mt-0.5 shrink-0">▼</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {(narrative.watchouts?.length ?? 0) > 0 && (
              <div>
                <div className="text-xs text-amber-400 uppercase tracking-wider mb-2">Watchouts</div>
                <ul className="space-y-1">
                  {narrative.watchouts!.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                      <span className="text-amber-500 mt-0.5 shrink-0">!</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!narrativeLoaded && (
          <div className="text-xs text-slate-500 text-center py-3">
            Click Generate Narrative for AI-grounded market summary
          </div>
        )}
      </div>

      {/* Competitor actions */}
      {competitorActions.length > 0 && (
        <div className="card-dark">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
            Competitor Actions (from reviewed AI signals)
          </div>
          <ul className="space-y-1.5">
            {competitorActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-amber-400 shrink-0 mt-0.5">→</span>{a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent analyzed items */}
      <div className="card-dark">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
          Recent AI-Analyzed Items
        </div>

        {loadingRecords ? (
          <div className="text-xs text-slate-500 py-3 text-center">Loading...</div>
        ) : records.length === 0 ? (
          <div className="text-xs text-slate-500 py-3 text-center">
            No analyzed texts yet. Use &quot;Analyze with AI&quot; in the Meeting Notes or News tabs.
          </div>
        ) : (
          <div className="space-y-2">
            {records.map(record => {
              const statusCfg = REVIEW_STATUS_CONFIG[record.review_status]
              const signal = record.final_structured_json ?? record.ai_output_json
              return (
                <div key={record.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400">
                        {SOURCE_TYPE_LABELS[record.source_type] ?? record.source_type}
                      </span>
                      {signal && (
                        <span className={clsx(
                          'text-xs px-1.5 py-0.5 rounded-full border capitalize',
                          signal.sentiment === 'bullish'
                            ? 'text-emerald-400 bg-emerald-900/30 border-emerald-700/30'
                            : signal.sentiment === 'bearish'
                            ? 'text-red-400 bg-red-900/30 border-red-700/30'
                            : 'text-yellow-400 bg-yellow-900/30 border-yellow-700/30',
                        )}>
                          {signal.sentiment}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={clsx('text-xs px-1.5 py-0.5 rounded-full border', statusCfg.color)}>
                        {statusCfg.label}
                      </span>
                      <span className="text-xs text-slate-600">
                        {format(parseISO(record.created_at), 'MMM d')}
                      </span>
                    </div>
                  </div>

                  {record.ai_summary_short && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-2">{record.ai_summary_short}</p>
                  )}

                  {signal?.ambiguity_flags && signal.ambiguity_flags.length > 0 && (
                    <div className="text-xs text-amber-400 mb-2">
                      ⚠ {signal.ambiguity_flags.length} ambiguity flag{signal.ambiguity_flags.length !== 1 ? 's' : ''}
                    </div>
                  )}

                  {/* Quick review actions for pending items */}
                  {record.review_status === 'pending_review' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleStatusChange(record.id, 'approved')}
                        className="flex-1 text-xs py-1 bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/60 rounded transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleStatusChange(record.id, 'rejected')}
                        className="flex-1 text-xs py-1 bg-red-900/30 border border-red-700/30 text-red-400 hover:bg-red-900/50 rounded transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
