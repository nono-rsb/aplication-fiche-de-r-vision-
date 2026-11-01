import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { frError } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
    })
    setLoading(false)
    if (error) return setError(frError(error))
    setSent(true)
  }

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="On t'envoie un lien pour en choisir un nouveau">
      {sent ? (
        <Alert tone="success">Si un compte existe avec cet email, un lien vient d'être envoyé. Pense à regarder dans les spams.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Input label="Email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" full loading={loading}>
            Envoyer le lien
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/connexion" className="font-semibold text-brand-600 dark:text-brand-300">
          Retour à la connexion
        </Link>
      </p>
    </AuthLayout>
  )
}
