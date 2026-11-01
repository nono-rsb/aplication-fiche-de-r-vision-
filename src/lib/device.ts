// Détection de l'appareil et du mode d'affichage (installé ou navigateur).

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

export const isIOS =
  /iPad|iPhone|iPod/.test(ua) ||
  // iPadOS se présente comme un Mac
  (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isAndroid = /Android/i.test(ua)

// Sur iPhone, seul Safari (et depuis iOS 17 Chrome/Edge via « Partager ») sait
// ajouter à l'écran d'accueil. On conseille Safari, plus fiable.
export const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export type DeviceKind = 'ios' | 'android' | 'desktop'
export const deviceKind: DeviceKind = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
