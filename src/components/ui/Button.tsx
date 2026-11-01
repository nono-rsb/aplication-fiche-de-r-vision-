import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const styles: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 disabled:bg-brand-600/50',
  secondary:
    'bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-night-800 dark:text-slate-100 dark:ring-night-700 dark:hover:bg-night-700',
  ghost: 'text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-night-800',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 disabled:bg-red-600/50',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  icon?: ReactNode
  full?: boolean
}

export const Button = ({ variant = 'primary', loading, icon, full, className = '', children, disabled, ...rest }: Props) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed ${styles[variant]} ${full ? 'w-full' : ''} ${className}`}
  >
    {loading ? <Spinner className="size-4" /> : icon}
    {children}
  </button>
)
