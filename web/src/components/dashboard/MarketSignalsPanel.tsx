'use client'

import type { MeetingNote } from '@/types'
import { format, parseISO } from 'date-fns'
import TrafficLight from '@/components/ui/TrafficLight'

interface MarketSignalsPanelProps {
  notes: MeetingNote[]
}

const SOURCE_LABELS: Record<string, string> = {
  customer_meeting: 'Customer Meeting',
  internal_meeting: 'Internal Meeting',
  agent_call: 'Agent Call',
}

const SIGNAL_LABELS: Record<string, string> = {
  price_resistance: 'Price Resistance',
  competitor_increasing: 'Comp. Increasing',
  tight_supply: 'Tight Supply',
  demand_shift: 'Demand Shift',
  price_mention: 'Price Discussed',
  competitor_mention: 'Competitor Ref.',
}

const SIGNAL_COLORS: Record<string, string> = {
  price_resistance: 'bg-red-900/40 text-red-300 border-red-700/30',
  competitor_increasing: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/30',
  tight_supply: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/30',
  demand_shift: 'bg-blue-900/40 text-blue-300 border-blue-700/30',
  price_mention: 'bg-slate-700 text-slate-300 border-slate-600',
  competitor_mention: 'bg-orange-900/40 text-orange-300 border-orange-700/30',
}

export default function MarketSignalsPanel({ notes }: MarketSignalsPanelProps) {
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  // Aggregate sentiment
  const sentimentCounts = { bullish: 0, neutral: 0, bearish: 0 }
  for (const note of notes) sentimentCounts[note.extracted_sentiment]++

  const dominant = Object.entries(sentimentCounts).sort(([, a], [, b]) => b - a)[0]?.[0] as 'bullish' | 'neutral' | 'bearish' | undefined

  return (
    <div className="card-dark space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Latest Market Signals</div>
        <span className="text-xs text-slate-500">{notes.length} notes</span>
      </div>

      {/* Aggregate sentiment */}
      {notes.length > 0 && (
        <div className="flex items-center justify-between bg-slate-800 rounded-lg p-3 border border-slate-700">
          <span className="text-xs text-slate-400">Overall Signal Sentiment</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-emerald-400">▲ {sentimentCounts.bullish}</span>
              <span className="text-yellow-400">— {sentimentCounts.neutral}</span>
              <span className="text-red-400">▼ {sentimentCounts.bearish}</span>
            </div>
            {dominant && (
              <span className={`text-xs font-semibold ${
                dominant === 'bullish' ? 'text-emerald-400' :
                dominant === 'bearish' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {dominant.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Signal list */}
      {sorted.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-6">
          No meeting notes yet. Add notes using the panel on the left.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(note => (
            <div key={note.id} className="flex items-start gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
              <div className="shrink-0 mt-0.5">
                <TrafficLight
                  status={
                    note.extracted_sentiment === 'bullish' ? 'green' :
                    note.extracted_sentiment === 'bearish' ? 'red' : 'yellow'
                  }
                  size="sm"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300 font-medium">
                      {SOURCE_LABELS[note.source_type] || note.source_type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600">
                    {format(parseISO(note.date), 'MMM d, yyyy')}
                  </span>
                </div>

                {/* Extracted signals as pills */}
                {note.extracted_signals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {note.extracted_signals.map((signal, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          SIGNAL_COLORS[signal] || 'bg-slate-700 text-slate-300 border-slate-600'
                        }`}
                      >
                        {SIGNAL_LABELS[signal] || signal}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-slate-500 line-clamp-2">{note.raw_text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
