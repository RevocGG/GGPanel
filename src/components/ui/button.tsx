import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 select-none btn-hover',
  {
    variants: {
      variant: {
        default: 'bg-primary text-bg-base hover:bg-primary/90 shadow-md shadow-primary/20 glow-primary',
        secondary: 'bg-secondary text-white hover:bg-secondary/90 shadow-md shadow-secondary/20 glow-secondary',
        ghost: 'text-text-muted hover:text-text-base hover:bg-bg-elevated',
        danger: 'bg-danger text-white hover:bg-danger/90 glow-danger',
        outline: 'border border-border text-text-base hover:border-primary hover:text-primary hover:bg-primary/5',
        success: 'bg-success text-white hover:bg-success/90 glow-success',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-5 text-sm',
        icon: 'h-8 w-8',
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
