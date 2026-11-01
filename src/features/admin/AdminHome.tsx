import { Link } from 'react-router-dom'
import { BarChart3, BookOpen, CalendarClock, ChevronRight, Flag, Inbox, Layers, School, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'

const sections: { to: string; label: string; icon: LucideIcon; step?: number }[] = [
  { to: '/admin/classes', label: 'Classes et codes d’invitation', icon: School },
  { to: '#', label: 'Matières, chapitres et fiches', icon: BookOpen, step: 2 },
  { to: '#', label: 'Flashcards', icon: Layers, step: 3 },
  { to: '#', label: 'Contrôles', icon: CalendarClock, step: 4 },
  { to: '#', label: 'Contributions à valider', icon: Inbox, step: 8 },
  { to: '#', label: 'Signalements', icon: Flag, step: 7 },
  { to: '#', label: 'Statistiques', icon: BarChart3, step: 2 },
]

export const AdminHome = () => (
  <div className="space-y-4 pb-6">
    <PageHeader title="Espace admin" back="/profil" />
    <Card className="divide-y divide-slate-100 p-0 dark:divide-night-800">
      {sections.map(({ to, label, icon: Icon, step }) =>
        step ? (
          <div key={label} className="flex items-center gap-3 px-4 py-3.5 opacity-50">
            <Icon className="size-5" />
            <span className="flex-1 font-medium">{label}</span>
            <span className="text-xs">étape {step}</span>
          </div>
        ) : (
          <Link key={label} to={to} className="flex items-center gap-3 px-4 py-3.5">
            <Icon className="size-5 text-brand-600 dark:text-brand-300" />
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight className="size-5 text-slate-400" />
          </Link>
        ),
      )}
    </Card>
  </div>
)
