import { Link } from 'react-router-dom'
import { CloudDownload, FileText, Star } from 'lucide-react'
import { isNew, type SheetItem } from './api'

interface Props {
  sheet: SheetItem
  favorite?: boolean
  offline?: boolean
  showSubject?: boolean
}

export const SheetListItem = ({ sheet, favorite, offline, showSubject = true }: Props) => (
  <Link
    to={`/fiches/${sheet.id}`}
    className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200 transition-colors active:bg-slate-50 dark:bg-night-900 dark:ring-night-800 dark:active:bg-night-800"
  >
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: sheet.subject.color }}>
      <FileText className="size-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5">
        <span className="truncate font-semibold">{sheet.title}</span>
        {isNew(sheet) && <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">Nouveau</span>}
      </span>
      <span className="block truncate text-sm text-slate-500 dark:text-slate-400">
        {showSubject ? `${sheet.subject.icon} ${sheet.subject.name} · ` : ''}
        {sheet.chapter.title}
      </span>
    </span>
    <span className="flex shrink-0 items-center gap-1 text-slate-400">
      {offline && <CloudDownload className="size-4 text-emerald-500" aria-label="Disponible hors ligne" />}
      {favorite && <Star className="size-4 fill-amber-400 text-amber-400" aria-label="Favori" />}
    </span>
  </Link>
)
