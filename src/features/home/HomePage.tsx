import type { ReactNode } from 'react'
import { CalendarClock, Flame, ListChecks, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, greeting, parisToday } from '@/lib/dates'
import { Card } from '@/components/ui/Card'
import { Link } from 'react-router-dom'
import { isNew, useCatalog, useFavorites } from '@/features/sheets/api'
import { SheetListItem } from '@/features/sheets/SheetListItem'
import { useOfflineIndex } from '@/lib/offline'

const Section = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
  <section className="space-y-2">
    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
      {icon}
      {title}
    </h2>
    {children}
  </section>
)

export const HomePage = () => {
  const { profile } = useAuth()
  const { catalog } = useCatalog()
  const favorites = useFavorites()
  const offline = useOfflineIndex()
  const recent = catalog?.sheets.filter((s) => isNew(s, 14)).slice(0, 4) ?? []
  return (
    <div className="space-y-6 pb-6">
      <header className="pt-5">
        <p className="text-sm text-slate-500 capitalize dark:text-slate-400">{formatDate(parisToday())}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()} {profile?.pseudo} 👋
        </h1>
      </header>

      <Card className="flex items-center gap-4 bg-gradient-to-br from-orange-500 to-rose-500 text-white ring-0 dark:ring-0">
        <Flame className="size-10" />
        <div>
          <p className="text-3xl leading-none font-extrabold">{profile?.current_streak ?? 0}</p>
          <p className="text-sm text-white/90">jour{(profile?.current_streak ?? 0) > 1 ? 's' : ''} de suite · record {profile?.best_streak ?? 0}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xl font-bold">{profile?.xp_total ?? 0}</p>
          <p className="text-xs text-white/90">XP</p>
        </div>
      </Card>

      <Section icon={<CalendarClock className="size-4" />} title="Prochains contrôles">
        <Card className="text-sm text-slate-500 dark:text-slate-400">Les comptes à rebours « J-X » arrivent à l'étape 4.</Card>
      </Section>

      <Section icon={<ListChecks className="size-4" />} title="Ma révision du jour">
        <Card className="text-sm text-slate-500 dark:text-slate-400">Ton planning de révision automatique arrive à l'étape 4.</Card>
      </Section>

      <Section icon={<Sparkles className="size-4" />} title="Nouveautés">
        {recent.length === 0 ? (
          <Card className="text-sm text-slate-500 dark:text-slate-400">Pas de nouvelle fiche ces deux dernières semaines.</Card>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => (
              <SheetListItem key={s.id} sheet={s} favorite={favorites.has(s.id)} offline={Boolean(offline[s.id])} />
            ))}
            <Link to="/fiches" className="block py-1 text-center text-sm font-semibold text-brand-600 dark:text-brand-300">
              Toutes les fiches
            </Link>
          </div>
        )}
      </Section>
    </div>
  )
}
