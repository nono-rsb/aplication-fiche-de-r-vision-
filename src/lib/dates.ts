// Toutes les dates « jour » de l'app sont calculées à l'heure de Paris.
const TZ = 'Europe/Paris'

/** Date du jour à Paris au format AAAA-MM-JJ. */
export const parisToday = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

/** Nombre de jours entre aujourd'hui (Paris) et une date AAAA-MM-JJ. */
export const daysUntil = (isoDate: string): number => {
  const [y, m, d] = parisToday().split('-').map(Number)
  const [y2, m2, d2] = isoDate.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y, m - 1, d)) / 86_400_000)
}

export const formatDate = (isoDate: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) => {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

export const greeting = (): string => {
  const h = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: 'numeric' }).format(new Date()))
  return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour'
}
