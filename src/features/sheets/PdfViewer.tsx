import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Minus, Plus } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { Spinner } from '@/components/ui/Spinner'

// pdf.js est chargé uniquement quand on ouvre une fiche (≈ 1 Mo).
// Build « legacy » : compatible avec les iPhone un peu anciens.
const loadPdfjs = async () => {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

/** Nombre de pages d'un PDF (utilisé à l'envoi d'une fiche). */
export const countPdfPages = async (data: ArrayBuffer): Promise<number | null> => {
  try {
    const pdfjs = await loadPdfjs()
    const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) })
    const n = (await task.promise).numPages
    await task.destroy()
    return n
  } catch {
    return null
  }
}

// Safari iOS refuse les canvas de plus de ~16,7 millions de pixels.
const MAX_CANVAS_PIXELS = 16_000_000
const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3]

const PdfPage = ({ doc, pageNumber, width }: { doc: PDFDocumentProxy; pageNumber: number; width: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(pageNumber <= 2)
  const [ratio, setRatio] = useState(1.414) // A4 portrait en attendant

  // Rendu uniquement quand la page approche de l'écran.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || visible) return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || width <= 0) return
    let task: RenderTask | null = null
    let cancelled = false
    ;(async () => {
      const page = await doc.getPage(pageNumber)
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      setRatio(base.height / base.width)
      const cssScale = width / base.width
      let outputScale = window.devicePixelRatio || 1
      const pixels = base.width * cssScale * outputScale * base.height * cssScale * outputScale
      if (pixels > MAX_CANVAS_PIXELS) outputScale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels)
      const viewport = page.getViewport({ scale: cssScale * outputScale })
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      task = page.render({ canvas, viewport })
      await task.promise.catch(() => {})
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNumber, width, visible])

  return (
    <div ref={wrapRef} className="relative bg-white shadow-md" style={{ width, height: width * ratio }}>
      <canvas ref={canvasRef} className="block size-full" aria-label={`Page ${pageNumber}`} />
    </div>
  )
}

interface Props {
  data: ArrayBuffer
  title: string
}

export const PdfViewer = ({ data, title }: Props) => {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let destroyed = false
    let task: { destroy: () => Promise<void> } | null = null
    loadPdfjs()
      .then((pdfjs) => {
        if (destroyed) return null
        const t = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) })
        task = t
        return t.promise
      })
      .then((d) => {
        if (d && !destroyed) setDoc(d)
      })
      .catch(() => !destroyed && setError("Impossible d'afficher ce PDF."))
    return () => {
      destroyed = true
      task?.destroy()
    }
  }, [data])

  // Largeur disponible (recalculée en plein écran / rotation).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [fullscreen])

  const toggleFullscreen = useCallback(async () => {
    const next = !fullscreen
    setFullscreen(next)
    // API plein écran quand elle existe (Android, ordinateur) ; sur iPhone, le
    // mode « plein écran » est une superposition qui masque la navigation.
    try {
      if (next && rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen()
      else if (!next && document.fullscreenElement) await document.exitFullscreen()
    } catch {
      /* non supporté */
    }
  }, [fullscreen])

  useEffect(() => {
    const onChange = () => !document.fullscreenElement && setFullscreen(false)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [fullscreen])

  const zoomIndex = ZOOMS.indexOf(zoom)
  const pageWidth = Math.max(0, (containerWidth - 16) * zoom)

  return (
    <div
      ref={rootRef}
      className={
        fullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-slate-200 pt-safe dark:bg-night-950'
          : 'flex flex-col overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 dark:bg-night-900 dark:ring-night-800'
      }
    >
      <div className="flex items-center gap-1 border-b border-slate-300 bg-white/90 px-2 py-1.5 backdrop-blur dark:border-night-800 dark:bg-night-900/90">
        <span className="min-w-0 flex-1 truncate px-1 text-sm font-medium">
          {fullscreen ? title : doc ? `${doc.numPages} page${doc.numPages > 1 ? 's' : ''}` : ''}
        </span>
        <button className="rounded-lg p-2 disabled:opacity-30" onClick={() => setZoom(ZOOMS[zoomIndex - 1])} disabled={zoomIndex <= 0} aria-label="Dézoomer">
          <Minus className="size-5" />
        </button>
        <button className="w-14 rounded-lg py-1 text-sm font-semibold tabular-nums" onClick={() => setZoom(1)} aria-label="Taille normale">
          {Math.round(zoom * 100)} %
        </button>
        <button className="rounded-lg p-2 disabled:opacity-30" onClick={() => setZoom(ZOOMS[zoomIndex + 1])} disabled={zoomIndex >= ZOOMS.length - 1} aria-label="Zoomer">
          <Plus className="size-5" />
        </button>
        <button className="rounded-lg p-2" onClick={toggleFullscreen} aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
          {fullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        </button>
      </div>
      <div
        ref={scrollRef}
        className={`overflow-auto overscroll-contain ${fullscreen ? 'flex-1 pb-safe' : 'max-h-[70dvh]'}`}
      >
        {error ? (
          <p className="p-6 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : !doc || containerWidth === 0 ? (
          <div className="flex h-60 items-center justify-center text-brand-500">
            <Spinner />
          </div>
        ) : (
          <div className="flex w-max min-w-full flex-col items-center gap-2 p-2">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage key={i} doc={doc} pageNumber={i + 1} width={pageWidth} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
