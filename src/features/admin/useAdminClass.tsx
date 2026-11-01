import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const KEY = 'admin-selected-class'

/** Classe dont l'admin gère le contenu (par défaut : la sienne). */
export const useAdminClass = () => {
  const { profile } = useAuth()
  const [selected, setSelected] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  })
  const classes = useQuery({
    queryKey: ['admin', 'class-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('id, name').order('created_at')
      if (error) throw error
      return data
    },
  })
  const list = classes.data ?? []
  const classId = list.some((c) => c.id === selected) ? selected! : (profile?.class_id ?? list[0]?.id ?? null)
  const setClassId = (id: string) => {
    setSelected(id)
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* ignore */
    }
  }
  return { classId, setClassId, classes: list }
}

export const ClassPicker = ({ classId, setClassId, classes }: ReturnType<typeof useAdminClass>) =>
  classes.length > 1 ? (
    <select
      value={classId ?? ''}
      onChange={(e) => setClassId(e.target.value)}
      aria-label="Classe"
      className="w-full rounded-xl bg-white px-3 py-2.5 font-medium ring-1 ring-slate-200 dark:bg-night-900 dark:ring-night-800"
    >
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          Classe : {c.name}
        </option>
      ))}
    </select>
  ) : null
