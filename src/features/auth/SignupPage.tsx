import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, MailCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { frError } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

const PSEUDO_RE = /^[A-Za-z0-9_.-]{3,20}$/

export const SignupPage = () => {
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [className, setClassName] = useState<string | null>(null)
  const [pseudo, setPseudo] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accept, setAccept] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [awaitingEmail, setAwaitingEmail] = useState(false)
  const navigate = useNavigate()

  const checkCode = async () => {
    const c = code.trim().toUpperCase()
    if (!c) return null
    const { data, error } = await supabase.rpc('check_invite_code', { p_code: c })
    if (error) throw error
    setClassName(data)
    return data
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setGlobalError(null)
    const errs: Record<string, string> = {}
    if (!PSEUDO_RE.test(pseudo.trim())) errs.pseudo = '3 à 20 caractères : lettres sans accent, chiffres, _ . -'
    if (password.length < 8) errs.password = 'Au moins 8 caractères.'
    if (!accept) errs.accept = 'Merci de lire et accepter la page Confidentialité.'
    setLoading(true)
    try {
      const cls = await checkCode()
      if (!cls) errs.code = "Ce code de classe n'existe pas. Demande-le à l'admin de ta classe."
      if (!errs.pseudo) {
        const { data: free } = await supabase.rpc('is_pseudo_available', { p_pseudo: pseudo.trim() })
        if (free === false) errs.pseudo = 'Ce pseudo est déjà pris.'
      }
      setErrors(errs)
      if (Object.keys(errs).length) return

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { pseudo: pseudo.trim(), invite_code: code.trim().toUpperCase() },
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) {
        // Le trigger SQL refuse l'inscription : message générique côté Supabase.
        setGlobalError(error.message.includes('Database error') ? 'Inscription impossible : vérifie ton pseudo et ton code de classe.' : frError(error))
        return
      }
      if (data.session) navigate('/installer', { replace: true })
      else setAwaitingEmail(true)
    } catch (err) {
      setGlobalError(frError(err))
    } finally {
      setLoading(false)
    }
  }

  if (awaitingEmail)
    return (
      <AuthLayout title="Vérifie tes emails" subtitle={email}>
        <div className="flex flex-col items-center gap-4 text-center">
          <MailCheck className="size-12 text-brand-500" />
          <p className="text-slate-600 dark:text-slate-300">
            On t'a envoyé un lien de confirmation. Clique dessus, puis reviens te connecter. Pense à regarder dans les spams.
          </p>
          <Link to="/connexion" className="font-semibold text-brand-600 dark:text-brand-300">
            Aller à la connexion
          </Link>
        </div>
      </AuthLayout>
    )

  return (
    <AuthLayout title="Créer un compte" subtitle="Rejoins ta classe pour réviser ensemble">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {globalError && <Alert tone="error">{globalError}</Alert>}
        <Input
          label="Code de la classe"
          name="code"
          autoCapitalize="characters"
          autoComplete="off"
          required
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setClassName(null)
          }}
          onBlur={() => checkCode().catch(() => {})}
          error={errors.code}
          hint={
            className ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" /> {className}
              </span>
            ) : (
              'Donné par ton délégué ou l’admin de la classe.'
            )
          }
        />
        <Input
          label="Pseudo"
          name="pseudo"
          autoComplete="nickname"
          autoCapitalize="none"
          required
          maxLength={20}
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          error={errors.pseudo}
          hint="Visible par ta classe. Évite ton nom de famille."
        />
        <Input label="Email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} hint="Sert uniquement à te connecter." />
        <Input label="Mot de passe" name="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="Au moins 8 caractères." />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand-600" />
          <span className="text-slate-600 dark:text-slate-300">
            J'ai lu la page{' '}
            <Link to="/confidentialite" className="font-medium text-brand-600 underline dark:text-brand-300">
              Confidentialité
            </Link>{' '}
            (données stockées : pseudo, email, activité de révision).
          </span>
        </label>
        {errors.accept && <p className="text-sm text-red-600 dark:text-red-400">{errors.accept}</p>}
        <Button type="submit" full loading={loading}>
          Créer mon compte
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Déjà un compte ?{' '}
        <Link to="/connexion" className="font-semibold text-brand-600 dark:text-brand-300">
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  )
}
