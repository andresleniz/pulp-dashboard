'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MarketSummary } from '@/types'
import clsx from 'clsx'

interface MarketHeatmapProps {
  summaries: MarketSummary[]
}

interface RegionBox {
  id: number
  name: string
  x: number
  y: number
  width: number
  height: number
}

const REGIONS: RegionBox[] = [
  { id: 3, name: 'North America', x: 30, y: 60, width: 180, height: 120 },
  { id: 2, name: 'Europe', x: 280, y: 55, width: 160, height: 110 },
  { id: 4, name: 'LATAM', x: 90, y: 210, width: 140, height: 120 },
  { id: 1, name: 'China', x: 530, y: 80, width: 150, height: 110 },
  { id: 5, name: 'Asia Pacific', x: 610, y: 210, width: 160, height: 110 },
]

function getSentimentColor(sentiment: 'bullish' | 'neutral' | 'bearish' | undefined): string {
  if (sentiment === 'bullish') return '#064e3b'
  if (sentiment === 'bearish') return '#450a0a'
  return '#422006'
}

function getSentimentBorder(sentiment: 'bullish' | 'neutral' | 'bearish' | undefined): string {
  if (sentiment === 'bullish') return '#10b981'
  if (sentiment === 'bearish') return '#ef4444'
  return '#f59e0b'
}

function getPressureArrow(pressure: 'up' | 'flat' | 'down' | undefined): string {
  if (pressure === 'up') return '▲'
  if (pressure === 'down') return '▼'
  return '—'
}

export default function MarketHeatmap({ summaries }: MarketHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ region: RegionBox; summary: MarketSummary | undefined } | null>(null)

  const getSummary = (id: number) => summaries.find(s => s.market.id === id)

  return (
    <div className="relative w-full" style={{ paddingBottom: '52%' }}>
      <div className="absolute inset-0">
        <svg
          viewBox="0 0 800 380"
          className="w-full h-full"
          style={{ background: '#0d1117' }}
        >
          {/* Ocean background */}
          <rect x="0" y="0" width="800" height="380" fill="#0a1628" rx="12" />

          {/* Grid lines */}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={380} stroke="#1e293b" strokeWidth={0.5} />
          ))}
          {Array.from({ length: 4 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 95} x2={800} y2={i * 95} stroke="#1e293b" strokeWidth={0.5} />
          ))}

          {/* Region boxes */}
          {REGIONS.map(region => {
            const summary = getSummary(region.id)
            const fillColor = getSentimentColor(summary?.sentiment)
            const borderColor = getSentimentBorder(summary?.sentiment)

            return (
              <g key={region.id}>
                <rect
                  x={region.x}
                  y={region.y}
                  width={region.width}
                  height={region.height}
                  rx={8}
                  fill={fillColor}
                  stroke={borderColor}
                  strokeWidth={1.5}
                  className="cursor-pointer"
                  onMouseEnter={() => setTooltip({ region, summary })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ opacity: 0.9 }}
                />

                {/* Market name */}
                <text
                  x={region.x + region.width / 2}
                  y={region.y + 28}
                  textAnchor="middle"
                  fill="white"
                  fontSize="13"
                  fontWeight="600"
                  className="pointer-events-none select-none"
                >
                  {region.name}
                </text>

                {/* Price */}
                {summary && (
                  <>
                    <text
                      x={region.x + region.width / 2}
                      y={region.y + 54}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="11"
                      className="pointer-events-none select-none"
                    >
                      Avg: ${summary.currentAvgPrice.toFixed(0)}/t
                    </text>
                    <text
                      x={region.x + region.width / 2}
                      y={region.y + 72}
                      textAnchor="middle"
                      fill={borderColor}
                      fontSize="12"
                      fontWeight="500"
                      className="pointer-events-none select-none"
                    >
                      Rec: ${summary.recommendedPrice.toFixed(0)}/t {getPressureArrow(summary.pricePressure)}
                    </text>

                    {/* Confidence bar */}
                    <rect
                      x={region.x + 10}
                      y={region.y + 84}
                      width={region.width - 20}
                      height={6}
                      rx={3}
                      fill="#1e293b"
                      className="pointer-events-none"
                    />
                    <rect
                      x={region.x + 10}
                      y={region.y + 84}
                      width={(region.width - 20) * (summary.confidence / 100)}
                      height={6}
                      rx={3}
                      fill={borderColor}
                      className="pointer-events-none"
                    />
                    <text
                      x={region.x + region.width / 2}
                      y={region.y + 100}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="9"
                      className="pointer-events-none select-none"
                    >
                      Confidence {summary.confidence}%
                    </text>
                  </>
                )}
              </g>
            )
          })}

          {/* Tooltip */}
          {tooltip && tooltip.summary && (
            <g>
              <rect
                x={Math.min(tooltip.region.x + tooltip.region.width + 8, 680)}
                y={tooltip.region.y}
                width={160}
                height={100}
                rx={6}
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={1}
              />
              <text
                x={Math.min(tooltip.region.x + tooltip.region.width + 18, 690)}
                y={tooltip.region.y + 20}
                fill="white"
                fontSize="12"
                fontWeight="600"
              >
                {tooltip.region.name}
              </text>
              <text
                x={Math.min(tooltip.region.x + tooltip.region.width + 18, 690)}
                y={tooltip.region.y + 38}
                fill="#94a3b8"
                fontSize="10"
              >
                Sentiment: {tooltip.summary.sentiment}
              </text>
              <text
                x={Math.min(tooltip.region.x + tooltip.region.width + 18, 690)}
                y={tooltip.region.y + 54}
                fill="#94a3b8"
                fontSize="10"
              >
                Avg Price: ${tooltip.summary.currentAvgPrice.toFixed(0)}/t
              </text>
              <text
                x={Math.min(tooltip.region.x + tooltip.region.width + 18, 690)}
                y={tooltip.region.y + 70}
                fill="#94a3b8"
                fontSize="10"
              >
                Rec: ${tooltip.summary.recommendedPrice.toFixed(0)}/t
              </text>
              <text
                x={Math.min(tooltip.region.x + tooltip.region.width + 18, 690)}
                y={tooltip.region.y + 86}
                fill="#94a3b8"
                fontSize="10"
              >
                Confidence: {tooltip.summary.confidence}%
              </text>
            </g>
          )}
        </svg>

        {/* Clickable overlays (for navigation) */}
        <div className="absolute inset-0">
          {REGIONS.map(region => {
            const pctX = (region.x / 800) * 100
            const pctY = (region.y / 380) * 100
            const pctW = (region.width / 800) * 100
            const pctH = (region.height / 380) * 100
            return (
              <Link
                key={region.id}
                href={`/markets/${region.id}`}
                className="absolute"
                style={{
                  left: `${pctX}%`,
                  top: `${pctY}%`,
                  width: `${pctW}%`,
                  height: `${pctH}%`,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-4 flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-900 border border-emerald-500" />
          <span>Bullish</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-900 border border-amber-500" />
          <span>Neutral</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-900 border border-red-500" />
          <span>Bearish</span>
        </div>
        <span className="text-slate-600">| Click region to view market</span>
      </div>
    </div>
  )
}
