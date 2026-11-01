import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle2, Download, MoreVertical, Share, SquarePlus, WifiOff, Zap } from 'lucide-react'
import { deviceKind, isIOSSafari, isStandalone, type DeviceKind } from '@/lib/device'
import { useInstallPrompt } from '@/pwa/installPrompt'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export const ONBOARDING_KEY = 'onboarding-install-seen'
export const markOnboardingSeen = () => {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1')
  } catch {
    /* ignore */
  }
}
export const onboardingSeen = () => {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1'
  } catch {
    return true
  }
}

const Benefit = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <li className="flex items-center gap-3">
    <span className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-night-800 dark:text-brand-300">{icon}</span>
    <span className="text-sm">{children}</span>
  </li>
)

const Step = ({ n, title, children }: { n: number; title: ReactNode; children?: ReactNode }) => (
  <li className="flex gap-3">
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{n}</span>
    <div className="flex-1 pt-0.5">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  </li>
)

// Petites illustrations qui imitent l'interface de Safari.
const SafariBar = () => (
  <div className="flex items-center justify-around rounded-xl bg-slate-100 px-3 py-2 text-slate-400 dark:bg-night-800">
    <span>‹</span>
    <span>›</span>
    <span className="rounded-lg bg-brand-600 p-1.5 text-white ring-4 ring-brand-500/30">
      <Share className="size-5" />
    </span>
    <span>▢</span>
    <span>⧉</span>
  </div>
)

const ShareSheetRow = () => (
  <div className="divide-y divide-slate-200 rounded-xl bg-slate-100 text-sm dark:divide-night-700 dark:bg-night-800">
    <div className="flex items-center justify-between px-3 py-2 text-slate-400">
      Ajouter aux favoris <span>☆</span>
    </div>
    <div className="flex items-center justify-between px-3 py-2 font-semibold ring-2 ring-brand-500">
      Sur l'écran d'accueil <SquarePlus className="size-5" />
    </div>
  </div>
)

const IosGuide = () => (
  <ol className="space-y-5">
    {!isIOSSafari && (
      <Step n={0} title="Ouvre cette page dans Safari">
        <p className="text-sm text-slate-500 dark:text-slate-400">Copie l'adresse et colle-la dans Safari : c'est le navigateur le plus fiable pour installer l'app.</p>
      </Step>
    )}
    <Step n={1} title={<>Touche le bouton <strong>Partager</strong> en bas de l'écran</>}>
      <SafariBar />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sur iPad ou si la barre est en haut : il est en haut à droite.</p>
    </Step>
    <Step n={2} title={<>Fais défiler et choisis <strong>« Sur l'écran d'accueil »</strong></>}>
      <ShareSheetRow />
    </Step>
    <Step n={3} title={<>Touche <strong>Ajouter</strong> en haut à droite</>} />
    <Step n={4} title="Ouvre l'app depuis ton écran d'accueil et reconnecte-toi si besoin" />
  </ol>
)

const AndroidGuide = () => {
  const { canInstall, justInstalled, install } = useInstallPrompt()
  if (justInstalled)
    return (
      <p className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-5" /> Installée ! Tu la trouveras sur ton écran d'accueil.
      </p>
    )
  return (
    <div className="space-y-4">
      {canInstall && (
        <Button full icon={<Download className="size-5" />} onClick={install}>
          Installer l'application
        </Button>
      )}
      <div>
        {canInstall && <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Si le bouton ne marche pas :</p>}
        <ol className="space-y-4">
          <Step n={1} title={<>Dans Chrome, touche le menu <MoreVertical className="inline size-4" /> en haut à droite</>} />
          <Step n={2} title={<>Choisis <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong></>} />
          <Step n={3} title="Confirme, puis ouvre l'app depuis ton écran d'accueil" />
        </ol>
      </div>
    </div>
  )
}

const DesktopGuide = () => {
  const { canInstall, install } = useInstallPrompt()
  return (
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
      <p>L'app est pensée pour le téléphone. Ouvre cette adresse sur ton iPhone (Safari) ou ton Android (Chrome) pour l'installer.</p>
      {canInstall && (
        <Button variant="secondary" icon={<Download className="size-5" />} onClick={install}>
          Installer sur cet ordinateur
        </Button>
      )}
    </div>
  )
}

const tabs: { id: DeviceKind; label: string }[] = [
  { id: 'ios', label: 'iPhone / iPad' },
  { id: 'android', label: 'Android' },
  { id: 'desktop', label: 'Ordinateur' },
]

export const InstallPage = () => {
  const [device, setDevice] = useState<DeviceKind>(deviceKind)
  const navigate = useNavigate()
  const standalone = isStandalone()

  const finish = () => {
    markOnboardingSeen()
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-safe pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <header className="pt-8 pb-5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Installe l'app sur ton téléphone</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">30 secondes, et c'est gratuit.</p>
      </header>

      {standalone ? (
        <Card className="mb-5 flex items-center gap-3">
          <CheckCircle2 className="size-6 text-emerald-500" />
          <p className="text-sm font-medium">L'application est déjà installée sur cet appareil. 🎉</p>
        </Card>
      ) : (
        <>
          <ul className="mb-6 space-y-3">
            <Benefit icon={<Zap className="size-5" />}>S'ouvre en un geste, en plein écran</Benefit>
            <Benefit icon={<WifiOff className="size-5" />}>Tes fiches téléchargées disponibles hors ligne</Benefit>
            <Benefit icon={<Bell className="size-5" />}>
              Rappels de révision et nouvelles fiches{device === 'ios' && <em> (sur iPhone, uniquement une fois installée)</em>}
            </Benefit>
          </ul>

          <div className="mb-4 flex rounded-xl bg-slate-200/60 p-1 dark:bg-night-900" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={device === t.id}
                onClick={() => setDevice(t.id)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                  device === t.id ? 'bg-white shadow-sm dark:bg-night-700' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Card className="mb-6">{device === 'ios' ? <IosGuide /> : device === 'android' ? <AndroidGuide /> : <DesktopGuide />}</Card>
        </>
      )}

      <Button variant={standalone ? 'primary' : 'ghost'} full onClick={finish}>
        {standalone ? "C'est parti !" : 'Continuer dans le navigateur'}
      </Button>
    </div>
  )
}
