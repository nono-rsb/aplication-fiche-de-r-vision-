import type { ReactNode } from 'react'

export const EmptyState = ({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) => (
  <div className="flex flex-col items-center px-6 py-10 text-center">
    <div className="mb-3 rounded-2xl bg-brand-50 p-4 text-brand-600 dark:bg-night-800 dark:text-brand-300">{icon}</div>
    <h3 className="font-semibold">{title}</h3>
    {children && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{children}</div>}
  </div>
)
