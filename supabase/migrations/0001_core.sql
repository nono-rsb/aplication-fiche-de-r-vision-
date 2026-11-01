-- =============================================================================
-- 0001_core.sql — Étape 1 : classes, profils, réglages, fonctions utilitaires
-- =============================================================================
-- Toutes les tables ont la Row Level Security activée.
-- Les fonctions SECURITY DEFINER ont un search_path vide : tout est qualifié.

-- -----------------------------------------------------------------------------
-- Fonctions de base (dates)
-- -----------------------------------------------------------------------------

-- Date du jour à Paris : référence pour streaks, révision du jour, classement.
create or replace function public.paris_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (pg_catalog.now() at time zone 'Europe/Paris')::date;
$$;

-- Lundi de la semaine en cours (heure de Paris) : classement hebdomadaire.
create or replace function public.paris_week_start()
returns date
language sql
stable
set search_path = ''
as $$
  select (public.paris_today() - ((extract(isodow from public.paris_today())::int - 1)))::date;
$$;

-- -----------------------------------------------------------------------------
-- Classes
-- -----------------------------------------------------------------------------

-- Code d'invitation : 6 caractères sans caractères ambigus (0/O, 1/I/L).
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes c where c.invite_code = code);
  end loop;
  return code;
end;
$$;

create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{4,12}$'),
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.classes
  alter column invite_code set default public.generate_invite_code();

-- -----------------------------------------------------------------------------
-- Profils (données visibles par la classe) et réglages (privés)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  pseudo          text not null check (pseudo ~ '^[A-Za-z0-9_.-]{3,20}$'),
  class_id        uuid references public.classes (id) on delete restrict,
  role            text not null default 'eleve' check (role in ('eleve', 'admin')),
  is_blocked      boolean not null default false,
  xp_total        integer not null default 0,
  current_streak  integer not null default 0,
  best_streak     integer not null default 0,
  last_active_day date,
  created_at      timestamptz not null default now()
);

-- Pseudo unique sans tenir compte des majuscules (« Lea » = « lea »).
create unique index profiles_pseudo_lower_key on public.profiles (lower(pseudo));
create index profiles_class_id_idx on public.profiles (class_id);

create table public.user_settings (
  user_id                 uuid primary key references public.profiles (id) on delete cascade,
  show_in_leaderboard     boolean not null default true,
  reminder_time           time not null default '18:00',
  notif_new_sheet         boolean not null default true,
  notif_answer            boolean not null default true,
  notif_request_published boolean not null default true,
  notif_daily_reminder    boolean not null default true,
  notif_streak            boolean not null default true,
  updated_at              timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Fonctions d'autorisation (utilisées par les politiques RLS)
-- SECURITY DEFINER pour éviter la récursion RLS sur profiles.
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.my_class_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.class_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_blocked()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_blocked from public.profiles p where p.id = auth.uid()),
    true  -- pas de profil = pas d'écriture
  );
$$;

-- -----------------------------------------------------------------------------
-- Inscription
-- -----------------------------------------------------------------------------

-- Vérification du code de classe avant l'inscription (appelable sans compte).
create or replace function public.check_invite_code(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.name
  from public.classes c
  where c.invite_code = upper(btrim(p_code)) and c.is_open;
$$;

-- Disponibilité d'un pseudo (appelable sans compte).
create or replace function public.is_pseudo_available(p_pseudo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles p where lower(p.pseudo) = lower(btrim(p_pseudo))
  );
$$;

-- Création du profil à l'inscription. Les métadonnées viennent de
-- supabase.auth.signUp({ options: { data: { pseudo, invite_code } } }).
-- Si le code ou le pseudo est invalide, l'inscription est annulée.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pseudo   text := btrim(coalesce(new.raw_user_meta_data ->> 'pseudo', ''));
  v_code     text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_class_id uuid;
begin
  select c.id into v_class_id
  from public.classes c
  where c.invite_code = v_code and c.is_open;

  if v_class_id is null then
    raise exception 'CODE_CLASSE_INVALIDE' using errcode = 'P0001';
  end if;

  if v_pseudo !~ '^[A-Za-z0-9_.-]{3,20}$' then
    raise exception 'PSEUDO_INVALIDE' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.profiles p where lower(p.pseudo) = lower(v_pseudo)) then
    raise exception 'PSEUDO_PRIS' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, pseudo, class_id)
  values (new.id, v_pseudo, v_class_id);

  insert into public.user_settings (user_id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Protection des colonnes sensibles de profiles
-- Un élève ne peut modifier que son pseudo. Les fonctions serveur
-- (SECURITY DEFINER, exécutées en tant que propriétaire) ne sont pas concernées.
-- -----------------------------------------------------------------------------

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.id              is distinct from old.id
    or new.class_id        is distinct from old.class_id
    or new.role            is distinct from old.role
    or new.is_blocked      is distinct from old.is_blocked
    or new.xp_total        is distinct from old.xp_total
    or new.current_streak  is distinct from old.current_streak
    or new.best_streak     is distinct from old.best_streak
    or new.last_active_day is distinct from old.last_active_day
    or new.created_at      is distinct from old.created_at
    then
      raise exception 'MODIFICATION_INTERDITE' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_settings_touch
  before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Administration des classes
-- -----------------------------------------------------------------------------

create or replace function public.regenerate_invite_code(p_class_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIS' using errcode = '42501';
  end if;
  v_code := public.generate_invite_code();
  update public.classes set invite_code = v_code where id = p_class_id;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.classes       enable row level security;
alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;

-- classes : un élève voit sa classe ; l'admin gère tout.
create policy "classes_select" on public.classes
  for select to authenticated
  using (id = public.my_class_id() or public.is_admin());

create policy "classes_admin_insert" on public.classes
  for insert to authenticated with check (public.is_admin());

create policy "classes_admin_update" on public.classes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "classes_admin_delete" on public.classes
  for delete to authenticated using (public.is_admin());

-- profiles : visibles par la même classe (pseudo, XP, streak) ; modifiables
-- par soi-même (pseudo uniquement, cf. trigger) ou par l'admin.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or class_id = public.my_class_id() or public.is_admin());

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "profiles_admin_delete" on public.profiles
  for delete to authenticated using (public.is_admin());
-- Pas de politique INSERT : seul le trigger d'inscription crée les profils.

-- user_settings : strictement privé.
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (user_id = auth.uid());

create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.check_invite_code(text)   to anon, authenticated;
grant execute on function public.is_pseudo_available(text) to anon, authenticated;
