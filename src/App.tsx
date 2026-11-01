import { lazy, Suspense } from 'react'
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { isStandalone } from '@/lib/device'
import { RequireAdmin, RequireAuth, RequireGuest } from '@/components/guards'
import { AppShell } from '@/components/layout/AppShell'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignupPage } from '@/features/auth/SignupPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { InstallPage, onboardingSeen } from '@/features/onboarding/InstallPage'
import { HomePage } from '@/features/home/HomePage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { PrivacyPage } from '@/features/profile/PrivacyPage'
import { ComingSoon } from '@/features/placeholders/ComingSoon'
import { SheetsPage } from '@/features/sheets/SheetsPage'
import { SubjectPage } from '@/features/sheets/SubjectPage'
import { SheetPage } from '@/features/sheets/SheetPage'

// L'espace admin est chargé à la demande (les élèves ne le téléchargent jamais).
const AdminHome = lazy(() => import('@/features/admin/AdminHome').then((m) => ({ default: m.AdminHome })))
const AdminClasses = lazy(() => import('@/features/admin/AdminClasses').then((m) => ({ default: m.AdminClasses })))
const AdminContent = lazy(() => import('@/features/admin/AdminContent').then((m) => ({ default: m.AdminContent })))
const AdminStats = lazy(() => import('@/features/admin/AdminStats').then((m) => ({ default: m.AdminStats })))

// Au premier lancement dans le navigateur, on montre le guide d'installation.
const OnboardingGate = () => (!isStandalone() && !onboardingSeen() ? <Navigate to="/installer" replace /> : <Outlet />)

const MissingConfig = () => (
  <div className="mx-auto max-w-md space-y-3 p-6 pt-20">
    <h1 className="text-xl font-bold">Configuration manquante</h1>
    <p className="text-slate-600 dark:text-slate-300">
      Les variables <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> ne sont pas définies. Copie <code>.env.example</code> en <code>.env.local</code> et
      remplis-les (voir README).
    </p>
  </div>
)

const NotFound = () => (
  <div className="py-20 text-center">
    <p className="text-5xl">🤔</p>
    <h1 className="mt-4 text-xl font-bold">Page introuvable</h1>
    <Link to="/" className="mt-4 inline-block font-semibold text-brand-600 dark:text-brand-300">
      Retour à l'accueil
    </Link>
  </div>
)

export default function App() {
  if (!isSupabaseConfigured) return <MissingConfig />
  return (
    <>
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route element={<RequireGuest />}>
            <Route path="/connexion" element={<LoginPage />} />
            <Route path="/inscription" element={<SignupPage />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
          </Route>
          <Route path="/nouveau-mot-de-passe" element={<ResetPasswordPage />} />
          <Route path="/confidentialite" element={<PrivacyPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/installer" element={<InstallPage />} />
            <Route element={<OnboardingGate />}>
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="/fiches" element={<SheetsPage />} />
                <Route path="/fiches/matiere/:subjectId" element={<SubjectPage />} />
                <Route path="/fiches/demandes" element={<ComingSoon title="Demandes de fiches" step={6} />} />
                <Route path="/fiches/:sheetId" element={<SheetPage />} />
                <Route path="/flashcards" element={<ComingSoon title="Flashcards" step={3} />} />
                <Route path="/classement" element={<ComingSoon title="Classement" step={5} />} />
                <Route path="/profil" element={<ProfilePage />} />
                <Route path="/admin" element={<RequireAdmin />}>
                  <Route index element={<AdminHome />} />
                  <Route path="classes" element={<AdminClasses />} />
                  <Route path="contenu" element={<AdminContent />} />
                  <Route path="stats" element={<AdminStats />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <UpdatePrompt />
    </>
  )
}
