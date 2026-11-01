import { createClient } from 'npm:@supabase/supabase-js@2'

// Client avec la clé service : contourne la RLS. À n'utiliser que côté serveur.
export const adminClient = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

// Identifie l'utilisateur à partir du jeton envoyé par l'app.
export const getUserFromRequest = async (req: Request) => {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data, error } = await adminClient().auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
