import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { FullPageSpinner } from './ui/Spinner'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'

export const RequireAuth = () => {
  const { session, profile, loading, signOut } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  if (!profile) return <FullPageSpinner />
  if (profile.is_blocked)
    return (
      <div className="mx-auto max-w-md space-y-4 p-6 pt-20">
        <Alert tone="error">Ton compte a été suspendu par l'administrateur. Contacte-le si tu penses que c'est une erreur.</Alert>
        <Button variant="secondary" full onClick={signOut}>
          Se déconnecter
        </Button>
      </div>
    )
  return <Outlet />
}

export const RequireGuest = () => {
  const { session, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}

export const RequireAdmin = () => {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
