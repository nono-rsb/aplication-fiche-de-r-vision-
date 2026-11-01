import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, FilePlus2, FileText, FolderPlus, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { frError } from '@/lib/errors'
import { formatSize } from '@/lib/offline'
import type { ChapterRow, SheetRow, SubjectRow } from '@/lib/database.types'
import { countPdfPages } from '@/features/sheets/PdfViewer'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { ClassPicker, useAdminClass } from './useAdminClass'

const MAX_SIZE = 10 * 1024 * 1024
const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b']
const ICONS = ['📘', '📐', '🧮', '🌍', '🏛️', '🧬', '⚗️', '🔬', '🇬🇧', '🇪🇸', '🇩🇪', '📖', '✍️', '🎨', '🎵', '⚽', '💻', '💶', '🧠', '⚖️']

type Content = { subjects: SubjectRow[]; chapters: ChapterRow[]; sheets: SheetRow[] }

const useContent = (classId: string | null) =>
  useQuery({
    queryKey: ['admin', 'content', classId],
    enabled: Boolean(classId),
    queryFn: async (): Promise<Content> => {
      const [subjects, chapters, sheets] = await Promise.all([
        supabase.from('subjects').select('*').eq('class_id', classId!).order('position'),
        supabase.from('chapters').select('*').eq('class_id', classId!).order('position'),
        supabase.from('sheets').select('*').eq('class_id', classId!).eq('status', 'published').order('created_at'),
      ])
      for (const r of [subjects, chapters, sheets]) if (r.error) throw r.error
      return { subjects: subjects.data!, chapters: chapters.data!, sheets: sheets.data! }
    },
  })

const IconButton = ({ label, onClick, children, danger }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) => (
  <button
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-night-800 ${danger ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}
  >
    {children}
  </button>
)

// --- Formulaires ---------------------------------------------------------------

const SubjectForm = ({ initial, onSubmit, busy }: { initial?: SubjectRow; onSubmit: (v: { name: string; icon: string; color: string }) => void; busy: boolean }) => {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '📘')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSubmit({ name: name.trim(), icon, color })
      }}
    >
      <Input label="Nom" name="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Mathématiques" required />
      <div>
        <p className="mb-1.5 text-sm font-medium">Icône</p>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button type="button" key={i} onClick={() => setIcon(i)} className={`size-10 rounded-lg text-xl ${icon === i ? 'bg-brand-100 ring-2 ring-brand-500 dark:bg-night-700' : 'bg-slate-100 dark:bg-night-800'}`}>
              {i}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Couleur</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} className={`size-9 rounded-full ${color === c ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-night-900' : ''}`} style={{ backgroundColor: c, ['--tw-ring-color' as string]: c }} />
          ))}
        </div>
      </div>
      <Button type="submit" full loading={busy}>
        Enregistrer
      </Button>
    </form>
  )
}

const ChapterForm = ({ initial, onSubmit, busy }: { initial?: string; onSubmit: (title: string) => void; busy: boolean }) => {
  const [title, setTitle] = useState(initial ?? '')
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim()) onSubmit(title.trim())
      }}
    >
      <Input label="Titre du chapitre" name="title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      <Button type="submit" full loading={busy}>
        Enregistrer
      </Button>
    </form>
  )
}

interface SheetFormValues {
  chapterId: string
  title: string
  description: string
  file: File | null
}

