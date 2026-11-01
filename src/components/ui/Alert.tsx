import type { ReactNode } from 'react'

const tones = {
  error: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900',
  info: 'bg-brand-50 text-brand-800 ring-brand-200 dark:bg-night-800 dark:text-brand-100 dark:ring-night-700',
}

export const Alert = ({ tone = 'info', children }: { tone?: keyof typeof tones; children: ReactNode }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3.5 py-3 text-sm ring-1 ${tones[tone]}`}>
    {children}
  </div>
)
