# Conception — Application de fiches de révision (V1)

> Document à valider avant de commencer le développement.
> Stack : React + Vite + TypeScript · Tailwind · vite-plugin-pwa · Supabase (Auth, Postgres + RLS, Storage, Edge Functions, pg_cron, pg_net) · Cloudflare Pages.

---

## 1. Principes structurants

| Sujet | Décision |
|---|---|
| **Multi-classes** | Chaque élève appartient à **une** classe (`profiles.class_id`), rejointe via un code d'invitation. Tout contenu « de classe » porte un `class_id` (dénormalisé par trigger sur les tables enfants) → politiques RLS simples : `class_id = my_class_id()`. |
| **Rôles** | `profiles.role` ∈ `eleve` / `admin`. L'admin voit et gère toutes les classes. Le premier admin est promu à la main par une requête SQL (expliqué dans le README). |
| **Sécurité** | RLS activée sur **toutes** les tables. Les élèves ne peuvent jamais modifier `role`, `is_blocked`, `class_id`, les XP ni les streaks : ces valeurs ne changent que via des fonctions `SECURITY DEFINER` (RPC) ou des triggers. |
| **Fuseau horaire** | Fonction `paris_today()` = `(now() at time zone 'Europe/Paris')::date`. Toutes les notions de « jour » (streak, révision du jour, classement hebdo, rappels) l'utilisent. Semaine = lundi → dimanche. |
| **Logique sensible côté serveur** | Révision d'une carte (SM-2 + XP), validation de contribution, génération du planning, classement : RPC Postgres. Le client ne peut pas tricher sur les XP. |
| **Contributions** | Pas de table séparée : une fiche ou un paquet a un `status` (`pending` / `published` / `rejected`) et un `author_id`. Rien n'est visible par la classe tant que `status <> 'published'`. La file admin est une vue sur les éléments `pending`. |
| **Notifications** | Les triggers écrivent dans `notifications` (sert aussi de centre de notifications in-app). Une Edge Function `push-dispatch`, appelée chaque minute par pg_cron via pg_net, envoie les Web Push non encore envoyés. |
| **Données minimales** | Stockées : email (dans `auth.users`, géré par Supabase), pseudo, classe, activité de révision. Pas de nom, pas de date de naissance, pas de photo, pas de messagerie privée. |
| **Suppression de compte** | Edge Function `delete-account` (clé service) → `auth.admin.deleteUser()` → cascade sur toutes les tables. Fiches publiées issues d'une contribution : conservées, crédit retiré (`author_id = null`). |

---

## 2. Schéma de la base de données

### 2.1 Vue d'ensemble des relations

```
auth.users 1─1 profiles ─┬─ 1─1 user_settings
                         ├─ n─1 classes
                         ├─ 1─n push_subscriptions
                         ├─ 1─n notifications
                         ├─ 1─n favorites ─────────── n─1 sheets
                         ├─ 1─n card_progress ─────── n─1 cards
                         ├─ 1─n review_logs
                         ├─ 1─n daily_activity
                         ├─ 1─n xp_events
                         ├─ 1─n plan_items ────────── n─1 exams
                         └─ 1─n sheet_views

classes 1─n subjects 1─n chapters 1─n sheets 1─n questions 1─n answers
                              │          └─ 1─n decks (optionnel : paquet lié à une fiche)
                              └─ 1─n decks 1─n cards

classes 1─n exams n─n chapters      (via exam_chapters)
classes 1─n sheet_requests 1─n sheet_request_votes
reports → cible polymorphe (question | answer | sheet | deck)
```

### 2.2 Tables

#### `classes`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | ex. « 1re G3 » |
| invite_code | text unique | 6–8 caractères, généré, régénérable par l'admin |
| is_open | bool default true | si false, le code ne permet plus de s'inscrire |
| created_at | timestamptz | |

#### `profiles` (1 ligne par utilisateur, créée par trigger à l'inscription)
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK → auth.users on delete cascade | |
| pseudo | text, unique sans tenir compte de la casse (index sur `lower(pseudo)`) | 3–20 caractères, `^[a-zA-Z0-9_.-]+$` |
| class_id | uuid → classes | |
| role | text check in ('eleve','admin') default 'eleve' | |
| is_blocked | bool default false | bloque toute écriture (questions, votes, contributions…) |
| xp_total | int default 0 | maintenu par trigger sur `xp_events` |
| current_streak / best_streak | int | maintenus par la fonction `touch_activity()` |
| last_active_day | date | |
| created_at | timestamptz | |

