'use client'

import { useState } from 'react'
import type { Market, Grade } from '@/types'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface ExpertInsightFormProps {
  markets: Market[]
  grades: Grade[]
}

const SOURCES = ['RISI', 'TTO', 'Wood Mackenzie', 'FOEX', 'Other']

export default function ExpertInsightForm({ markets, grades }: ExpertInsightFormProps) {
  const [form, setForm] = useState({
    source: '',
    market_id: '',
    grade_id: '',
    price_forecast_low: '',
    price_forecast_high: '',
    sentiment: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.source || !form.market_id || !form.grade_id || !form.price_forecast_low || !form.price_forecast_high || !form.sentiment || !form.date) {
      toast.error('Please fill in all required fields')
      return
    }

    const low = parseFloat(form.price_forecast_low)
    const high = parseFloat(form.price_forecast_high)
    if (low >= high) {
      toast.error('Forecast low must be less than forecast high')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/expert-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: form.source,
          market_id: parseInt(form.market_id),
          grade_id: parseInt(form.grade_id),
          price_forecast_low: low,
          price_forecast_high: high,
          sentiment: form.sentiment,
          date: form.date,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Expert insight saved')
      setForm(prev => ({ ...prev, price_forecast_low: '', price_forecast_high: '', source: '' }))
    } catch {
      toast.error('Failed to save expert insight')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card-dark max-w-xl">
      <h3 className="text-sm font-semibold text-white mb-1">Add Expert Insight</h3>
      <p className="text-xs text-slate-400 mb-5">Record a price forecast from an industry expert or publication.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Source *</label>
            <select
              value={form.source}
              onChange={e => handleChange('source', e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select source...</option>
              {SOURCES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => handleChange('date', e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Market *</label>
            <select
              value={form.market_id}
              onChange={e => handleChange('market_id', e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select market...</option>
              {markets.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Grade *</label>
            <select
              value={form.grade_id}
              onChange={e => handleChange('grade_id', e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select grade...</option>
              {grades.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Forecast Low (USD/ton) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                value={form.price_forecast_low}
                onChange={e => handleChange('price_forecast_low', e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
                className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Forecast High (USD/ton) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                value={form.price_forecast_high}
                onChange={e => handleChange('price_forecast_high', e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
                className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Sentiment *</label>
          <div className="flex gap-3">
            {(['bullish', 'neutral', 'bearish'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => handleChange('sentiment', s)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                  form.sentiment === s
                    ? s === 'bullish' ? 'bg-emerald-700 border-emerald-500 text-white'
                      : s === 'bearish' ? 'bg-red-800 border-red-600 text-white'
                      : 'bg-yellow-700 border-yellow-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? 'Saving...' : 'Save Expert Insight'}
        </button>
      </form>
    </div>
  )
}
