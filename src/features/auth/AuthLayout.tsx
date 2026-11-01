import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookOpenCheck } from 'lucide-react'

export const AuthLayout = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
  <div className="mx-auto flex min-h-dvh max-w-sm flex-col px-5 pt-safe pb-safe">
    <div className="flex flex-1 flex-col justify-center py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 rounded-2xl bg-brand-600 p-3 text-white shadow-lg shadow-brand-600/30">
          <BookOpenCheck className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
    <p className="pb-4 text-center text-xs text-slate-500 dark:text-slate-400">
      <Link to="/confidentialite" className="underline">
        Confidentialité
      </Link>
    </p>
  </div>
)
