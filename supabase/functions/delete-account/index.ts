// Supprime définitivement le compte de l'utilisateur connecté et toutes ses
// données (cascade SQL depuis auth.users + fichiers personnels dans Storage).
import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient, getUserFromRequest } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const user = await getUserFromRequest(req)
  if (!user) return json({ error: 'Non authentifié' }, 401)

  const admin = adminClient()

  // Fichiers de contributions non publiées de l'élève (étape 8).
  const { data: files } = await admin.storage.from('sheets').list(`contributions/${user.id}`, { limit: 1000 })
  if (files?.length) {
    await admin.storage.from('sheets').remove(files.map((f) => `contributions/${user.id}/${f.name}`))
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return json({ error: error.message }, 500)

  return json({ ok: true })
})
