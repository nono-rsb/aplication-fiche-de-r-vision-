import { Sparkles } from 'lucide-react'

// V2 : emplacement réservé pour les quiz générés par IA (non développé en V1).
export const AiQuizTeaser = () => (
  <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-night-700 dark:text-slate-400">
    <Sparkles className="size-5 shrink-0" />
    <span>
      <strong className="text-slate-700 dark:text-slate-200">Quiz générés par IA</strong> — bientôt disponible.
    </span>
  </div>
)
