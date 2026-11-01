import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronRight, CloudDownload, HandHelping, Search, Star, Trash2, X } from 'lucide-react'
import { useCatalog, useFavorites, searchSheets, isNew } from './api'
import { SheetListItem } from './SheetListItem'
import { useOfflineIndex, removeOffline, formatSize } from '@/lib/offline'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'

type Tab = 'matieres' | 'favoris' | 'hors-ligne'
const TABS: { id: Tab; label: string }[] = [
  { id: 'matieres', label: 'Matières' },
  { id: 'favoris', label: 'Favoris' },
  { id: 'hors-ligne', label: 'Hors ligne' },
]

export const SheetsPage = () => {
  const online = useOnlineStatus()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('vue') as Tab) || (online ? 'matieres' : 'hors-ligne')
  const [q, setQ] = useState('')
  const { catalog, isLoading, error } = useCatalog()
  const favorites = useFavorites()
  const offline = useOfflineIndex()

  const setTab = (t: Tab) => setParams(t === 'matieres' ? {} : { vue: t }, { replace: true })

  const results = catalog && q.trim() ? searchSheets(catalog.sheets, q) : null
  const recent = catalog?.sheets.filter((s) => isNew(s, 14)).slice(0, 8) ?? []

  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="Fiches" />

      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une fiche, une matière, un chapitre…"
          className="w-full rounded-xl border-0 bg-white py-3 pr-10 pl-11 ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 focus:outline-none dark:bg-night-900 dark:ring-night-800"
          aria-label="Rechercher"
        />
        {q && (
          <button onClick={() => setQ('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-slate-400" aria-label="Effacer">
            <X className="size-4" />
          </button>
        )}
      </label>

      {results ? (
        <section className="space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </p>
          {results.map((s) => (
            <SheetListItem key={s.id} sheet={s} favorite={favorites.has(s.id)} offline={Boolean(offline[s.id])} />
          ))}
          {results.length === 0 && <EmptyState icon={<Search className="size-7" />} title="Aucune fiche trouvée">Essaie avec un autre mot.</EmptyState>}
        </section>
      ) : (
        <>
          <div className="flex rounded-xl bg-slate-200/60 p-1 dark:bg-night-900" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === t.id ? 'bg-white shadow-sm dark:bg-night-700' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'matieres' && (
            <>
              {isLoading && (
                <div className="flex justify-center py-10 text-brand-500">
                  <Spinner />
                </div>
              )}
              {error && !catalog && <Alert tone="error">Impossible de charger les fiches. {online ? 'Réessaie plus tard.' : 'Tu es hors ligne : consulte l’onglet « Hors ligne ».'}</Alert>}

              {recent.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Nouveautés</h2>
                  <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                    {recent.map((s) => (
                      <Link
                        key={s.id}
                        to={`/fiches/${s.id}`}
                        className="w-40 shrink-0 snap-start rounded-2xl p-3 text-white"
                        style={{ background: `linear-gradient(135deg, ${s.subject.color}, ${s.subject.color}cc)` }}
                      >
                        <span className="text-2xl">{s.subject.icon}</span>
                        <p className="mt-2 line-clamp-2 text-sm leading-tight font-semibold">{s.title}</p>
                        <p className="mt-1 truncate text-xs text-white/80">{s.subject.name}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {catalog && catalog.subjects.length === 0 && (
                <EmptyState icon={<BookOpen className="size-7" />} title="Aucune matière pour l'instant">
                  Les fiches arriveront bientôt !
                </EmptyState>
              )}
              <div className="grid grid-cols-2 gap-3">
                {catalog?.subjects.map((subj) => {
                  const count = catalog.sheets.filter((s) => s.subject.id === subj.id).length
                  return (
                    <Link
                      key={subj.id}
                      to={`/fiches/matiere/${subj.id}`}
                      className="relative overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-slate-200 active:scale-[0.98] dark:bg-night-900 dark:ring-night-800"
                    >
                      <span className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: subj.color }} />
                      <span className="text-3xl">{subj.icon}</span>
                      <p className="mt-2 leading-tight font-semibold">{subj.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {count} fiche{count > 1 ? 's' : ''}
                      </p>
                    </Link>
                  )
                })}
              </div>

              <Link to="/fiches/demandes" className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-4 dark:border-night-700">
                <HandHelping className="size-6 text-brand-600 dark:text-brand-300" />
                <span className="flex-1">
                  <span className="block font-semibold">Il te manque une fiche ?</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Demande-la et vote pour celles des autres</span>
                </span>
                <ChevronRight className="size-5 text-slate-400" />
              </Link>
            </>
          )}

          {tab === 'favoris' && (
            <section className="space-y-2">
              {favorites.ids.length === 0 ? (
                <EmptyState icon={<Star className="size-7" />} title="Pas encore de favoris">
                  Touche l'étoile sur une fiche pour la retrouver ici.
                </EmptyState>
              ) : (
                favorites.ids
                  .map((id) => catalog?.sheetById.get(id))
                  .filter((s) => s !== undefined)
                  .map((s) => <SheetListItem key={s.id} sheet={s} favorite offline={Boolean(offline[s.id])} />)
              )}
            </section>
          )}

          {tab === 'hors-ligne' && (
            <section className="space-y-2">
              {Object.keys(offline).length === 0 ? (
                <EmptyState icon={<CloudDownload className="size-7" />} title="Aucune fiche téléchargée">
                  Ouvre une fiche et touche « Hors ligne » pour pouvoir la lire sans réseau.
                </EmptyState>
              ) : (
                <>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {Object.keys(offline).length} fiche(s) · {formatSize(Object.values(offline).reduce((a, e) => a + e.size, 0))}
                  </p>
                  {Object.values(offline)
                    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
                    .map((e) => (
                      <div key={e.id} className="flex items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-night-900 dark:ring-night-800">
                        <Link to={`/fiches/${e.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: `${e.color}33` }}>
                            {e.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{e.title}</span>
                            <span className="block truncate text-sm text-slate-500 dark:text-slate-400">
                              {e.subject} · {formatSize(e.size)}
                            </span>
                          </span>
                        </Link>
                        <button onClick={() => removeOffline(e.id)} className="rounded-full p-2 text-slate-400 hover:text-red-500" aria-label="Supprimer de l'appareil">
                          <Trash2 className="size-5" />
                        </button>
                      </div>
                    ))}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
