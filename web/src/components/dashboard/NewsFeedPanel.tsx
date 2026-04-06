'use client'

import { useState } from 'react'
import type { MarketNews } from '@/types'
import { format, parseISO } from 'date-fns'
import TrafficLight from '@/components/ui/TrafficLight'
import clsx from 'clsx'

interface NewsFeedPanelProps {
  news: MarketNews[]
}

const sentimentToLight = (s: 'bullish' | 'neutral' | 'bearish'): 'green' | 'yellow' | 'red' => {
  if (s === 'bullish') return 'green'
  if (s === 'bearish') return 'red'
  return 'yellow'
}

function SentimentBadge({ sentiment }: { sentiment: 'bullish' | 'neutral' | 'bearish' }) {
  const classes = {
    bullish: 'badge-bullish',
    neutral: 'badge-neutral',
    bearish: 'badge-bearish',
  }
  return <span className={classes[sentiment]}>{sentiment}</span>
}

export default function NewsFeedPanel({ news }: NewsFeedPanelProps) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (news.length === 0) {
    return (
      <div className="card-dark">
        <div className="text-sm font-semibold text-white mb-3">Market News</div>
        <div className="text-slate-500 text-sm text-center py-6">
          No news available. Add news via Data Ingestion.
        </div>
      </div>
    )
  }

  const sorted = [...news].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="card-dark">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-white">Market News</div>
        <span className="text-xs text-slate-500">{news.length} items</span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sorted.map(item => (
          <div
            key={item.id}
            className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
          >
            <button
              className="w-full text-left p-3"
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <TrafficLight status={sentimentToLight(item.sentiment)} size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className={clsx(
                      'text-sm font-medium leading-tight',
                      expanded === item.id ? 'text-white' : 'text-slate-200 line-clamp-2'
                    )}>
                      {item.title}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <SentimentBadge sentiment={item.sentiment} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">
                      {format(parseISO(item.date), 'MMM d, yyyy')}
                    </span>
                    <svg
                      className={clsx(
                        'w-3 h-3 text-slate-500 transition-transform',
                        expanded === item.id ? 'rotate-180' : ''
                      )}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>

            {expanded === item.id && item.summary && (
              <div className="px-3 pb-3 border-t border-slate-700/50 pt-2">
                <p className="text-xs text-slate-400 leading-relaxed">{item.summary}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
