'use client'

interface ConfidenceScoreProps {
  score: number
  size?: number
  showLabel?: boolean
}

export default function ConfidenceScore({ score, size = 80, showLabel = true }: ConfidenceScoreProps) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, score))
  const strokeDashoffset = circumference - (progress / 100) * circumference

  let color = '#ef4444' // red
  let label = 'Low'
  if (score >= 70) {
    color = '#10b981'
    label = 'High'
  } else if (score >= 40) {
    color = '#f59e0b'
    label = 'Med'
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={8}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-slate-400">
          Confidence: <span style={{ color }} className="font-medium">{label}</span>
        </span>
      )}
    </div>
  )
}
