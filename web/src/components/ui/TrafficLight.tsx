import clsx from 'clsx'

interface TrafficLightProps {
  status: 'green' | 'yellow' | 'red'
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function TrafficLight({ status, label, size = 'md' }: TrafficLightProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  const colorClasses = {
    green: 'bg-emerald-400 shadow-emerald-400/50',
    yellow: 'bg-yellow-400 shadow-yellow-400/50',
    red: 'bg-red-400 shadow-red-400/50',
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={clsx(
          'rounded-full shadow-lg',
          sizeClasses[size],
          colorClasses[status]
        )}
        style={{ boxShadow: `0 0 6px 1px var(--tw-shadow-color)` }}
      />
      {label && (
        <span className="text-sm text-slate-300">{label}</span>
      )}
    </div>
  )
}
