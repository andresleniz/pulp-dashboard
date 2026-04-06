'use client'

import { useState } from 'react'
import type { Market, Grade } from '@/types'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface CompetitorPriceFormProps {
  markets: Market[]
  grades: Grade[]
}

export default function CompetitorPriceForm({ markets, grades }: CompetitorPriceFormProps) {
  const [form, setForm] = useState({
    market_id: '',
    grade_id: '',
    price: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    source: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.market_id || !form.grade_id || !form.price || !form.date) {
      toast.error('Please fill in all required fields')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/competitor-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_id: parseInt(form.market_id),
          grade_id: parseInt(form.grade_id),
          price: parseFloat(form.price),
          date: form.date,
          source: form.source || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Competitor price saved')
      setForm(prev => ({ ...prev, price: '', source: '' }))
    } catch {
      toast.error('Failed to save competitor price')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card-dark max-w-xl">
      <h3 className="text-sm font-semibold text-white mb-1">Add Competitor Price</h3>
      <p className="text-xs text-slate-400 mb-5">Record a competitor's observed price for intelligence tracking.</p>

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
            <label className="text-xs text-slate-400 block mb-1.5">Price (USD/ton) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                value={form.price}
                onChange={e => handleChange('price', e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
                className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
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
          <label className="text-xs text-slate-400 block mb-1.5">Source / Competitor Name</label>
          <input
            type="text"
            value={form.source}
            onChange={e => handleChange('source', e.target.value)}
            placeholder="e.g., Suzano, CMPC, Fibria..."
            className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-600"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? 'Saving...' : 'Save Competitor Price'}
        </button>
      </form>
    </div>
  )
}
