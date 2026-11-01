import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Download, LogOut, Moon, Pencil, Shield, ShieldCheck, Trash2, Trophy } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { supabase } from '@/lib/supabase'
import { frError } from '@/lib/errors'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { useToast } from '@/components/ui/Toast'

const Row = ({ icon, label, to, onClick, right, danger }: { icon: ReactNode; label: string; to?: string; onClick?: () => void; right?: ReactNode; danger?: boolean }) => {
  const cls = `flex w-full items-center gap-3 px-4 py-3.5 text-left ${danger ? 'text-red-600 dark:text-red-400' : ''}`
  const content = (
    <>
      <span className="text-slate-500 dark:text-slate-400">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      {right ?? ((to || onClick) && <ChevronRight className="size-5 text-slate-400" />)}
    </>
  )
  if (to)
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    )
  if (onClick)
    return (
      <button onClick={onClick} className={cls}>
        {content}
      </button>
    )
  return <div className={cls}>{content}</div>
}

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-night-700'}`}
  >
    <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
  </button>
)

const themeLabels: Record<ThemePref, string> = { system: 'Auto', light: 'Clair', dark: 'Sombre' }

export const ProfilePage = () => {
  const { profile, session, isAdmin, signOut, refreshProfile } = useAuth()
  const { settings, update } = useSettings()
  const toast = useToast()
  const [theme, setTheme] = useState<ThemePref>(getThemePref)
  const [editPseudo, setEditPseudo] = useState(false)
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '')
  const [pseudoError, setPseudoError] = useState<string | null>(null)
  const [savingPseudo, setSavingPseudo] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const savePseudo = async (e: FormEvent) => {
    e.preventDefault()
    const value = pseudo.trim()
    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(value)) return setPseudoError('3 à 20 caractères : lettres sans accent, chiffres, _ . -')
    setSavingPseudo(true)
    const { error } = await supabase.from('profiles').update({ pseudo: value }).eq('id', profile!.id)
    setSavingPseudo(false)
    if (error) return setPseudoError(error.code === '23505' ? 'Ce pseudo est déjà pris.' : frError(error))
    await refreshProfile()
    setEditPseudo(false)
    toast('Pseudo modifié')
  }

  const deleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
    if (error) {
      setDeleting(false)
      return setDeleteError(frError(error))
    }
    await supabase.auth.signOut()
    toast('Ton compte et tes données ont été supprimés.', 'info')
  }

  const changeTheme = (t: ThemePref) => {
    setTheme(t)
    setThemePref(t)
  }

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="Profil" />

      <Card className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white uppercase">{profile?.pseudo.slice(0, 1)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{profile?.pseudo}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{session?.user.email}</p>
        </div>
        <button
          onClick={() => {
            setPseudo(profile?.pseudo ?? '')
            setPseudoError(null)
            setEditPseudo(true)
          }}
          className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-night-800"
          aria-label="Modifier le pseudo"
        >
          <Pencil className="size-5" />
        </button>
      </Card>

      <Card className="divide-y divide-slate-100 p-0 dark:divide-night-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <Moon className="size-5 text-slate-500 dark:text-slate-400" />
          <span className="flex-1 font-medium">Thème</span>
          <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-night-800">
            {(Object.keys(themeLabels) as ThemePref[]).map((t) => (
              <button key={t} onClick={() => changeTheme(t)} className={`rounded-md px-2.5 py-1 text-sm ${theme === t ? 'bg-white font-semibold shadow-sm dark:bg-night-700' : 'text-slate-500'}`}>
                {themeLabels[t]}
              </button>
            ))}
          </div>
        </div>
        <Row
          icon={<Trophy className="size-5" />}
          label="Apparaître dans le classement"
          right={
            <Toggle
              label="Apparaître dans le classement"
              checked={settings?.show_in_leaderboard ?? true}
              onChange={(v) => update.mutate({ show_in_leaderboard: v }, { onError: (e) => toast(frError(e), 'error') })}
            />
          }
        />
        <Row icon={<Download className="size-5" />} label="Installer l'application" to="/installer" />
      </Card>

      <p className="px-1 text-xs text-slate-500 dark:text-slate-400">Les réglages des notifications arriveront avec les notifications push (étape 9).</p>

      <Card className="divide-y divide-slate-100 p-0 dark:divide-night-800">
        {isAdmin && <Row icon={<ShieldCheck className="size-5" />} label="Espace admin" to="/admin" />}
        <Row icon={<Shield className="size-5" />} label="Confidentialité" to="/confidentialite" />
        <Row icon={<LogOut className="size-5" />} label="Se déconnecter" onClick={signOut} />
        <Row icon={<Trash2 className="size-5" />} label="Supprimer mon compte" onClick={() => setDeleteOpen(true)} danger />
      </Card>

      <Modal open={editPseudo} onClose={() => setEditPseudo(false)} title="Modifier mon pseudo">
        <form onSubmit={savePseudo} className="space-y-4">
          <Input label="Pseudo" name="pseudo" autoCapitalize="none" maxLength={20} value={pseudo} onChange={(e) => setPseudo(e.target.value)} error={pseudoError} />
          <Button type="submit" full loading={savingPseudo}>
            Enregistrer
          </Button>
        </form>
      </Modal>

      <Modal open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="Supprimer mon compte">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Ton compte, ta progression, tes favoris, tes questions et réponses seront <strong>définitivement supprimés</strong>. Les fiches que tu as proposées et qui ont été publiées restent disponibles, sans ton pseudo.
          </p>
          {deleteError && <Alert tone="error">{deleteError}</Alert>}
          <Input label='Écris « SUPPRIMER » pour confirmer' name="confirm" autoCapitalize="characters" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <Button variant="danger" full disabled={confirmText.trim().toUpperCase() !== 'SUPPRIMER'} loading={deleting} onClick={deleteAccount}>
            Supprimer définitivement
          </Button>
        </div>
      </Modal>
    </div>
  )
}
