import type { ReactNode } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'

const Block = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card>
    <h2 className="mb-2 font-semibold">{title}</h2>
    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">{children}</div>
  </Card>
)

export const PrivacyPage = () => (
  <div className="mx-auto max-w-lg space-y-4 px-4 pt-safe pb-10">
    <PageHeader title="Confidentialité" subtitle="Ce que l'app stocke, et pourquoi" back />
    <Block title="Les données stockées">
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Ton email</strong> : uniquement pour te connecter et réinitialiser ton mot de passe. Il n'est jamais affiché aux autres élèves.</li>
        <li><strong>Ton pseudo</strong> et <strong>ta classe</strong> : visibles par les élèves de ta classe (questions, classement).</li>
        <li><strong>Ton activité de révision</strong> : progression des flashcards, révisions du jour, points (XP), série de jours (streak), favoris.</li>
        <li><strong>Ce que tu publies</strong> : questions, réponses, demandes de fiches, votes, fiches ou flashcards proposées.</li>
        <li><strong>Notifications</strong> (si tu les actives) : un identifiant technique d'abonnement fourni par ton navigateur.</li>
      </ul>
    </Block>
    <Block title="Ce que l'app ne fait pas">
      <ul className="list-disc space-y-1 pl-5">
        <li>Pas de nom, de photo, de date de naissance ni de numéro de téléphone.</li>
        <li>Pas de messagerie privée entre élèves.</li>
        <li>Pas de publicité, pas de revente de données, pas de traceurs publicitaires.</li>
      </ul>
    </Block>
    <Block title="Où sont les données ?">
      <p>Elles sont hébergées par Supabase (base de données et fichiers) et l'app par Cloudflare. Seul l'administrateur de l'app peut gérer les contenus et modérer.</p>
    </Block>
    <Block title="Tes droits">
      <p>Tu peux modifier ton pseudo et choisir de ne pas apparaître dans le classement depuis ton profil.</p>
      <p>Tu peux <strong>supprimer ton compte et toutes tes données</strong> à tout moment : Profil → Supprimer mon compte. La suppression est immédiate et définitive.</p>
      <p>Pour toute question, adresse-toi à l'administrateur de l'app (le créateur des fiches de ta classe).</p>
    </Block>
  </div>
)
