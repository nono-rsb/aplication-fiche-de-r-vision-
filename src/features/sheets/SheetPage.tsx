import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CloudDownload, FileText, MessageCircleQuestion, Star } from 'lucide-react'
import { useCatalog, useFavorites } from './api'
import { PdfViewer } from './PdfViewer'
import { getPdfData, removeOffline, saveOffline, useOfflineIndex, formatSize } from '@/lib/offline'
import { supabase } from '@/lib/supabase'
import { frError } from '@/lib/errors'
import { formatDate, parisToday } from '@/lib/dates'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { AiQuizTeaser } from '@/features/ai-quiz/AiQuizTeaser'

const ActionButton = ({ active, onClick, icon, label, busy }: { active?: boolean; onClick: () => void; icon: ReactNode; label: string; busy?: boolean }) => (
  <button
    onClick={onClick}
    disabled={busy}
    className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition-colors ${
      active
        ? 'bg-brand-600 text-white ring-brand-600'
        : 'bg-white text-slate-700 ring-slate-200 dark:bg-night-900 dark:text-slate-200 dark:ring-night-800'
    }`}
  >
    {busy ? <Spinner className="size-4" /> : icon}
    {label}
  </button>
)

export const SheetPage = () => {
  const { sheetId } = useParams()
  const { catalog, isLoading } = useCatalog()
  const favorites = useFavorites()
  const offlineIndex = useOfflineIndex()
  const online = useOnlineStatus()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const sheet = sheetId ? catalog?.sheetById.get(sheetId) : undefined
  const offlineEntry = sheetId ? offlineIndex[sheetId] : undefined
  // Hors ligne et sans catalogue en cache : on se rabat sur l'index local.
  const fileRef = sheet ?? (offlineEntry && { id: offlineEntry.id, file_path: '', updated_at: offlineEntry.version })

  const pdf = useQuery({
    queryKey: ['pdf', fileRef?.id, fileRef?.updated_at],
    enabled: Boolean(fileRef),
    networkMode: 'always',
    gcTime: 60_000,
    retry: false,
    queryFn: () => getPdfData(fileRef!),
  })

  useEffect(() => {
    if (sheetId && online && sheet) supabase.rpc('record_sheet_view', { p_sheet_id: sheetId }).then(() => {})
  }, [sheetId, online, sheet])

  if (isLoading && !offlineEntry) return <FullPageSpinner />
  if (!fileRef) return <EmptyState icon={<FileText className="size-7" />} title="Fiche introuvable">Elle a peut-être été retirée.</EmptyState>

  const title = sheet?.title ?? offlineEntry!.title
  const fav = sheet ? favorites.has(sheet.id) : false

  const toggleOffline = async () => {
    if (offlineEntry) {
      await removeOffline(fileRef.id)
      toast('Fiche retirée de l’appareil', 'info')
      return
    }
    if (!sheet) return
    setSaving(true)
    try {
      await saveOffline(sheet, { title: sheet.title, subject: sheet.subject.name, chapter: sheet.chapter.title, color: sheet.subject.color, icon: sheet.subject.icon })
      toast('Disponible hors ligne ✓')
    } catch (e) {
      toast(frError(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title={title}
        back
        subtitle={sheet ? `${sheet.subject.icon} ${sheet.subject.name} · ${sheet.chapter.title}` : offlineEntry && `${offlineEntry.subject} · ${offlineEntry.chapter}`}
      />

      <div className="flex gap-2">
        {sheet && (
          <ActionButton
            active={fav}
            onClick={() => favorites.toggle.mutate({ sheetId: sheet.id, fav: !fav })}
            icon={<Star className={`size-4 ${fav ? 'fill-current' : ''}`} />}
            label={fav ? 'Favori' : 'Ajouter aux favoris'}
          />
        )}
        <ActionButton
          active={Boolean(offlineEntry)}
          busy={saving}
          onClick={toggleOffline}
          icon={offlineEntry ? <CircleCheck className="size-4" /> : <CloudDownload className="size-4" />}
          label={offlineEntry ? 'Dispo hors ligne' : 'Télécharger pour hors ligne'}
        />
      </div>

      {pdf.data?.stale && <Alert tone="info">Tu es hors ligne : c'est la version téléchargée, une version plus récente existe peut-être.</Alert>}
      {pdf.isError ? (
        <Alert tone="error">{online ? frError(pdf.error) : 'Cette fiche n’est pas téléchargée : reconnecte-toi pour l’ouvrir.'}</Alert>
      ) : pdf.data ? (
        <PdfViewer data={pdf.data.data} title={title} />
      ) : (
        <div className="flex h-60 items-center justify-center rounded-2xl bg-slate-200 text-brand-500 dark:bg-night-900">
          <Spinner />
        </div>
      )}

      {sheet && (
        <Card className="space-y-1 text-sm">
          {sheet.description && <p className="text-slate-700 dark:text-slate-200">{sheet.description}</p>}
          <p className="text-slate-500 dark:text-slate-400">
            Publiée le {formatDate(parisToday(new Date(sheet.published_at!)), { day: 'numeric', month: 'long', year: 'numeric' })} · {formatSize(sheet.file_size)}
            {sheet.page_count ? ` · ${sheet.page_count} page${sheet.page_count > 1 ? 's' : ''}` : ''}
          </p>
        </Card>
      )}

      <AiQuizTeaser />

      <Card className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <MessageCircleQuestion className="size-5 shrink-0" />
        Les questions / réponses sous chaque fiche arrivent à l'étape 7.
      </Card>
    </div>
  )
}
