import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="font-bold text-text-dim tracking-widest uppercase" style={{fontSize:'0.6rem'}}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-8 w-full border border-border bg-bg-elevated px-3 text-xs text-text-base font-mono',
            'placeholder:text-text-dim',
            'focus:outline-none focus:border-primary',
            'transition-colors',
            error && 'border-danger focus:border-danger',
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-text-muted" style={{fontSize:'0.6rem'}}>{hint}</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