#### `user_settings` (privé, séparé de `profiles` qui est lisible par la classe)
| Colonne | Type | Notes |
|---|---|---|
| user_id | uuid PK → profiles | |
| show_in_leaderboard | bool default true | |
| reminder_time | time default '18:00' | heure de Paris |
| notif_new_sheet, notif_answer, notif_request_published, notif_daily_reminder, notif_streak | bool default true | |

#### `subjects`, `chapters`
| Table | Colonnes |
|---|---|
| subjects | id, class_id, name, color (hex), icon (emoji), position |
| chapters | id, subject_id, class_id (trigger), title, position |

#### `sheets` (fiches PDF)
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | |
| chapter_id | uuid → chapters on delete cascade | |
| class_id | uuid | rempli par trigger |
| title, description | text | |
| file_path | text | chemin dans le bucket Storage `sheets` |
| file_size | int | ≤ 10 Mo (contrôlé aussi par le bucket) |
| status | text check in ('pending','published','rejected') | |
| author_id | uuid → profiles on delete set null | contributeur crédité (null = admin) |
| rejection_reason | text | |
| reviewed_by, reviewed_at | | |
| published_at | timestamptz | sert à « Nouveautés » |
| search | tsvector généré (titre + description, config `french`) | recherche plein texte |
| created_at, updated_at | | |

#### `favorites`
(user_id, sheet_id) PK, created_at.

#### `sheet_views` (stats « fiches les plus consultées » + « élèves actifs »)
(sheet_id, user_id, day) PK — une ligne max par élève/fiche/jour.

#### `decks` (paquets de flashcards)
id, class_id (trigger), chapter_id → chapters, sheet_id → sheets (nullable), title, status, author_id, rejection_reason, reviewed_by, reviewed_at, published_at, created_at.

#### `cards`
id, deck_id → decks on delete cascade, front text (≤ 500), back text (≤ 1000), position.

#### `card_progress` (progression SM-2 propre à chaque élève)
| Colonne | Notes |
|---|---|
| user_id, card_id | PK composite |
| ease_factor numeric default 2.5 | min 1.3 |
| interval_days int default 0 | |
| repetitions int default 0 | |
| lapses int default 0 | |
| due_on date | « À réviser aujourd'hui » = `due_on <= paris_today()` + cartes jamais vues |
| last_reviewed_at | |

#### `review_logs`
id, user_id, card_id, rating smallint (0 Raté · 1 Difficile · 2 Bien · 3 Facile), day date, created_at. Purgé après 90 jours par pg_cron.

**SM-2 simplifié** (fonction `review_card(card_id, rating)`) :
- note interne q = 1 / 3 / 4 / 5 ; `EF ← max(1.3, EF + 0.1 − (5−q)(0.08 + (5−q)·0.02))`
- Raté : repetitions = 0, intervalle = 0 (la carte revient dans la session), lapses + 1
- Sinon : 1re réussite → 1 j, 2e → 3 j (Difficile) / 6 j (Bien) / 8 j (Facile), ensuite `intervalle × EF` (× 1,2 seulement si Difficile, × 1,3 bonus si Facile)

#### `exams` (contrôles) et `exam_chapters`
| Table | Colonnes |
|---|---|
| exams | id, class_id, subject_id, title (ex. « Contrôle Chap. 3 »), exam_date date, created_by, created_at, updated_at |
| exam_chapters | (exam_id, chapter_id) PK |

#### `plan_items` (planning « Ma révision du jour », propre à chaque élève)
| Colonne | Notes |
|---|---|
| id | |
| user_id, exam_id | |
| day | date |
| kind | 'sheet' \| 'deck' \| 'general_review' |
| sheet_id / deck_id | selon `kind` |
| done, done_at | case cochée |

Génération par la RPC `get_today_plan()` : pour chaque contrôle à venir de la classe sans planning pour l'élève, les fiches et paquets des chapitres concernés sont répartis équitablement de demain (ou aujourd'hui) jusqu'à J-3 ; J-2 et J-1 = « révision générale » (flashcards de tous les chapitres du contrôle). Si l'admin modifie le contrôle, un trigger supprime les items futurs non cochés → ils sont régénérés à la prochaine ouverture. Si le contrôle est dans moins de 3 jours, tout est en révision générale.

