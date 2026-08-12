import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'on-color' | 'text-link'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
  fullWidth?: boolean
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-clay-primary text-clay-on-primary',
    'hover:bg-clay-primary-active',
    'disabled:bg-clay-primary-disabled disabled:text-clay-muted',
    'active:scale-[0.98]',
  ].join(' '),
  secondary: [
    'bg-clay-canvas text-clay-ink border border-clay-hairline',
    'hover:bg-clay-surface-soft',
    'disabled:opacity-50',
    'active:scale-[0.98]',
  ].join(' '),
  'on-color': [
    'bg-clay-canvas text-clay-ink',
    'hover:bg-clay-surface-soft',
    'disabled:opacity-50',
    'active:scale-[0.98]',
  ].join(' '),
  'text-link': [
    'bg-transparent text-clay-ink',
    'hover:text-clay-body-strong',
    'disabled:opacity-50',
    'p-0 h-auto',
  ].join(' '),
}

export function Button({
  variant = 'primary',
  children,
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'text-button inline-flex items-center justify-center gap-2',
        'rounded-[var(--radius-clay-md)] h-[44px] px-5 py-3',
        'transition-all duration-150 ease-out',
        'cursor-pointer disabled:cursor-not-allowed',
        'focus-visible:outline-2 focus-visible:outline-clay-brand-teal focus-visible:outline-offset-2',
        variantStyles[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
