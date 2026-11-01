import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { RefreshCw } from 'lucide-react'

// Propose de recharger quand une nouvelle version de l'app est disponible.
export const UpdatePrompt = () => {
  const [update, setUpdate] = useState<null | (() => Promise<void>)>(null)
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh: () => setUpdate(() => () => updateSW(true)),
      onRegisteredSW: (_url, registration) => {
        // Vérifie les mises à jour toutes les heures si l'app reste ouverte.
        if (registration) setInterval(() => registration.update(), 60 * 60 * 1000)
      },
    })
  }, [])
  if (!update) return null
  return (
    <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-xl ring-1 ring-white/10">
      <RefreshCw className="size-5 shrink-0" />
      <span className="flex-1 text-sm">Une nouvelle version est disponible.</span>
      <button onClick={() => update()} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold">
        Mettre à jour
      </button>
    </div>
  )
}
