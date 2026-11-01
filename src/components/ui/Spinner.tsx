export const Spinner = ({ className = 'size-6' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-label="Chargement">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>
)

export const FullPageSpinner = () => (
  <div className="flex min-h-dvh items-center justify-center text-brand-500">
    <Spinner className="size-8" />
  </div>
)
