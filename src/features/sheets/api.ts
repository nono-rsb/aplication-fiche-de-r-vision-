import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ChapterRow, SheetRow, SubjectRow } from '@/lib/database.types'
import { useAuth } from '@/hooks/useAuth'

export type SheetItem = SheetRow & { subject: SubjectRow; chapter: ChapterRow }

export interface Catalog {
  subjects: SubjectRow[]
  chapters: ChapterRow[]
  sheets: SheetItem[]
  sheetById: Map<string, SheetItem>
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position

/**
 * Catalogue complet de la classe (matières, chapitres, fiches publiées).
 * Une classe compte au plus quelques centaines de fiches : on charge tout en une
 * fois, ce qui rend la recherche instantanée et la navigation possible hors ligne
 * (le cache de requêtes est conservé sur l'appareil).
 */
export const useCatalog = () => {
  const { profile } = useAuth()
  const classId = profile?.class_id
  const query = useQuery({
    queryKey: ['catalog', classId],
    enabled: Boolean(classId),
    queryFn: async () => {
      const [subjects, chapters, sheets] = await Promise.all([
        supabase.from('subjects').select('*').eq('class_id', classId!),
        supabase.from('chapters').select('*').eq('class_id', classId!),
        supabase.from('sheets').select('*').eq('class_id', classId!).eq('status', 'published').order('published_at', { ascending: false }),
      ])
      for (const r of [subjects, chapters, sheets]) if (r.error) throw r.error
      return { subjects: subjects.data!, chapters: chapters.data!, sheets: sheets.data! }
    },
  })

  const catalog = useMemo<Catalog | undefined>(() => {
    if (!query.data) return undefined
    const subjects = [...query.data.subjects].sort(byPosition)
    const chapters = [...query.data.chapters].sort(byPosition)
    const subjectById = new Map(subjects.map((s) => [s.id, s]))
    const chapterById = new Map(chapters.map((c) => [c.id, c]))
    const sheets: SheetItem[] = []
    for (const s of query.data.sheets) {
      const chapter = chapterById.get(s.chapter_id)
      const subject = chapter && subjectById.get(chapter.subject_id)
      if (chapter && subject) sheets.push({ ...s, chapter, subject })
    }
    return { subjects, chapters, sheets, sheetById: new Map(sheets.map((s) => [s.id, s])) }
  }, [query.data])

  return { catalog, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

export const searchSheets = (sheets: SheetItem[], q: string) => {
  const words = normalize(q).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return sheets.filter((s) => {
    const hay = normalize(`${s.title} ${s.description ?? ''} ${s.subject.name} ${s.chapter.title}`)
    return words.every((w) => hay.includes(w))
  })
}

export const isNew = (s: Pick<SheetRow, 'published_at'>, days = 7) =>
  Boolean(s.published_at) && Date.now() - Date.parse(s.published_at!) < days * 86_400_000

// --- Favoris ---------------------------------------------------------------------
export const useFavorites = () => {
  const { session } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()
  const key = ['favorites', userId]

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('favorites').select('sheet_id').order('created_at', { ascending: false })
      if (error) throw error
      return data.map((f) => f.sheet_id)
    },
  })

  const toggle = useMutation({
    mutationFn: async ({ sheetId, fav }: { sheetId: string; fav: boolean }) => {
      const { error } = fav
        ? await supabase.from('favorites').insert({ user_id: userId!, sheet_id: sheetId })
        : await supabase.from('favorites').delete().eq('user_id', userId!).eq('sheet_id', sheetId)
      if (error && error.code !== '23505') throw error
    },
    onMutate: async ({ sheetId, fav }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<string[]>(key)
      qc.setQueryData<string[]>(key, (ids = []) => (fav ? [sheetId, ...ids] : ids.filter((i) => i !== sheetId)))
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
  })

  const ids = query.data ?? []
  return { ids, has: (id: string) => ids.includes(id), toggle }
}
