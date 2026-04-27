import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number          // 0–100
  className?: string
  barClassName?: string
  size?: 'sm' | 'md'
}

export function Progress({ value, className, barClassName, size = 'sm' }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className={cn(
        'w-full rounded-full bg-bg-elevated overflow-hidden progress-glow',
        size === 'sm' ? 'h-1' : 'h-2',
        className
      )}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', barClassName ?? 'bg-primary glow-primary')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
