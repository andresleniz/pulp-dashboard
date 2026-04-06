'use client'

interface PriceBandProps {
  low: number
  mid: number
  high: number
  current: number
  recommended: number
}

export default function PriceBand({ low, mid, high, current, recommended }: PriceBandProps) {
  const range = high - low
  if (range <= 0) return null

  const toPercent = (val: number) => Math.max(0, Math.min(100, ((val - low) / range) * 100))

  const currentPct = toPercent(current)
  const recommendedPct = toPercent(recommended)
  const midPct = toPercent(mid)

  return (
    <div className="w-full">
      <div className="relative h-8 rounded-lg overflow-visible">
        {/* Gradient band */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'linear-gradient(to right, #dc2626, #f59e0b, #10b981)',
            opacity: 0.25,
          }}
        />
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'linear-gradient(to right, #dc2626 0%, #f59e0b 40%, #10b981 100%)',
            opacity: 0.15,
          }}
        />

        {/* Mid marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-500/50"
          style={{ left: `${midPct}%` }}
        />

        {/* Current price marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${currentPct}%` }}
        >
          <div className="w-3 h-3 rounded-full bg-slate-400 border-2 border-slate-600 shadow-lg" />
        </div>

        {/* Recommended price marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${recommendedPct}%` }}
        >
          <div className="w-4 h-4 rounded-full bg-brand-500 border-2 border-white shadow-lg ring-2 ring-brand-500/30" />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
        <div>
          <div className="text-red-400 font-medium">${low.toFixed(0)}</div>
          <div>Floor</div>
        </div>
        <div className="text-center">
          <div className="text-slate-300 font-medium">${mid.toFixed(0)}</div>
          <div>Mid</div>
        </div>
        <div className="text-right">
          <div className="text-emerald-400 font-medium">${high.toFixed(0)}</div>
          <div>Ceiling</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-600" />
          <span>Current ${current.toFixed(0)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-brand-500 border border-white" />
          <span>Recommended ${recommended.toFixed(0)}</span>
        </div>
      </div>
    </div>
  )
}
