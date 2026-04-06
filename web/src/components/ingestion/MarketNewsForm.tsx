'use client'

import { useState } from 'react'
import type { Market } from '@/types'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface MarketNewsFormProps {
  markets: Market[]
}

export default function MarketNewsForm({ markets }: MarketNewsFormProps) {
  const [form, setForm] = useState({
    market_id: '',
    title: '',
    summary: '',
    sentiment: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.market_id || !form.title || !form.sentiment || !form.date) {
      toast.error('Please fill in all required fields')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/market-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_id: parseInt(form.market_id),
          title: form.title,
          summary: form.summary || undefined,
          sentiment: form.sentiment,
          date: form.date,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Market news item saved')
      setForm(prev => ({ ...prev, title: '', summary: '', sentiment: '' }))
    } catch {
      toast.error('Failed to save news item')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card-dark max-w-xl">
      <h3 className="text-sm font-semibold text-white mb-1">Add Market News</h3>
      <p className="text-xs text-slate-400 mb-5">Record a market news item or intelligence signal that affects pricing.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Headline *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => handleChange('title', e.target.value)}
            placeholder="e.g., Chinese paper mills increase pulp orders ahead of Q4..."
            required
            className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-600"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Summary</label>
          <textarea
            value={form.summary}
            onChange={e => handleChange('summary', e.target.value)}
            placeholder="Brief description of the news item and its market implications..."
            rows={4}
            className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none placeholder-slate-600"
          />
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
          {submitting ? 'Saving...' : 'Save News Item'}
        </button>
      </form>
    </div>
  )
}
