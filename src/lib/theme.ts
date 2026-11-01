export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'theme'

export const getThemePref = (): ThemePref => {
  try {
    return (localStorage.getItem(KEY) as ThemePref) || 'system'
  } catch {
    return 'system'
  }
}

export const applyTheme = (pref: ThemePref = getThemePref()) => {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1020' : '#f8fafc')
}

export const setThemePref = (pref: ThemePref) => {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* stockage indisponible : on applique quand même */
  }
  applyTheme(pref)
}

export const watchSystemTheme = () =>
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme())
