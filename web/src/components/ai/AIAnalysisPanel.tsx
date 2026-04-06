'use client'

/**
 * AIAnalysisPanel
 *
 * Handles all 4 AI analysis use cases:
 *   1. Meeting note analysis
 *   2. Market news analysis
 *   3. Expert report excerpt analysis
 *   4. Internal note analysis
 *
 * Human-in-the-loop flow:
 *   paste text → Analyze → review extracted signals → edit if needed → Confirm & Save
 *
 * Confirmed records feed the pricing engine. Unreviewed records do NOT.
 */

import { useState } from 'react'
import type { AnalyzedText, ExtractedSignal } from '@/lib/ai/aiSchemas'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface AIAnalysisPanelProps {
  marketId: number
  customerId?: number
  gradeId?: number
  defaultSourceType?: AnalyzedText['source_type']
  onSaved?: (record: AnalyzedText) => void
}

const SOURCE_TYPE_LABELS: Record<AnalyzedText['source_type'], string> = {
  meeting_note: 'Meeting Note',
  market_news: 'Market News',
  expert_report: 'Expert Report Excerpt',
  internal_note: 'Internal Note',
}

const SENTIMENT_COLORS = {
  bullish: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
  neutral: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40',
  bearish: 'text-red-400 bg-red-900/30 border-red-700/40',
}

const SIGNAL_COLORS = {
  stronger: 'text-emerald-400',
  tighter: 'text-emerald-400',
  upward: 'text-emerald-400',
  low: 'text-yellow-400',
  weaker: 'text-red-400',
  looser: 'text-red-400',
  downward: 'text-red-400',
  high: 'text-red-400',
  unchanged: 'text-slate-400',
  normal: 'text-slate-400',
  flat: 'text-slate-400',
  unclear: 'text-slate-500',
}

type Stage = 'input' | 'reviewing' | 'saved'

