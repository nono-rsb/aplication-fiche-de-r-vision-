// Fiches PDF hors ligne.
// - « Télécharger pour hors ligne » : le PDF est rangé dans un cache permanent
//   (Cache Storage, lisible aussi par le service worker) + un index local.
// - Les fiches récemment ouvertes sont aussi gardées dans un petit cache
//   (limite la bande passante Supabase et accélère les réouvertures).
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import type { SheetRow } from './database.types'

const OFFLINE_CACHE = 'sheets-offline-v1'
const RECENT_CACHE = 'sheets-recent-v1'
const RECENT_MAX = 12
const INDEX_KEY = 'offline-sheets-index'

type SheetFile = Pick<SheetRow, 'id' | 'file_path' | 'updated_at'>

export interface OfflineEntry {
  id: string
  title: string
  subject: string
  chapter: string
  color: string
  icon: string
  size: number
  version: string
  savedAt: string
}

const hasCaches = () => typeof caches !== 'undefined'
const keyFor = (s: SheetFile) => `/__pdf/${s.id}?v=${encodeURIComponent(s.updated_at)}`
const baseKey = (id: string) => `/__pdf/${id}`

// --- Index des fiches hors ligne (localStorage) ---------------------------------
const listeners = new Set<() => void>()
let snapshot: Record<string, OfflineEntry> = readIndex()

function readIndex(): Record<string, OfflineEntry> {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '{}')
  } catch {
    return {}
  }
}
const writeIndex = (idx: Record<string, OfflineEntry>) => {
  snapshot = idx
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx))
  } catch {
    /* stockage plein ou indisponible */
  }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useOfflineIndex = () => useSyncExternalStore(subscribe, () => snapshot)

// --- Téléchargement -----------------------------------------------------------
const download = async (s: SheetFile): Promise<Blob> => {
  const { data, error } = await supabase.storage.from('sheets').download(s.file_path)
  if (error || !data) throw error ?? new Error('Téléchargement impossible')
  return data
}

const putInRecent = async (s: SheetFile, blob: Blob) => {
  const cache = await caches.open(RECENT_CACHE)
  await cache.put(keyFor(s), new Response(blob, { headers: { 'Content-Type': 'application/pdf' } }))
  const keys = await cache.keys()
  // Les clés sont dans l'ordre d'insertion : on supprime les plus anciennes.
  for (const k of keys.slice(0, Math.max(0, keys.length - RECENT_MAX))) await cache.delete(k)
}

/**
 * Renvoie le contenu du PDF, en privilégiant les copies locales.
 * Hors ligne, une ancienne version téléchargée est utilisée si besoin.
 */
export const getPdfData = async (s: SheetFile): Promise<{ data: ArrayBuffer; stale: boolean }> => {
  if (hasCaches()) {
    const exact = (await caches.match(keyFor(s))) ?? null
    if (exact) return { data: await exact.arrayBuffer(), stale: false }
    if (!navigator.onLine) {
      const old = await caches.match(baseKey(s.id), { ignoreSearch: true })
      if (old) return { data: await old.arrayBuffer(), stale: true }
    }
  }
  const blob = await download(s)
  if (hasCaches()) {
    putInRecent(s, blob).catch(() => {})
    // Fiche hors ligne dont le fichier a été mis à jour : on rafraîchit la copie.
    if (snapshot[s.id] && snapshot[s.id].version !== s.updated_at) {
      saveBlobOffline(s, blob).catch(() => {})
    }
  }
  return { data: await blob.arrayBuffer(), stale: false }
}

const saveBlobOffline = async (s: SheetFile, blob: Blob) => {
  const cache = await caches.open(OFFLINE_CACHE)
  for (const k of await cache.keys()) if (new URL(k.url).pathname === baseKey(s.id)) await cache.delete(k)
  await cache.put(keyFor(s), new Response(blob, { headers: { 'Content-Type': 'application/pdf' } }))
  if (snapshot[s.id]) writeIndex({ ...snapshot, [s.id]: { ...snapshot[s.id], version: s.updated_at, size: blob.size } })
}

export const saveOffline = async (s: SheetFile, meta: Omit<OfflineEntry, 'id' | 'size' | 'version' | 'savedAt'>) => {
  if (!hasCaches()) throw new Error("Ton navigateur ne permet pas l'enregistrement hors ligne.")
  // Demande au navigateur de ne pas effacer ces données (Android/Chrome surtout).
  navigator.storage?.persist?.().catch(() => {})
  const recent = await caches.match(keyFor(s))
  const blob = recent ? await recent.blob() : await download(s)
  writeIndex({
    ...snapshot,
    [s.id]: { id: s.id, ...meta, size: blob.size, version: s.updated_at, savedAt: new Date().toISOString() },
  })
  await saveBlobOffline(s, blob)
}

export const removeOffline = async (id: string) => {
  if (hasCaches()) {
    const cache = await caches.open(OFFLINE_CACHE)
    for (const k of await cache.keys()) if (new URL(k.url).pathname === baseKey(id)) await cache.delete(k)
  }
  const next = { ...snapshot }
  delete next[id]
  writeIndex(next)
}

export const clearAllOffline = async () => {
  if (hasCaches()) {
    await caches.delete(OFFLINE_CACHE)
    await caches.delete(RECENT_CACHE)
  }
  writeIndex({})
}

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
