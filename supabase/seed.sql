-- =============================================================================
-- Données de test. À exécuter APRÈS les migrations (SQL Editor de Supabase).
-- Idempotent : peut être relancé.
-- =============================================================================

-- Classes de démonstration (codes fixes pour faciliter les tests)
insert into public.classes (id, name, invite_code) values
  ('00000000-0000-4000-8000-000000000001', 'Ma classe (démo)', 'DEMO42'),
  ('00000000-0000-4000-8000-000000000002', 'Autre classe (test)', 'TEST22')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Étape 2 : matières, chapitres, fiches (classe démo)
-- Les PDF correspondants sont dans supabase/seed-files/ :
-- envoie-les dans Storage avec `node scripts/upload-seed-files.mjs` (voir README).
-- -----------------------------------------------------------------------------
insert into public.subjects (id, class_id, name, color, icon, position) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Mathématiques',     '#6366f1', '📐', 1),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Histoire-Géo',      '#f59e0b', '🌍', 2),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'SVT',               '#10b981', '🧬', 3),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Physique-Chimie',   '#ef4444', '⚗️', 4),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'Anglais',           '#0ea5e9', '🇬🇧', 5)
on conflict (id) do nothing;

insert into public.chapters (id, subject_id, title, position) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Second degré', 1),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Dérivation', 2),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'La Révolution française', 1),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'La cellule', 1),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', 'Les réactions chimiques', 1),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000005', 'Les temps du passé', 1)
on conflict (id) do nothing;

insert into public.sheets (id, chapter_id, title, description, file_path, file_size, page_count, published_at) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Forme canonique et discriminant', 'Les formules à connaître par cœur + méthode.', 'published/00000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001.pdf', 40000, 2, now() - interval '20 days'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Dérivées usuelles', 'Tableau des dérivées et règles de calcul.', 'published/00000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000002.pdf', 40000, 2, now() - interval '3 days'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'Chronologie 1789–1799', 'Les dates clés de la Révolution.', 'published/00000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000003.pdf', 40000, 2, now() - interval '1 day'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'Schéma de la cellule', null, 'published/00000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000004.pdf', 40000, 2, now() - interval '10 days'),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006', 'Prétérit vs present perfect', 'Quand utiliser quel temps.', 'published/00000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000005.pdf', 40000, 2, now() - interval '6 hours')
on conflict (id) do nothing;
