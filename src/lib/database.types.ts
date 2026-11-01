// Types de la base de données.
// Ce fichier peut être régénéré à partir du projet Supabase :
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
// Il est maintenu à la main en attendant, au même format que la génération.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row, Required extends keyof Row = never> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, Required>
  Update: Partial<Row>
  Relationships: []
}

export type Role = 'eleve' | 'admin'

export type ClassRow = {
  id: string
  name: string
  invite_code: string
  is_open: boolean
  created_at: string
}

export type ProfileRow = {
  id: string
  pseudo: string
  class_id: string | null
  role: Role
  is_blocked: boolean
  xp_total: number
  current_streak: number
  best_streak: number
  last_active_day: string | null
  last_seen_on: string | null
  created_at: string
}

export type UserSettingsRow = {
  user_id: string
  show_in_leaderboard: boolean
  reminder_time: string
  notif_new_sheet: boolean
  notif_answer: boolean
  notif_request_published: boolean
  notif_daily_reminder: boolean
  notif_streak: boolean
  updated_at: string
}

export type SubjectRow = {
  id: string
  class_id: string
  name: string
  color: string
  icon: string
  position: number
  created_at: string
}

export type ChapterRow = {
  id: string
  subject_id: string
  class_id: string
  title: string
  position: number
  created_at: string
}

export type ContentStatus = 'pending' | 'published' | 'rejected'

export type SheetRow = {
  id: string
  chapter_id: string
  class_id: string
  title: string
  description: string | null
  file_path: string
  file_size: number
  page_count: number | null
  status: ContentStatus
  author_id: string | null
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type FavoriteRow = { user_id: string; sheet_id: string; created_at: string }
export type SheetViewRow = { sheet_id: string; user_id: string; day: string }

export type AdminStats = {
  students: number
  active_today: number
  active_7d: number
  active_30d: number
  sheets: number
  top_sheets: { id: string; title: string; views: number; readers: number }[]
}

export type Database = {
  __InternalSupabase: { PostgrestVersion: '13' }
  public: {
    Tables: {
      classes: Table<ClassRow, 'name'>
      profiles: Table<ProfileRow, 'id' | 'pseudo'>
      user_settings: Table<UserSettingsRow, 'user_id'>
      subjects: Table<SubjectRow, 'class_id' | 'name'>
      chapters: Table<ChapterRow, 'subject_id' | 'title'>
      sheets: Table<SheetRow, 'chapter_id' | 'title' | 'file_path' | 'file_size'>
      favorites: Table<FavoriteRow, 'user_id' | 'sheet_id'>
      sheet_views: Table<SheetViewRow, 'sheet_id' | 'user_id'>
    }
    Views: { [_ in never]: never }
    Functions: {
      check_invite_code: { Args: { p_code: string }; Returns: string | null }
      is_pseudo_available: { Args: { p_pseudo: string }; Returns: boolean }
      regenerate_invite_code: { Args: { p_class_id: string }; Returns: string }
      paris_today: { Args: Record<string, never>; Returns: string }
      ping: { Args: Record<string, never>; Returns: undefined }
      record_sheet_view: { Args: { p_sheet_id: string }; Returns: undefined }
      admin_stats: { Args: { p_class_id?: string | null }; Returns: Json }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
