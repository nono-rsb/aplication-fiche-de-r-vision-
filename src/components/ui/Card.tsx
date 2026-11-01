import type { HTMLAttributes } from 'react'

export const Card = ({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div
    {...rest}
    className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-night-900 dark:shadow-none dark:ring-night-800 ${className}`}
  />
)
