import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Copy, Link2, Plus, RefreshCw, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { frError } from '@/lib/errors'
import type { ClassRow, ProfileRow } from '@/lib/database.types'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const copy = async (text: string, toast: ReturnType<typeof useToast>, label: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast(`${label} copié`)
  } catch {
    toast(text, 'info')
  }
}

const useClassesData = () =>
  useQuery({
    queryKey: ['admin', 'classes'],
    queryFn: async () => {
      const [classes, profiles] = await Promise.all([
        supabase.from('classes').select('*').order('created_at'),
        supabase.from('profiles').select('*').order('pseudo'),
      ])
      if (classes.error) throw classes.error
      if (profiles.error) throw profiles.error
      return { classes: classes.data, profiles: profiles.data }
    },
  })

const StudentsModal = ({ cls, classes, students, onClose }: { cls: ClassRow; classes: ClassRow[]; students: ProfileRow[]; onClose: () => void }) => {
  const qc = useQueryClient()
  const toast = useToast()
  const { profile: me } = useAuth()
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProfileRow> }) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'classes'] }),
    onError: (e) => toast(frError(e), 'error'),
  })
  return (
    <Modal open onClose={onClose} title={`Élèves — ${cls.name}`}>
      {students.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun élève pour l'instant. Partage le code d'invitation !</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-night-800">
          {students.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${s.is_blocked ? 'text-red-500 line-through' : ''}`}>
                  {s.pseudo} {s.role === 'admin' && <span className="ml-1 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] text-white uppercase">admin</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {s.xp_total} XP · inscrit le {new Date(s.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              {s.id !== me?.id && (
                <>
                  <select
                    aria-label="Changer de classe"
                    value={s.class_id ?? ''}
                    onChange={(e) => update.mutate({ id: s.id, patch: { class_id: e.target.value } })}
                    className="max-w-32 rounded-lg bg-slate-100 px-2 py-1.5 text-sm dark:bg-night-800"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant={s.is_blocked ? 'secondary' : 'danger'}
                    className="min-h-9 px-3 py-1.5 text-sm"
                    icon={<Ban className="size-4" />}
                    onClick={() => update.mutate({ id: s.id, patch: { is_blocked: !s.is_blocked } })}
                  >
                    {s.is_blocked ? 'Débloquer' : 'Bloquer'}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

export const AdminClasses = () => {
  const { data, isLoading } = useClassesData()
  const qc = useQueryClient()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [studentsOf, setStudentsOf] = useState<ClassRow | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'classes'] })
  const onError = (e: unknown) => toast(frError(e), 'error')

  const create = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from('classes').insert({ name: n })
      if (error) throw error
    },
    onSuccess: () => {
      refresh()
      setCreating(false)
      setName('')
      toast('Classe créée')
    },
    onError,
  })
  const toggleOpen = useMutation({
    mutationFn: async (c: ClassRow) => {
      const { error } = await supabase.from('classes').update({ is_open: !c.is_open }).eq('id', c.id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError,
  })
  const regenerate = useMutation({
    mutationFn: async (c: ClassRow) => {
      const { error } = await supabase.rpc('regenerate_invite_code', { p_class_id: c.id })
      if (error) throw error
    },
    onSuccess: () => {
      refresh()
      toast('Nouveau code généré')
    },
    onError,
  })

  if (isLoading || !data) return <FullPageSpinner />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) create.mutate(name.trim())
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Classes"
        back="/admin"
        action={
          <Button className="min-h-10 px-3" icon={<Plus className="size-5" />} onClick={() => setCreating(true)}>
            Créer
          </Button>
        }
      />
      {data.classes.map((c) => {
        const students = data.profiles.filter((p) => p.class_id === c.id)
        const link = `${window.location.origin}/inscription?code=${c.invite_code}`
        return (
          <Card key={c.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-bold">{c.name}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {students.length} membre{students.length > 1 ? 's' : ''} · inscriptions {c.is_open ? 'ouvertes' : 'fermées'}
                </p>
              </div>
              <button onClick={() => toggleOpen.mutate(c)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.is_open ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-night-800 dark:text-slate-400'}`}>
                {c.is_open ? 'Ouverte' : 'Fermée'}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-night-800">
              <span className="flex-1 font-mono text-xl font-bold tracking-[0.2em]">{c.invite_code}</span>
              <button onClick={() => copy(c.invite_code, toast, 'Code')} className="rounded-lg p-2 hover:bg-white dark:hover:bg-night-700" aria-label="Copier le code">
                <Copy className="size-5" />
              </button>
              <button onClick={() => copy(link, toast, 'Lien')} className="rounded-lg p-2 hover:bg-white dark:hover:bg-night-700" aria-label="Copier le lien d'inscription">
                <Link2 className="size-5" />
              </button>
              <button
                onClick={() => confirm('Générer un nouveau code ? L’ancien ne fonctionnera plus.') && regenerate.mutate(c)}
                className="rounded-lg p-2 hover:bg-white dark:hover:bg-night-700"
                aria-label="Régénérer le code"
              >
                <RefreshCw className="size-5" />
              </button>
            </div>
            <Button variant="secondary" full icon={<Users className="size-5" />} onClick={() => setStudentsOf(c)}>
              Voir les élèves
            </Button>
          </Card>
        )
      })}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle classe">
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nom de la classe" name="name" placeholder="ex. 1re G3" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} hint="Un code d'invitation sera généré automatiquement." />
          <Button type="submit" full loading={create.isPending}>
            Créer la classe
          </Button>
        </form>
      </Modal>

      {studentsOf && (
        <StudentsModal cls={studentsOf} classes={data.classes} students={data.profiles.filter((p) => p.class_id === studentsOf.id)} onClose={() => setStudentsOf(null)} />
      )}
    </div>
  )
}
