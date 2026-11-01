import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

interface Props {
  title: string
  subtitle?: ReactNode
  back?: boolean | string
  action?: ReactNode
}

export const PageHeader = ({ title, subtitle, back, action }: Props) => {
  const navigate = useNavigate()
  return (
    <header className="flex items-start gap-2 pt-5 pb-4">
      {back && (
        <button
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          className="-ml-2 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-night-800"
          aria-label="Retour"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
