import type { ReactNode } from 'react'
import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

// Écran provisoire pour les onglets développés dans les étapes suivantes.
export const ComingSoon = ({ title, step, children }: { title: string; step: number; children?: ReactNode }) => (
  <>
    <PageHeader title={title} />
    <EmptyState icon={<Construction className="size-7" />} title="Bientôt disponible">
      {children ?? `Cette partie arrive à l'étape ${step}.`}
    </EmptyState>
  </>
)
