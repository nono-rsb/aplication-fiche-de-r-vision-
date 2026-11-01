import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Share, X } from 'lucide-react'
import { isIOS, isStandalone } from '@/lib/device'

const KEY = 'install-banner-dismissed-at'
const ONE_DAY = 86_400_000

const recentlyDismissed = () => {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < 3 * ONE_DAY
  } catch {
    return false
  }
}

// Sur iPhone dans Safari (non installée), on invite à installer l'app :
// c'est indispensable pour recevoir les notifications.
export const InstallBanner = () => {
  const [hidden, setHidden] = useState(() => !isIOS || isStandalone() || recentlyDismissed())
  if (hidden) return null
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setHidden(true)
  }
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-brand-600 p-3 text-white shadow-lg">
      <Share className="size-6 shrink-0" />
      <Link to="/installer" className="flex-1 text-sm leading-snug">
        <strong>Installe l'app</strong> sur ton écran d'accueil pour les notifications et l'accès hors ligne.
        <span className="ml-1 underline">Comment faire ?</span>
      </Link>
      <button onClick={dismiss} aria-label="Masquer" className="rounded-full p-1 hover:bg-white/15">
        <X className="size-5" />
      </button>
    </div>
  )
}