export default function AIAnalysisPanel({
  marketId,
  customerId,
  gradeId,
  defaultSourceType = 'meeting_note',
  onSaved,
}: AIAnalysisPanelProps) {
  const [sourceType, setSourceType] = useState<AnalyzedText['source_type']>(defaultSourceType)
  const [text, setText] = useState('')
  const [stage, setStage] = useState<Stage>('input')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)

  // AI output
  const [record, setRecord] = useState<AnalyzedText | null>(null)
  const [editedSignal, setEditedSignal] = useState<ExtractedSignal | null>(null)

  // ── Analysis ────────────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!text.trim()) { toast.error('Paste some text first'); return }
    setAnalyzing(true)
    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          source_type: sourceType,
          market_id: marketId,
          customer_id: customerId,
          grade_id: gradeId,
        }),
      })
      const data = await res.json() as {
        ai_available?: boolean
        success?: boolean
        error?: string
        record?: AnalyzedText
      }

      if (!data.ai_available) {
        toast.error('AI not configured — set ANTHROPIC_API_KEY in your environment')
        return
      }
      if (!data.success || !data.record) {
        toast.error(data.error || 'AI extraction failed')
        return
      }

      setRecord(data.record)
      setEditedSignal(data.record.ai_output_json ? { ...data.record.ai_output_json } : null)
      setStage('reviewing')
    } catch {
      toast.error('Network error — could not reach AI service')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Confirm & Save ───────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!record || !editedSignal) return
    setSaving(true)
    try {
      const isEdited = JSON.stringify(editedSignal) !== JSON.stringify(record.ai_output_json)
      const res = await fetch('/api/ai/analyzed-texts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          review_status: 'approved',
          user_corrected_json: isEdited ? editedSignal : null,
          final_structured_json: editedSignal,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json() as AnalyzedText
      toast.success('Analysis confirmed and saved — pricing engine will use this signal')
      setStage('saved')
      onSaved?.(updated)
    } catch {
      toast.error('Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = async () => {
    if (!record) return
    await fetch('/api/ai/analyzed-texts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: record.id, review_status: 'rejected' }),
    })
    toast('Analysis discarded')
    resetForm()
  }

  const resetForm = () => {
    setText('')
    setRecord(null)
    setEditedSignal(null)
    setStage('input')
  }

  // ── Signal field editor helpers ──────────────────────────────────────────────

  const updateField = <K extends keyof ExtractedSignal>(key: K, value: ExtractedSignal[K]) => {
    setEditedSignal(prev => prev ? { ...prev, [key]: value } : prev)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (stage === 'saved') {
    return (
      <div className="card-dark text-center py-8 space-y-3">
        <div className="text-emerald-400 text-lg font-semibold">Analysis saved</div>
        <div className="text-slate-400 text-sm">This signal is now feeding the pricing engine.</div>
        <button
          onClick={resetForm}
          className="mt-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
        >
          Analyze another text
        </button>
      </div>
    )
  }

  if (stage === 'reviewing' && editedSignal && record) {
    return (
      <div className="card-dark space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Review AI Extraction</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Verify the extracted signals, edit if needed, then confirm.
              Only confirmed records affect pricing.
            </div>
          </div>
          <span className="text-xs px-2 py-1 bg-yellow-900/30 border border-yellow-700/40 text-yellow-400 rounded-full">
            Pending Review
          </span>
        </div>

        {/* Original text preview */}
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Original Text</div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 max-h-24 overflow-y-auto">
            <p className="text-xs text-slate-400 whitespace-pre-wrap">{record.raw_text}</p>
          </div>
        </div>

        {/* Ambiguity flags */}
        {editedSignal.ambiguity_flags.length > 0 && (
          <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <div className="text-xs font-semibold text-amber-400 mb-1">Ambiguity flags</div>
              <ul className="space-y-0.5">
                {editedSignal.ambiguity_flags.map((flag, i) => (
                  <li key={i} className="text-xs text-amber-300/80">· {flag}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Editable signal grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Sentiment */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Sentiment</label>
            <select
              value={editedSignal.sentiment}
              onChange={e => updateField('sentiment', e.target.value as ExtractedSignal['sentiment'])}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="bullish">Bullish</option>
              <option value="neutral">Neutral</option>
              <option value="bearish">Bearish</option>
            </select>
          </div>

          {/* Sentiment confidence */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Sentiment Confidence: {editedSignal.sentiment_confidence}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={editedSignal.sentiment_confidence}
              onChange={e => updateField('sentiment_confidence', parseInt(e.target.value))}
              className="w-full accent-brand-500 mt-1"
            />
          </div>

          {/* Demand */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Demand Signal</label>
            <select
              value={editedSignal.demand_signal}
              onChange={e => updateField('demand_signal', e.target.value as ExtractedSignal['demand_signal'])}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="stronger">Stronger</option>
              <option value="unchanged">Unchanged</option>
              <option value="weaker">Weaker</option>
              <option value="unclear">Unclear</option>
            </select>
          </div>

          {/* Supply */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Supply Signal</label>
            <select
              value={editedSignal.supply_signal}
              onChange={e => updateField('supply_signal', e.target.value as ExtractedSignal['supply_signal'])}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="tighter">Tighter</option>
              <option value="unchanged">Unchanged</option>
              <option value="looser">Looser</option>
              <option value="unclear">Unclear</option>
            </select>
          </div>

          {/* Price pressure */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Price Pressure</label>
            <select
              value={editedSignal.price_pressure_signal}
              onChange={e => updateField('price_pressure_signal', e.target.value as ExtractedSignal['price_pressure_signal'])}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="upward">Upward</option>
              <option value="flat">Flat</option>
              <option value="downward">Downward</option>
              <option value="unclear">Unclear</option>
            </select>
          </div>

          {/* Inventory */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Inventory Signal</label>
            <select
              value={editedSignal.inventory_signal}
              onChange={e => updateField('inventory_signal', e.target.value as ExtractedSignal['inventory_signal'])}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="unclear">Unclear</option>
            </select>
          </div>
        </div>

        {/* Summary */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">AI Summary</label>
          <textarea
            value={editedSignal.summary_short}
            onChange={e => updateField('summary_short', e.target.value)}
            rows={2}
            className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
          />
        </div>

        {/* Key themes & price mentions preview */}
        <div className="grid grid-cols-2 gap-3">
          {editedSignal.key_themes.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Key Themes</div>
              <div className="flex flex-wrap gap-1">
                {editedSignal.key_themes.map((t, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-brand-900/40 border border-brand-700/30 text-brand-300 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          {editedSignal.extracted_price_mentions.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Price Mentions</div>
              <div className="space-y-0.5">
                {editedSignal.extracted_price_mentions.map((p, i) => (
                  <div key={i} className="text-xs text-white">
                    <span className="font-semibold">{p.currency} {p.value}/{p.unit}</span>
                    <span className="text-slate-500 ml-1">({p.context})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Competitors & competitors actions */}
        {(editedSignal.competitors_mentioned.length > 0 || editedSignal.competitor_action_signal.length > 0) && (
          <div>
            <div className="text-xs text-slate-400 mb-1">Competitor Intelligence</div>
            <div className="space-y-1">
              {editedSignal.competitor_action_signal.map((a, i) => (
                <div key={i} className="text-xs text-slate-300">· {a}</div>
              ))}
              {editedSignal.competitors_mentioned.length > 0 && (
                <div className="text-xs text-slate-500">
                  Mentioned: {editedSignal.competitors_mentioned.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Model info */}
        <div className="text-xs text-slate-600">
          Model: {record.ai_model ?? 'unknown'} · Prompt: {record.prompt_version}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-700">
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Confirm & Feed to Pricing Engine'}
          </button>
          <button
            onClick={handleDiscard}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    )
  }

  // ── Input stage ──────────────────────────────────────────────────────────────
  return (
    <div className="card-dark space-y-4">
      <div>
        <div className="text-sm font-semibold text-white mb-0.5">Analyze with AI</div>
        <div className="text-xs text-slate-500">
          Paste any commercial text. AI extracts structured signals for your review.
          You review and confirm before it affects pricing.
        </div>
      </div>

      {/* Source type */}
      <div>
        <label className="text-xs text-slate-400 block mb-1">Content Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SOURCE_TYPE_LABELS) as AnalyzedText['source_type'][]).map(st => (
            <button
              key={st}
              onClick={() => setSourceType(st)}
              className={clsx(
                'text-xs px-3 py-2 rounded-lg border transition-colors text-left',
                sourceType === st
                  ? 'bg-brand-700/50 border-brand-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600',
              )}
            >
              {SOURCE_TYPE_LABELS[st]}
            </button>
          ))}
        </div>
      </div>

      {/* Text input */}
      <div>
        <label className="text-xs text-slate-400 block mb-1">Text to Analyze</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={7}
          placeholder={
            sourceType === 'meeting_note'
              ? 'Paste meeting notes: pricing discussions, customer signals, demand outlook...'
              : sourceType === 'market_news'
              ? 'Paste market news article or headline...'
              : sourceType === 'expert_report'
              ? 'Paste excerpt from TTO / RISI / Fastmarkets / AFRY report...'
              : 'Paste internal commercial note or intelligence...'
          }
          className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none placeholder-slate-600"
        />
        <div className="text-xs text-slate-600 mt-1">
          {text.length > 0 ? `${text.length} characters` : 'Min. 50 characters recommended for useful extraction'}
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={analyzing || text.trim().length < 20}
        className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {analyzing ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a.5.5 0 00-.146.353v.05a.5.5 0 00.5.5h.025c.412 0 .75.338.75.75v.75a1.5 1.5 0 01-3 0v-.75a.75.75 0 01.75-.75h.025" />
            </svg>
            Analyze with AI
          </>
        )}
      </button>
    </div>
  )
}
