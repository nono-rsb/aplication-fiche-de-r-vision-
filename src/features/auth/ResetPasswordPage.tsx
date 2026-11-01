import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { frError } from '@/lib/errors'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { AuthLayout } from './AuthLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FullPageSpinner } from '@/components/ui/Spinner'

// Page ouverte depuis le lien « mot de passe oublié » (session de récupération).
export const ResetPasswordPage = () => {
  const { session, loading: authLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  if (authLoading) return <FullPageSpinner />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Au moins 8 caractères.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(frError(error))
    toast('Mot de passe modifié !')
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Nouveau mot de passe">
      {!session ? (
        <Alert tone="error">Ce lien a expiré ou a déjà été utilisé. Refais une demande depuis « Mot de passe oublié ».</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Input label="Nouveau mot de passe" name="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} hint="Au moins 8 caractères." />
          <Button type="submit" full loading={loading}>
            Enregistrer
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
