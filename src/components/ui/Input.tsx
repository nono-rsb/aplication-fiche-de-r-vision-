import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: ReactNode
  error?: string | null
}

export const Input = forwardRef<HTMLInputElement, Props>(({ label, hint, error, id, className = '', ...rest }, ref) => {
  const inputId = id ?? rest.name
  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        ref={ref}
        id={inputId}
        {...rest}
        aria-invalid={Boolean(error)}
        className={`block w-full rounded-xl border-0 bg-white px-3.5 py-3 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none dark:bg-night-900 dark:text-slate-100 dark:ring-night-700 ${error ? 'ring-red-500 dark:ring-red-500' : ''} ${className}`}
      />
      {error ? (
        <span className="mt-1 block text-sm text-red-600 dark:text-red-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{hint}</span>
      ) : null}
    </label>
  )
})
Input.displayName = 'Input'
