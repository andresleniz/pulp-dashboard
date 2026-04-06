'use client'

import { useState, useRef } from 'react'
import type { MeetingNote, Customer, Market } from '@/types'
import type { AnalyzedText } from '@/lib/ai/aiSchemas'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import AIAnalysisPanel from '@/components/ai/AIAnalysisPanel'

interface MeetingNotesPanelProps {
  notes: MeetingNote[]
  market: Market
  customers: Customer[]
  onNoteAdded?: (note: MeetingNote) => void
  onAISignalSaved?: (record: AnalyzedText) => void
}

const SOURCE_TYPES = [
  { value: 'customer_meeting', label: 'Customer Meeting' },
  { value: 'internal_meeting', label: 'Internal Meeting' },
  { value: 'agent_call', label: 'Agent Call' },
]

const TAG_OPTIONS = [
  'customer', 'competitor', 'demand', 'price_pressure', 'supply_issue',
]

export default function MeetingNotesPanel({ notes, market, customers, onNoteAdded, onAISignalSaved }: MeetingNotesPanelProps) {
  const [activeTab, setActiveTab] = useState<'note' | 'ai'>('note')
  const [sourceType, setSourceType] = useState<'customer_meeting' | 'internal_meeting' | 'agent_call'>('customer_meeting')
  const [customerId, setCustomerId] = useState<string>('')
  const [rawText, setRawText] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.name.endsWith('.txt') || file.type === 'text/plain') {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        setRawText(prev => prev ? `${prev}\n\n--- Imported from ${file.name} ---\n${text}` : text)
        toast.success(`Loaded ${file.name}`)
      }
      reader.onerror = () => toast.error('Failed to read file')
      reader.readAsText(file)
    } else if (file.name.endsWith('.docx')) {
      toast.error('.docx not supported — please paste the text directly or save as .txt first')
    } else {
      toast.error('Only .txt files are supported for upload')
    }
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const handleSubmit = async () => {
    if (!rawText.trim()) {
      toast.error('Please enter meeting notes text')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/meeting-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_id: market.id,
          customer_id: customerId ? parseInt(customerId) : undefined,
          date,
          source_type: sourceType,
          raw_text: rawText,
          tags: selectedTags,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const newNote = await res.json() as MeetingNote
      toast.success('Meeting note saved and analyzed')
      onNoteAdded?.(newNote)
      setRawText('')
      setSelectedTags([])
      setCustomerId('')
    } catch {
      toast.error('Failed to save meeting note')
    } finally {
      setSubmitting(false)
    }
  }

  const recentNotes = [...notes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)

  const sentimentBadge = (s: 'bullish' | 'neutral' | 'bearish') => {
    const c = { bullish: 'badge-bullish', neutral: 'badge-neutral', bearish: 'badge-bearish' }
    return <span className={c[s]}>{s}</span>
  }

  return (
    <div className="card-dark space-y-5">
      {/* Tab selector */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setActiveTab('note')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            activeTab === 'note' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Add Meeting Note
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'ai' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span className="text-xs font-bold">AI</span>
          Analyze with AI
        </button>
      </div>

      {/* AI analysis tab */}
      {activeTab === 'ai' && (
        <AIAnalysisPanel
          marketId={market.id}
          defaultSourceType="meeting_note"
          onSaved={record => {
            onAISignalSaved?.(record)
            toast.success('AI signal saved — review in AI Market Intelligence panel')
          }}
        />
      )}

      {/* Standard note form */}
      {activeTab === 'note' && <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Source Type</label>
            <select
              value={sourceType}
              onChange={e => setSourceType(e.target.value as typeof sourceType)}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {SOURCE_TYPES.map(st => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {sourceType === 'customer_meeting' && (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Customer (optional)</label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400">Meeting Notes</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
              title="Upload a .txt file"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload .txt
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder="Describe the meeting: pricing discussions, customer signals, demand outlook, competitor mentions..."
            rows={5}
            className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none placeholder-slate-600"
          />
          <div className="text-xs text-slate-600 mt-1">
            Sentiment and signals will be extracted automatically using keyword analysis
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-2">Tags</label>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-brand-600 border-brand-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                }`}
              >
                {tag.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !rawText.trim()}
          className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? 'Analyzing...' : 'Save & Analyze Note'}
        </button>
      </div>}

      {/* Recent notes */}
      {recentNotes.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 border-t border-slate-700 pt-4">
            Recent Notes
          </div>
          <div className="space-y-2">
            {recentNotes.map(note => {
              const customer = customers.find(c => c.id === note.customer_id)
              return (
                <div key={note.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {SOURCE_TYPES.find(st => st.value === note.source_type)?.label}
                      </span>
                      {customer && <span className="text-xs text-slate-500">· {customer.name}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {sentimentBadge(note.extracted_sentiment)}
                      <span className="text-xs text-slate-600">
                        {format(parseISO(note.date), 'MMM d')}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{note.raw_text}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
