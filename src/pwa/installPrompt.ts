// Capture l'événement « beforeinstallprompt » (Android/Chrome) le plus tôt
// possible pour pouvoir afficher notre propre bouton « Installer ».
import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const initInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useInstallPrompt = () => {
  const canInstall = useSyncExternalStore(subscribe, () => deferred !== null)
  const justInstalled = useSyncExternalStore(subscribe, () => installed)
  const install = async () => {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    emit()
    return outcome === 'accepted'
  }
  return { canInstall, justInstalled, install }
}
