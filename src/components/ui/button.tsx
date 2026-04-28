import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-bold tracking-widest uppercase text-xs disabled:pointer-events-none disabled:opacity-40 select-none btn-hover border',
  {
    variants: {
      variant: {
        default: 'bg-primary border-primary/70 text-white hover:bg-primary/90 glow-primary',
        secondary: 'bg-bg-elevated border-border text-text-base hover:border-primary/50',
        ghost: 'border-transparent text-text-muted hover:text-text-base hover:bg-bg-elevated hover:border-border',
        danger: 'bg-danger border-danger/70 text-white hover:bg-danger/90 glow-danger',
        outline: 'border-border text-text-muted hover:border-primary/60 hover:text-primary',
        success: 'bg-success border-success/70 text-white hover:bg-success/90 glow-success',
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-8 px-4 text-xs',
        lg: 'h-9 px-5 text-xs',
        icon: 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && (
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
)

Button.displayName = 'Button'
