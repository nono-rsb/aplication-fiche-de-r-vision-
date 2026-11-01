import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UserSettingsRow } from '@/lib/database.types'
import { useAuth } from './useAuth'

export const useSettings = () => {
  const { session } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['settings', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId!).single()
      if (error) throw error
      return data
    },
  })
  const update = useMutation({
    mutationFn: async (patch: Partial<Omit<UserSettingsRow, 'user_id' | 'updated_at'>>) => {
      const { data, error } = await supabase.from('user_settings').update(patch).eq('user_id', userId!).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.setQueryData(['settings', userId], data),
  })
  return { settings: query.data, isLoading: query.isLoading, update }
}
