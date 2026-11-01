import { useParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { useCatalog, useFavorites } from './api'
import { SheetListItem } from './SheetListItem'
import { useOfflineIndex } from '@/lib/offline'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { FullPageSpinner } from '@/components/ui/Spinner'

export const SubjectPage = () => {
  const { subjectId } = useParams()
  const { catalog, isLoading } = useCatalog()
  const favorites = useFavorites()
  const offline = useOfflineIndex()
  if (isLoading) return <FullPageSpinner />
  const subject = catalog?.subjects.find((s) => s.id === subjectId)
  if (!catalog || !subject) return <EmptyState icon={<FileText className="size-7" />} title="Matière introuvable" />

  const chapters = catalog.chapters.filter((c) => c.subject_id === subject.id)
  return (
    <div className="pb-6">
      <PageHeader title={`${subject.icon} ${subject.name}`} back="/fiches" subtitle={`${chapters.length} chapitre${chapters.length > 1 ? 's' : ''}`} />
      {chapters.length === 0 && <EmptyState icon={<FileText className="size-7" />} title="Aucun chapitre pour l'instant" />}
      <div className="space-y-6">
        {chapters.map((c, i) => {
          const sheets = catalog.sheets.filter((s) => s.chapter_id === c.id)
          return (
            <section key={c.id}>
              <h2 className="mb-2 flex items-baseline gap-2 font-semibold">
                <span className="text-sm font-bold" style={{ color: subject.color }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {c.title}
              </h2>
              <div className="space-y-2">
                {sheets.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-night-700 dark:text-slate-400">Pas encore de fiche pour ce chapitre.</p>
                ) : (
                  sheets.map((s) => <SheetListItem key={s.id} sheet={s} showSubject={false} favorite={favorites.has(s.id)} offline={Boolean(offline[s.id])} />)
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
