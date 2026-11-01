import { Outlet } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { InstallBanner } from '../InstallBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export const AppShell = () => {
  const online = useOnlineStatus()
  return (
    <div className="mx-auto min-h-dvh max-w-lg pt-safe pb-[calc(env(safe-area-inset-bottom)+72px)]">
      {!online && (
        <div className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-sm font-medium text-amber-950">
          <WifiOff className="size-4" /> Hors ligne — seules les fiches téléchargées sont disponibles
        </div>
      )}
      <InstallBanner />
      <main className="px-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
