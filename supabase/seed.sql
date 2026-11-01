-- =============================================================================
-- Données de test. À exécuter APRÈS les migrations (SQL Editor de Supabase).
-- Idempotent : peut être relancé.
-- =============================================================================

-- Classes de démonstration (codes fixes pour faciliter les tests)
insert into public.classes (id, name, invite_code) values
  ('00000000-0000-4000-8000-000000000001', 'Ma classe (démo)', 'DEMO42'),
  ('00000000-0000-4000-8000-000000000002', 'Autre classe (test)', 'TEST22')
on conflict (id) do nothing;
