import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { AdminStats as Stats } from '@/lib/database.types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { ClassPicker, useAdminClass } from './useAdminClass'

const Tile = ({ label, value, hint }: { label: string; value: number; hint?: string }) => (
  <Card className="p-3">
    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
  </Card>
)

export const AdminStats = () => {
  const adminClass = useAdminClass()
  const { classId } = adminClass
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats', classId],
    enabled: Boolean(classId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_stats', { p_class_id: classId })
      if (error) throw error
      return data as unknown as Stats
    },
  })
  if (isLoading || !data) return <FullPageSpinner />
  const max = Math.max(1, ...data.top_sheets.map((s) => s.views))
  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="Statistiques" back="/admin" />
      <ClassPicker {...adminClass} />
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Élèves inscrits" value={data.students} />
        <Tile label="Fiches publiées" value={data.sheets} />
        <Tile label="Actifs aujourd'hui" value={data.active_today} />
        <Tile label="Actifs sur 7 jours" value={data.active_7d} hint={`${data.active_30d} sur 30 jours`} />
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Fiches les plus consultées (30 jours)</h2>
        {data.top_sheets.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Aucune consultation pour l'instant.</p>
        ) : (
          <ol className="space-y-3">
            {data.top_sheets.map((s, i) => (
              <li key={s.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <Link to={`/fiches/${s.id}`} className="truncate font-medium">
                    {i + 1}. {s.title}
                  </Link>
                  <span className="shrink-0 text-slate-500 tabular-nums dark:text-slate-400">
                    {s.views} vue{s.views > 1 ? 's' : ''} · {s.readers} élève{s.readers > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-night-800">
                  <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(s.views / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Une vue = un élève qui ouvre la fiche un jour donné.</p>
      </Card>
    </div>
  )
}
