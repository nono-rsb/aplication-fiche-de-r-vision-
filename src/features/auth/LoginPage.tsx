import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { frError } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

export const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) return setError(frError(error))
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout title="Connexion" subtitle="Content de te revoir 👋">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Email" name="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Mot de passe" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="text-right">
          <Link to="/mot-de-passe-oublie" className="text-sm font-medium text-brand-600 dark:text-brand-300">
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" full loading={loading}>
          Se connecter
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Pas encore de compte ?{' '}
        <Link to="/inscription" className="font-semibold text-brand-600 dark:text-brand-300">
          Créer un compte
        </Link>
      </p>
    </AuthLayout>
  )
}
