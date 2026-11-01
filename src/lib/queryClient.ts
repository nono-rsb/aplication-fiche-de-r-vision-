import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

const WEEK = 7 * 24 * 60 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: WEEK, retry: 1, refetchOnWindowFocus: false },
  },
})

// Les données utiles hors ligne (catalogue des fiches, favoris, réglages) sont
// conservées sur l'appareil pour que l'app reste navigable sans réseau.
const PERSISTED = new Set(['catalog', 'favorites', 'settings'])
export const PERSIST_KEY = 'rq-cache'

export const persistOptions = {
  persister: createSyncStoragePersister({ storage: typeof window !== 'undefined' ? window.localStorage : undefined, key: PERSIST_KEY }),
  maxAge: WEEK,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { queryKey: readonly unknown[]; state: { status: string } }) =>
      q.state.status === 'success' && PERSISTED.has(String(q.queryKey[0])),
  },
}