#### `daily_activity` (base du streak)
(user_id, day) PK, cards_reviewed int, plan_completed bool, xp int.
Un jour est « actif » si `plan_completed` OU `cards_reviewed >= 10`. La fonction `touch_activity()` met à jour `current_streak` / `best_streak` dès que le jour devient actif (streak = hier actif ? +1 : 1). Une streak non prolongée aujourd'hui est affichée comme « en danger » ; elle est remise à 0 à la lecture si le dernier jour actif est antérieur à hier.

#### `xp_events` (journal des points — insertion uniquement par le serveur)
| Colonne | Notes |
|---|---|
| id, user_id, class_id | |
| reason | 'card_review' \| 'daily_plan' \| 'contribution_accepted' \| 'helpful_answer' |
| amount | int |
| ref_id | uuid (carte, contribution, réponse…) |
| day, created_at | |

Barème proposé (modifiable) : **1 XP** par carte (1re révision de la carte dans la journée, plafond 150 XP/jour) · **20 XP** révision du jour terminée · **50 XP** contribution acceptée · **15 XP** réponse validée par l'admin (« réponse utile »). Index unique partiel pour empêcher les doublons sur (user_id, reason, ref_id) hors `card_review`.

Classement : RPC `get_leaderboard(period 'week'|'all')` → rang, pseudo, XP, `is_me`. Exclut les élèves avec `show_in_leaderboard = false` (l'élève voit quand même son propre score, sans être visible des autres) et les comptes bloqués.

#### `sheet_requests` et `sheet_request_votes`
| Table | Colonnes |
|---|---|
| sheet_requests | id, class_id, subject_id, chapter_id (nullable), description, author_id, status ('pending','in_progress','published'), sheet_id (lien quand publiée), vote_count (trigger), created_at |
| sheet_request_votes | (request_id, user_id) PK — 1 vote par élève |

Passage à `published` → trigger : notification à tous les votants (+ l'auteur).

#### `questions` et `answers`
| Table | Colonnes |
|---|---|
| questions | id, sheet_id, class_id (trigger), author_id, body (≤ 1000), is_hidden, created_at |
| answers | id, question_id, author_id, body (≤ 2000), is_validated, is_hidden, created_at |

Trigger : nouvelle réponse → notification à l'auteur de la question (sauf s'il répond lui-même). Validation par l'admin → `xp_events` « helpful_answer ».

#### `reports` (signalements)
id, reporter_id, target_type ('question','answer','sheet','deck'), target_id, reason, status ('open','resolved','dismissed'), resolved_by, resolved_at, created_at. Unique (reporter_id, target_type, target_id).

#### `push_subscriptions`
id, user_id, endpoint (unique), p256dh, auth, user_agent, created_at, last_success_at. Supprimée automatiquement par `push-dispatch` si le service push répond 404/410.

#### `notifications`
id, user_id, type ('new_sheet','answer','request_published','daily_reminder','streak_alert','contribution_reviewed'), title, body, url, created_at, sent_at, read_at. Le trigger d'insertion vérifie la préférence correspondante dans `user_settings`. Purge après 30 jours.

#### Emplacement V2 — `ai_quizzes` (non développé)
La migration `0099_v2_placeholder.sql` contiendra uniquement un commentaire décrivant les tables prévues (`ai_quizzes`, `ai_quiz_questions`, `ai_quiz_attempts`, liées à `sheets`), et le front aura un dossier `features/ai-quiz/` avec une carte « Bientôt disponible ». Rien n'est exécuté en V1.

### 2.3 Fonctions utilitaires (SECURITY DEFINER, `search_path` fixé)

| Fonction | Rôle |
|---|---|
| `is_admin()` | rôle de l'utilisateur courant |
| `my_class_id()` | classe de l'utilisateur courant |
| `is_blocked()` | compte bloqué ? |
| `paris_today()` | date du jour à Paris |
| `check_invite_code(code)` | appelable sans connexion, renvoie le nom de la classe (pour l'écran d'inscription) |
| `handle_new_user()` | trigger sur `auth.users` : valide pseudo + code de classe (sinon l'inscription échoue), crée `profiles` + `user_settings` |
| `review_card()`, `get_today_cards()` | flashcards |
| `get_today_plan()`, `toggle_plan_item()` | révision du jour |
| `get_leaderboard()` | classement |
| `vote_request()`, `unvote_request()` | votes |
| `review_contribution(type, id, accept, reason)` | admin : publie/refuse + XP + notification |
| `admin_stats()` | élèves actifs 7/30 j, fiches les plus vues |
| `enqueue_daily_reminders()`, `enqueue_streak_alerts()` | appelées par pg_cron |

### 2.4 Politiques RLS

Légende : **C** = même classe (`class_id = my_class_id()`), **A** = admin, **Moi** = `user_id = auth.uid()`, **¬B** = non bloqué. « RPC » = pas de politique directe, écriture uniquement via fonction serveur.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| classes | sa propre classe · A | A | A | A |
| profiles | C (colonnes publiques : pseudo, rôle, streak, XP) · A | trigger uniquement | Moi : **seulement** `pseudo` (droits par colonne) · A : tout | A (ou suppression de compte) |
| user_settings | Moi · A | trigger | Moi | cascade |
| subjects / chapters | C · A | A | A | A |
| sheets | C **et** `status='published'` · Moi (mes contributions) · A | A · élève ¬B avec `status='pending'` et `author_id = moi` | A | A · Moi si `pending` |
| favorites | Moi | Moi (fiche visible) | — | Moi |
| sheet_views | A | Moi (fiche visible) | — | — |
| decks | comme `sheets` | comme `sheets` | A · Moi si `pending` | A · Moi si `pending` |
| cards | si le paquet est visible | A · Moi si mon paquet `pending` | idem | idem |
| card_progress, review_logs | Moi | RPC | RPC | cascade |
| daily_activity, xp_events | Moi · A | RPC/trigger | RPC/trigger | — |
| exams | C · A | C ¬B (`created_by = moi`) · A | A | A |
| exam_chapters | si l'examen est visible | créateur de l'examen · A | — | A |
| plan_items | Moi | RPC | Moi (seulement `done`) | cascade |
| sheet_requests | C · A | C ¬B | A (statut, lien) | A · Moi si aucun vote |
| sheet_request_votes | C | Moi ¬B, 1 par demande (PK) | — | Moi |
| questions / answers | C et `is_hidden = false` · A | C ¬B, `author_id = moi` | A (masquer, valider) | Moi · A |
| reports | Moi · A | Moi ¬B | A | A |
| push_subscriptions | Moi | Moi | Moi | Moi |
| notifications | Moi | trigger/RPC | Moi (`read_at` uniquement) | Moi |

**Storage** — bucket privé `sheets` (limite 10 Mo, `application/pdf` uniquement) :
- `published/{class_id}/{sheet_id}.pdf` : lecture si la fiche correspondante est publiée dans ma classe ; écriture A.
- `contributions/{user_id}/{uuid}.pdf` : écriture par l'élève dans son propre dossier (¬B) ; lecture par lui-même et A. À l'acceptation, la fonction déplace le fichier vers `published/`.

**Hors ligne** : le PDF est téléchargé via le client Supabase authentifié puis stocké dans le Cache Storage sous une clé stable (`/offline/sheets/{id}.pdf`) — les URL signées changeant à chaque fois, on ne s'appuie pas sur elles pour le cache. Les métadonnées (matières, chapitres, liste des fiches) sont aussi mises en cache pour la navigation hors ligne.

### 2.5 Tâches planifiées (pg_cron, heure UTC convertie en Paris dans les fonctions)

| Fréquence | Tâche |
|---|---|
| chaque minute | `net.http_post` → Edge Function `push-dispatch` (envoie les notifications non envoyées) |
| toutes les 15 min | `enqueue_daily_reminders()` : élèves dont `reminder_time` tombe dans le créneau, n'ayant pas fini leur révision du jour |
| 20 h 00 Paris | `enqueue_streak_alerts()` : streak ≥ 1 et pas d'activité aujourd'hui |
| chaque nuit | purge `review_logs` > 90 j, `notifications` > 30 j |

Budget plan gratuit : ~45 000 invocations Edge Functions / mois (limite 500 000), base < 50 Mo pour une classe, Storage 1 Go ≈ 150–300 fiches PDF.

---

## 3. Arborescence du projet

```
.
├── README.md                      # installation pas à pas (Supabase, VAPID, Cloudflare Pages)
├── .env.example                   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY
├── index.html
├── package.json
├── vite.config.ts                 # vite-plugin-pwa (stratégie injectManifest)
├── tsconfig*.json                 # Tailwind v4 : configuration dans src/index.css
├── scripts/test-db.mjs            # tests SQL/RLS dans un Postgres embarqué (PGlite)
├── public/
│   ├── icons/                     # icônes PWA 192/512/maskable + apple-touch-icon
│   └── _headers                   # en-têtes Cloudflare (cache, sécurité)
├── src/
│   ├── main.tsx · App.tsx · router.tsx
│   ├── sw.ts                      # service worker : précache, PDF hors ligne, push, notificationclick
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.ts            # client typé
│   │   ├── database.types.ts      # généré par `supabase gen types`
│   │   ├── dates.ts               # helpers Europe/Paris, « J-X »
│   │   ├── device.ts              # iOS / Android / standalone
│   │   ├── offline.ts             # téléchargement/suppression des fiches hors ligne
│   │   └── push.ts                # abonnement Web Push
│   ├── hooks/                     # useAuth, useProfile, useInstallPrompt, useOnlineStatus…
│   ├── components/
│   │   ├── ui/                    # Button, Card, Input, Modal, Toast, Spinner, EmptyState
│   │   ├── layout/                # AppShell, BottomNav, TopBar, AdminLayout
│   │   ├── InstallBanner.tsx
│   │   ├── ReportButton.tsx
│   │   └── RequireAuth.tsx · RequireAdmin.tsx
│   └── features/
│       ├── auth/                  # Connexion, Inscription (pseudo + code), Mot de passe oublié
│       ├── onboarding/            # détection appareil, tutoriel iPhone, bouton Android
│       ├── home/                  # cartes J-X, révision du jour, streak, nouveautés
│       ├── sheets/                # matières → chapitres → fiches, recherche, favoris, PdfViewer
│       ├── requests/              # demandes de fiches + votes
│       ├── questions/             # Q/R sous les fiches
│       ├── flashcards/            # paquets, session de révision, « À réviser aujourd'hui »
│       ├── exams/                 # ajout de contrôle, planning, « Ma révision du jour »
│       ├── leaderboard/
│       ├── contributions/         # proposer une fiche / un paquet, suivi de mes propositions
│       ├── notifications/         # centre de notifications in-app
│       ├── profile/               # réglages, notifications, suppression de compte, confidentialité
│       ├── admin/                 # matières, chapitres, fiches, paquets, contrôles, classes,
│       │                          # files (contributions, demandes, signalements), stats
│       └── ai-quiz/               # V2 : emplacement réservé (« Bientôt disponible »)
└── supabase/
    ├── config.toml
    ├── migrations/
    │   ├── 0001_core.sql          # étape 1 : classes, profiles, user_settings, helpers, trigger d'inscription
    │   ├── 0002_sheets.sql        # étape 2 : matières, chapitres, fiches, favoris, vues, Storage
    │   ├── 0003_flashcards.sql    # étape 3
    │   ├── 0004_exams_plan.sql    # étape 4
    │   ├── 0005_gamification.sql  # étape 5
    │   ├── 0006_requests.sql      # étape 6
    │   ├── 0007_questions_reports.sql
    │   ├── 0008_contributions.sql
    │   ├── 0009_push.sql          # étape 9 : subscriptions, notifications, pg_cron
    │   └── 0099_v2_placeholder.sql
    ├── seed.sql                   # classe de test, matières, chapitres, fiches, cartes, contrôles
    └── functions/
        ├── _shared/               # client admin, CORS
        ├── delete-account/
        └── push-dispatch/         # Web Push (VAPID)
```

Librairies prévues (toutes gratuites, légères) : `react-router-dom`, `@tanstack/react-query` (cache + bon comportement hors ligne), `@supabase/supabase-js`, `pdfjs-dist` (chargé à la demande), `vite-plugin-pwa` + `workbox-*`, `lucide-react` (icônes). Côté Edge Function : `web-push` via npm.

---

## 4. Points d'attention

1. **Emails Supabase** : le service email intégré au plan gratuit est très limité (quelques emails/heure, et réservé aux adresses de l'équipe du projet). Pour que les élèves puissent confirmer leur email ou réinitialiser leur mot de passe, il faut brancher un SMTP gratuit (ex. Brevo : 300 emails/jour gratuits). Sinon : désactiver la confirmation d'email, et la réinitialisation de mot de passe passera par toi (admin).
2. **iPhone** : Web Push uniquement en mode installé (iOS ≥ 16.4) ; le bouton « Activer les notifications » n'apparaît qu'en mode standalone.
3. **Projet Supabase gratuit mis en pause après 7 jours d'inactivité** : pendant l'année scolaire l'usage des élèves suffit ; pendant les vacances, il faudra peut-être le réactiver d'un clic depuis le tableau de bord (les données sont conservées).
