-- =============================================================================
-- 0002_sheets.sql — Étape 2 : matières, chapitres, fiches PDF, favoris, vues
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Activité (statistique « élèves actifs »)
-- -----------------------------------------------------------------------------

alter table public.profiles add column last_seen_on date;

-- Appelée à l'ouverture de l'app : note le jour de la dernière visite.
create or replace function public.ping()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set last_seen_on = public.paris_today()
  where id = auth.uid() and last_seen_on is distinct from public.paris_today();
$$;

-- -----------------------------------------------------------------------------
-- Matières et chapitres
-- -----------------------------------------------------------------------------

create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  color      text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon       text not null default '📘' check (char_length(icon) <= 8),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index subjects_class_idx on public.subjects (class_id, position);

create table public.chapters (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  class_id   uuid not null references public.classes (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index chapters_subject_idx on public.chapters (subject_id, position);

-- class_id recopié depuis la matière (simplifie la RLS).
create or replace function public.chapters_set_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select s.class_id into new.class_id from public.subjects s where s.id = new.subject_id;
  return new;
end;
$$;

create trigger chapters_set_class
  before insert or update of subject_id on public.chapters
  for each row execute function public.chapters_set_class();

-- -----------------------------------------------------------------------------
-- Fiches
-- -----------------------------------------------------------------------------

create table public.sheets (
  id               uuid primary key default gen_random_uuid(),
  chapter_id       uuid not null references public.chapters (id) on delete cascade,
  class_id         uuid not null references public.classes (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 120),
  description      text check (char_length(description) <= 500),
  file_path        text not null,
  file_size        integer not null check (file_size > 0 and file_size <= 10485760),
  page_count       integer,
  -- Contributions (étape 8) : rien n'est visible avant validation.
  status           text not null default 'published' check (status in ('pending', 'published', 'rejected')),
  author_id        uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index sheets_chapter_idx on public.sheets (chapter_id);
create index sheets_class_published_idx on public.sheets (class_id, published_at desc) where status = 'published';

create or replace function public.sheets_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select c.class_id into new.class_id from public.chapters c where c.id = new.chapter_id;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger sheets_before_write
  before insert or update on public.sheets
  for each row execute function public.sheets_before_write();

-- -----------------------------------------------------------------------------
-- Favoris et consultations
-- -----------------------------------------------------------------------------

create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  sheet_id   uuid not null references public.sheets (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sheet_id)
);
create index favorites_sheet_idx on public.favorites (sheet_id);

-- Une ligne max par élève, fiche et jour.
create table public.sheet_views (
  sheet_id uuid not null references public.sheets (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  day      date not null default public.paris_today(),
  primary key (sheet_id, user_id, day)
);
create index sheet_views_day_idx on public.sheet_views (day);

create or replace function public.record_sheet_view(p_sheet_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.sheet_views (sheet_id, user_id)
  select p_sheet_id, auth.uid()
  where exists (select 1 from public.sheets s where s.id = p_sheet_id) -- RLS : fiche visible
  on conflict do nothing;
$$;

-- -----------------------------------------------------------------------------
-- Statistiques admin
-- -----------------------------------------------------------------------------

create or replace function public.admin_stats(p_class_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.paris_today();
  result  jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIS' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'students', (select count(*) from public.profiles p
                 where p.role = 'eleve' and (p_class_id is null or p.class_id = p_class_id)),
    'active_today', (select count(*) from public.profiles p
                 where p.role = 'eleve' and p.last_seen_on = v_today
                   and (p_class_id is null or p.class_id = p_class_id)),
    'active_7d', (select count(*) from public.profiles p
                 where p.role = 'eleve' and p.last_seen_on > v_today - 7
                   and (p_class_id is null or p.class_id = p_class_id)),
    'active_30d', (select count(*) from public.profiles p
                 where p.role = 'eleve' and p.last_seen_on > v_today - 30
                   and (p_class_id is null or p.class_id = p_class_id)),
    'sheets', (select count(*) from public.sheets s
                 where s.status = 'published' and (p_class_id is null or s.class_id = p_class_id)),
    'top_sheets', coalesce((
      select jsonb_agg(t order by t.views desc, t.title)
      from (
        select s.id, s.title, count(v.*)::int as views, count(distinct v.user_id)::int as readers
        from public.sheets s
        join public.sheet_views v on v.sheet_id = s.id and v.day > v_today - 30
        where p_class_id is null or s.class_id = p_class_id
        group by s.id, s.title
        order by views desc, s.title
        limit 10
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.subjects    enable row level security;
alter table public.chapters    enable row level security;
alter table public.sheets      enable row level security;
alter table public.favorites   enable row level security;
alter table public.sheet_views enable row level security;

-- Matières et chapitres : lecture par la classe, écriture par l'admin.
create policy "subjects_select" on public.subjects for select to authenticated
  using (class_id = public.my_class_id() or public.is_admin());
create policy "subjects_admin_insert" on public.subjects for insert to authenticated
  with check (public.is_admin());
create policy "subjects_admin_update" on public.subjects for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "subjects_admin_delete" on public.subjects for delete to authenticated
  using (public.is_admin());

create policy "chapters_select" on public.chapters for select to authenticated
  using (class_id = public.my_class_id() or public.is_admin());
create policy "chapters_admin_insert" on public.chapters for insert to authenticated
  with check (public.is_admin());
create policy "chapters_admin_update" on public.chapters for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "chapters_admin_delete" on public.chapters for delete to authenticated
  using (public.is_admin());

-- Fiches : la classe ne voit que les fiches publiées ; l'auteur voit les siennes.
create policy "sheets_select" on public.sheets for select to authenticated
  using (
    public.is_admin()
    or (class_id = public.my_class_id() and status = 'published')
    or author_id = auth.uid()
  );
create policy "sheets_admin_insert" on public.sheets for insert to authenticated
  with check (public.is_admin());
create policy "sheets_admin_update" on public.sheets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "sheets_admin_delete" on public.sheets for delete to authenticated
  using (public.is_admin());

-- Favoris : strictement personnels.
create policy "favorites_select_own" on public.favorites for select to authenticated
  using (user_id = auth.uid());
create policy "favorites_insert_own" on public.favorites for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.sheets s where s.id = sheet_id));
create policy "favorites_delete_own" on public.favorites for delete to authenticated
  using (user_id = auth.uid());

-- Consultations : écrites par l'élève, lues par l'admin (via admin_stats).
create policy "sheet_views_insert_own" on public.sheet_views for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.sheets s where s.id = sheet_id));
create policy "sheet_views_admin_select" on public.sheet_views for select to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Storage : bucket privé « sheets »
--   published/{class_id}/{uuid}.pdf      fiches publiées (écriture admin)
--   contributions/{user_id}/{uuid}.pdf   propositions des élèves (étape 8)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sheets', 'sheets', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

create policy "sheets_files_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'sheets' and (
      public.is_admin()
      or exists (
        select 1 from public.sheets s
        where s.file_path = storage.objects.name
          and s.status = 'published'
          and s.class_id = public.my_class_id()
      )
      or ((storage.foldername(name))[1] = 'contributions'
          and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

create policy "sheets_files_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'sheets' and public.is_admin());
create policy "sheets_files_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'sheets' and public.is_admin());
create policy "sheets_files_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'sheets' and public.is_admin());

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------

revoke execute on function public.ping() from public, anon;
revoke execute on function public.admin_stats(uuid) from public, anon;
revoke execute on function public.record_sheet_view(uuid) from public, anon;
grant execute on function public.ping() to authenticated;
grant execute on function public.admin_stats(uuid) to authenticated;
grant execute on function public.record_sheet_view(uuid) to authenticated;