const SheetForm = ({ content, initial, defaultChapter, onSubmit, busy }: { content: Content; initial?: SheetRow; defaultChapter?: string; onSubmit: (v: SheetFormValues) => void; busy: boolean }) => {
  const [chapterId, setChapterId] = useState(initial?.chapter_id ?? defaultChapter ?? content.chapters[0]?.id ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!chapterId) return setError('Crée d’abord un chapitre.')
    if (!title.trim()) return setError('Le titre est obligatoire.')
    if (!initial && !file) return setError('Choisis un fichier PDF.')
    if (file && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setError('Le fichier doit être un PDF.')
    if (file && file.size > MAX_SIZE) return setError(`Fichier trop lourd (${formatSize(file.size)}) : 10 Mo maximum.`)
    onSubmit({ chapterId, title: title.trim(), description: description.trim(), file })
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {error && <Alert tone="error">{error}</Alert>}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Chapitre</span>
        <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-slate-300 dark:bg-night-900 dark:ring-night-700">
          {content.subjects.map((s) => (
            <optgroup key={s.id} label={`${s.icon} ${s.name}`}>
              {content.chapters
                .filter((c) => c.subject_id === s.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <Input label="Titre" name="title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} required />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Description (facultatif)</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className="block w-full rounded-xl bg-white px-3.5 py-3 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500 focus:outline-none dark:bg-night-900 dark:ring-night-700" />
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 dark:border-night-700">
        <Upload className="size-6 text-brand-500" />
        <span className="min-w-0 flex-1 text-sm">
          {file ? (
            <>
              <strong className="block truncate">{file.name}</strong>
              {formatSize(file.size)}
            </>
          ) : initial ? (
            'Remplacer le PDF (facultatif)'
          ) : (
            'Choisir un PDF (10 Mo max)'
          )}
        </span>
        <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <Button type="submit" full loading={busy}>
        {initial ? 'Enregistrer' : 'Publier la fiche'}
      </Button>
    </form>
  )
}

// --- Page ----------------------------------------------------------------------

type ModalState =
  | { kind: 'subject'; subject?: SubjectRow }
  | { kind: 'chapter'; subjectId: string; chapter?: ChapterRow }
  | { kind: 'sheet'; sheet?: SheetRow; chapterId?: string }
  | null

export const AdminContent = () => {
  const adminClass = useAdminClass()
  const { classId } = adminClass
  const { data: content, isLoading } = useContent(classId)
  const qc = useQueryClient()
  const toast = useToast()
  const [modal, setModal] = useState<ModalState>(null)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'content'] })
    qc.invalidateQueries({ queryKey: ['catalog'] })
  }
  const onError = (e: unknown) => toast(frError(e), 'error')

  const removeFiles = async (paths: string[]) => {
    if (paths.length) await supabase.storage.from('sheets').remove(paths)
  }

  const saveSubject = useMutation({
    mutationFn: async (v: { name: string; icon: string; color: string }) => {
      const current = modal?.kind === 'subject' ? modal.subject : undefined
      const { error } = current
        ? await supabase.from('subjects').update(v).eq('id', current.id)
        : await supabase.from('subjects').insert({ ...v, class_id: classId!, position: (content?.subjects.at(-1)?.position ?? 0) + 1 })
      if (error) throw error
    },
    onSuccess: () => {
      refresh()
      setModal(null)
      toast('Matière enregistrée')
    },
    onError,
  })

  const saveChapter = useMutation({
    mutationFn: async (title: string) => {
      if (modal?.kind !== 'chapter') return
      const siblings = content!.chapters.filter((c) => c.subject_id === modal.subjectId)
      const { error } = modal.chapter
        ? await supabase.from('chapters').update({ title }).eq('id', modal.chapter.id)
        : await supabase.from('chapters').insert({ title, subject_id: modal.subjectId, position: (siblings.at(-1)?.position ?? 0) + 1 })
      if (error) throw error
    },
    onSuccess: () => {
      refresh()
      setModal(null)
      toast('Chapitre enregistré')
    },
    onError,
  })

  const saveSheet = useMutation({
    mutationFn: async (v: SheetFormValues) => {
      const current = modal?.kind === 'sheet' ? modal.sheet : undefined
      let file: { file_path: string; file_size: number; page_count: number | null } | null = null
      if (v.file) {
        const path = `published/${classId}/${crypto.randomUUID()}.pdf`
        const { error } = await supabase.storage.from('sheets').upload(path, v.file, { contentType: 'application/pdf', upsert: false })
        if (error) throw error
        file = { file_path: path, file_size: v.file.size, page_count: await countPdfPages(await v.file.arrayBuffer()) }
      }
      const fields = { chapter_id: v.chapterId, title: v.title, description: v.description || null, ...(file ?? {}) }
      const { error } = current
        ? await supabase.from('sheets').update(fields).eq('id', current.id)
        : await supabase.from('sheets').insert({ ...fields, file_path: file!.file_path, file_size: file!.file_size, status: 'published' })
      if (error) {
        if (file) await removeFiles([file.file_path])
        throw error
      }
      if (current && file) await removeFiles([current.file_path])
    },
    onSuccess: () => {
      refresh()
      setModal(null)
      toast('Fiche enregistrée')
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: async (target: { table: 'subjects' | 'chapters' | 'sheets'; id: string }) => {
      // Les fichiers PDF ne sont pas supprimés par la cascade SQL : on les retire d'abord.
      const sheets = content!.sheets.filter((s) => {
        if (target.table === 'sheets') return s.id === target.id
        const chapter = content!.chapters.find((c) => c.id === s.chapter_id)
        return target.table === 'chapters' ? s.chapter_id === target.id : chapter?.subject_id === target.id
      })
      const { error } = await supabase.from(target.table).delete().eq('id', target.id)
      if (error) throw error
      await removeFiles(sheets.map((s) => s.file_path))
    },
    onSuccess: () => {
      refresh()
      toast('Supprimé', 'info')
    },
    onError,
  })

  const move = useMutation({
    mutationFn: async ({ table, list, index, dir }: { table: 'subjects' | 'chapters'; list: { id: string }[]; index: number; dir: -1 | 1 }) => {
      const ordered = [...list]
      const [item] = ordered.splice(index, 1)
      ordered.splice(index + dir, 0, item)
      const results = await Promise.all(ordered.map((x, i) => supabase.from(table).update({ position: i + 1 }).eq('id', x.id)))
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onSuccess: refresh,
    onError,
  })

  const confirmDelete = (label: string, target: { table: 'subjects' | 'chapters' | 'sheets'; id: string }) => {
    if (confirm(`Supprimer ${label} ? C'est définitif${target.table !== 'sheets' ? ' et supprime aussi tout ce qu’il contient' : ''}.`)) remove.mutate(target)
  }

  if (isLoading || !content) return <FullPageSpinner />

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Contenu"
        subtitle="Matières, chapitres et fiches"
        back="/admin"
        action={
          <Button className="min-h-10 px-3" icon={<FilePlus2 className="size-5" />} onClick={() => setModal({ kind: 'sheet' })} disabled={content.chapters.length === 0}>
            Fiche
          </Button>
        }
      />
      <ClassPicker {...adminClass} />

      {content.subjects.length === 0 && (
        <EmptyState icon={<FolderPlus className="size-7" />} title="Commence par créer une matière">
          Puis ajoute des chapitres, et enfin tes fiches PDF.
        </EmptyState>
      )}

      {content.subjects.map((subject, si) => {
        const chapters = content.chapters.filter((c) => c.subject_id === subject.id)
        return (
          <Card key={subject.id} className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: `${subject.color}33` }}>
                {subject.icon}
              </span>
              <h2 className="min-w-0 flex-1 truncate font-bold">{subject.name}</h2>
              <IconButton label="Monter" onClick={() => si > 0 && move.mutate({ table: 'subjects', list: content.subjects, index: si, dir: -1 })}>
                <ArrowUp className="size-4" />
              </IconButton>
              <IconButton label="Descendre" onClick={() => si < content.subjects.length - 1 && move.mutate({ table: 'subjects', list: content.subjects, index: si, dir: 1 })}>
                <ArrowDown className="size-4" />
              </IconButton>
              <IconButton label="Modifier la matière" onClick={() => setModal({ kind: 'subject', subject })}>
                <Pencil className="size-4" />
              </IconButton>
              <IconButton label="Supprimer la matière" danger onClick={() => confirmDelete(`la matière « ${subject.name} »`, { table: 'subjects', id: subject.id })}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>

            {chapters.map((chapter, ci) => {
              const sheets = content.sheets.filter((s) => s.chapter_id === chapter.id)
              return (
                <div key={chapter.id} className="rounded-xl bg-slate-50 p-2 dark:bg-night-950/60">
                  <div className="flex items-center gap-1">
                    <p className="min-w-0 flex-1 truncate pl-1 text-sm font-semibold">{chapter.title}</p>
                    <IconButton label="Monter" onClick={() => ci > 0 && move.mutate({ table: 'chapters', list: chapters, index: ci, dir: -1 })}>
                      <ArrowUp className="size-4" />
                    </IconButton>
                    <IconButton label="Descendre" onClick={() => ci < chapters.length - 1 && move.mutate({ table: 'chapters', list: chapters, index: ci, dir: 1 })}>
                      <ArrowDown className="size-4" />
                    </IconButton>
                    <IconButton label="Renommer le chapitre" onClick={() => setModal({ kind: 'chapter', subjectId: subject.id, chapter })}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton label="Supprimer le chapitre" danger onClick={() => confirmDelete(`le chapitre « ${chapter.title} »`, { table: 'chapters', id: chapter.id })}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                  <ul className="mt-1 space-y-1">
                    {sheets.map((sheet) => (
                      <li key={sheet.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 dark:bg-night-900">
                        <FileText className="size-4 shrink-0" style={{ color: subject.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{sheet.title}</span>
                          <span className="block text-xs text-slate-500">
                            {formatSize(sheet.file_size)}
                            {sheet.page_count ? ` · ${sheet.page_count} p.` : ''}
                          </span>
                        </span>
                        <IconButton label="Modifier la fiche" onClick={() => setModal({ kind: 'sheet', sheet })}>
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton label="Supprimer la fiche" danger onClick={() => confirmDelete(`la fiche « ${sheet.title} »`, { table: 'sheets', id: sheet.id })}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => setModal({ kind: 'sheet', chapterId: chapter.id })} className="mt-1 flex items-center gap-1 px-1 py-1 text-sm font-medium text-brand-600 dark:text-brand-300">
                    <Plus className="size-4" /> Fiche
                  </button>
                </div>
              )
            })}
            <button onClick={() => setModal({ kind: 'chapter', subjectId: subject.id })} className="flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-300">
              <Plus className="size-4" /> Ajouter un chapitre
            </button>
          </Card>
        )
      })}

      <Button variant="secondary" full icon={<FolderPlus className="size-5" />} onClick={() => setModal({ kind: 'subject' })}>
        Nouvelle matière
      </Button>

      <Modal open={modal?.kind === 'subject'} onClose={() => setModal(null)} title={modal?.kind === 'subject' && modal.subject ? 'Modifier la matière' : 'Nouvelle matière'}>
        {modal?.kind === 'subject' && <SubjectForm initial={modal.subject} onSubmit={(v) => saveSubject.mutate(v)} busy={saveSubject.isPending} />}
      </Modal>
      <Modal open={modal?.kind === 'chapter'} onClose={() => setModal(null)} title={modal?.kind === 'chapter' && modal.chapter ? 'Renommer le chapitre' : 'Nouveau chapitre'}>
        {modal?.kind === 'chapter' && <ChapterForm initial={modal.chapter?.title} onSubmit={(t) => saveChapter.mutate(t)} busy={saveChapter.isPending} />}
      </Modal>
      <Modal open={modal?.kind === 'sheet'} onClose={() => !saveSheet.isPending && setModal(null)} title={modal?.kind === 'sheet' && modal.sheet ? 'Modifier la fiche' : 'Nouvelle fiche'}>
        {modal?.kind === 'sheet' && <SheetForm content={content} initial={modal.sheet} defaultChapter={modal.chapterId} onSubmit={(v) => saveSheet.mutate(v)} busy={saveSheet.isPending} />}
      </Modal>
    </div>
  )
}
