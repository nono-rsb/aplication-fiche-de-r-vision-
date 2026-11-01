// Traduit les erreurs Supabase en messages compréhensibles.
const MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Email ou mot de passe incorrect.',
  'Email not confirmed': "Ton email n'est pas encore confirmé : clique sur le lien reçu par email.",
  'User already registered': 'Un compte existe déjà avec cet email.',
  'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 8 caractères.',
  'Email rate limit exceeded': "Trop d'emails envoyés. Réessaie dans quelques minutes.",
  'For security purposes, you can only request this once every 60 seconds':
    'Pour des raisons de sécurité, attends une minute avant de réessayer.',
  'New password should be different from the old password.': "Le nouveau mot de passe doit être différent de l'ancien.",
  CODE_CLASSE_INVALIDE: "Ce code de classe n'existe pas ou n'est plus actif.",
  PSEUDO_PRIS: 'Ce pseudo est déjà pris.',
  PSEUDO_INVALIDE: 'Pseudo invalide (3 à 20 caractères : lettres, chiffres, _ . -).',
  MODIFICATION_INTERDITE: "Tu n'as pas le droit de faire cette modification.",
  ADMIN_REQUIS: 'Action réservée à l’admin.',
  'Failed to fetch': 'Pas de connexion internet. Réessaie quand tu seras en ligne.',
}

export const frError = (err: unknown): string => {
  const raw =
    typeof err === 'string' ? err : err && typeof err === 'object' && 'message' in err ? String(err.message) : ''
  for (const [key, msg] of Object.entries(MESSAGES)) if (raw.includes(key)) return msg
  if ((err as { code?: string })?.code === '23505') return 'Cette valeur est déjà utilisée.'
  return raw ? `Une erreur est survenue : ${raw}` : 'Une erreur est survenue.'
}
