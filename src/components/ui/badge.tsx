import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-bg-elevated text-text-muted',
        running: 'badge-running',
        stopped: 'badge-stopped',
        starting: 'badge-starting',
        error: 'badge-error',
        primary: 'bg-primary/15 text-primary border border-primary/25',
        secondary: 'bg-secondary/15 text-secondary border border-secondary/25',
        warning: 'bg-warning/15 text-warning border border-warning/25',
        danger: 'badge-error',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'running' ? 'bg-success glow-success status-dot-running' :
            variant === 'error' ? 'bg-danger glow-danger' :
            variant === 'starting' ? 'bg-warning glow-accent' :
            'bg-text-muted'
          )}
        />
      )}
      {children}
    </span>
  )
}
