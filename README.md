# Fiches de révision

Application web installable (PWA) pour réviser en classe : fiches PDF, flashcards à répétition espacée, compte à rebours des contrôles, streaks et classement.

- **Front** : React + Vite + TypeScript, Tailwind CSS, vite-plugin-pwa
- **Back** : Supabase (Auth, Postgres + RLS, Storage, Edge Functions, pg_cron)
- **Hébergement** : Cloudflare Pages
- 100 % gratuit (plans gratuits Supabase et Cloudflare)

La conception (schéma de base de données, politiques RLS, arborescence) est décrite dans [`docs/CONCEPTION.md`](docs/CONCEPTION.md).

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Projet, PWA, auth, classes, onboarding d'installation | ✅ |
| 2 | Matières / chapitres / fiches PDF, lecteur, hors ligne, admin de base | ✅ |
| 3 | Flashcards (répétition espacée) | à venir |
| 4 | Contrôles, compte à rebours, révision du jour | à venir |
| 5 | Streaks, XP, classement | à venir |
| 6 | Demandes de fiches + votes | à venir |
| 7 | Questions / réponses + signalements | à venir |
| 8 | Contributions + file de validation | à venir |
| 9 | Notifications push | à venir |

---

## 1. Créer le projet Supabase

1. Crée un compte sur [supabase.com](https://supabase.com), puis **New project**.
   - Région : **Europe (Paris – `eu-west-3`)** ou **Frankfurt**.
   - Note bien le mot de passe de la base de données.
2. Dans **Project Settings → API**, copie :
   - `Project URL` → `VITE_SUPABASE_URL`
   - la clé `anon` / `publishable` → `VITE_SUPABASE_ANON_KEY`
   - ⚠️ ne mets **jamais** la clé `service_role` dans le front ni dans Git.

### 1.1 Exécuter les migrations

**Option simple (sans rien installer)** : dans Supabase → **SQL Editor**, colle et exécute **dans l'ordre** chaque fichier de `supabase/migrations/` (`0001_core.sql`, puis les suivants au fil des étapes), puis `supabase/seed.sql`.

**Option CLI** :

```bash
npx supabase login
npx supabase link --project-ref <ref-du-projet>   # ref = l'identifiant dans l'URL du projet
npx supabase db push                               # applique supabase/migrations
```

Puis exécute `supabase/seed.sql` dans le SQL Editor (données de test).

La migration `0002_sheets.sql` crée aussi le bucket Storage privé **`sheets`** (PDF uniquement, 10 Mo max). Rien à faire à la main.

#### PDF de démonstration

Le seed crée 5 fiches de démo, dont les PDF sont dans `supabase/seed-files/`. Pour les envoyer dans Storage :

```bash
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=<clé service_role> node scripts/upload-seed-files.mjs
```

(La clé `service_role` se trouve dans Project Settings → API. Utilise-la seulement dans ton terminal, jamais dans l'app ni dans Git.)

Le seed crée deux classes de démonstration :

| Classe | Code d'invitation |
|---|---|
| Ma classe (démo) | `DEMO42` |
| Autre classe (test) | `TEST22` |

### 1.2 Réglages d'authentification

Dans **Authentication → Sign In / Providers → Email** :

- **Email** activé.
- **Minimum password length** : `8`.

Dans **Authentication → URL Configuration** :

- **Site URL** : l'adresse de ton site Cloudflare (ex. `https://fiches-revision.pages.dev`). En local : `http://localhost:5173`.
- **Redirect URLs** : ajoute `http://localhost:5173/**` et `https://<ton-site>.pages.dev/**`.

#### Emails (confirmation et mot de passe oublié)

Le service email intégré à Supabase est très limité (quelques emails par heure, et seulement vers les adresses des membres de l'équipe du projet). Deux possibilités :

**A. Recommandé : brancher un SMTP gratuit (Brevo, 300 emails/jour)**

1. Crée un compte sur [brevo.com](https://www.brevo.com) et vérifie ton adresse d'expéditeur.
2. Dans Brevo → **SMTP & API**, crée une clé SMTP.
3. Dans Supabase → **Authentication → Emails → SMTP Settings**, active **Custom SMTP** :
   - Host `smtp-relay.brevo.com`, port `587`
   - Username : ton identifiant SMTP Brevo, Password : la clé SMTP
   - Sender email : l'adresse vérifiée, Sender name : `Fiches de révision`
4. (Facultatif) Traduis les modèles d'emails en français dans **Authentication → Emails → Templates**.

**B. Sans SMTP** : désactive **Confirm email** (Authentication → Sign In / Providers → Email). Les élèves pourront se connecter directement après l'inscription, mais « Mot de passe oublié » ne fonctionnera pas de façon fiable : tu pourras alors changer un mot de passe toi-même depuis **Authentication → Users**.

### 1.3 Devenir admin

1. Lance l'app (section 3) et inscris-toi normalement avec le code `DEMO42` (ou le code de ta vraie classe).
2. Dans le SQL Editor :

```sql
update public.profiles set role = 'admin' where pseudo = 'TonPseudo';
```

3. Recharge l'app : **Profil → Espace admin** apparaît. Tu peux y créer ta vraie classe, récupérer son code et son lien d'inscription, puis fermer ou supprimer les classes de démo.

> Les comptes doivent être créés depuis l'app : « Add user » dans le tableau de bord Supabase échoue, car l'inscription exige un pseudo et un code de classe.

### 1.4 Déployer les Edge Functions

```bash
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase functions deploy delete-account
```

`delete-account` permet à un élève de supprimer son compte et toutes ses données depuis son profil. Les variables `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies automatiquement par Supabase.

---

## 2. Clés VAPID (notifications push, étape 9)

Les notifications Web Push nécessitent une paire de clés VAPID, à générer **une seule fois** :

```bash
npx web-push generate-vapid-keys
```

- **Public Key** → variable `VITE_VAPID_PUBLIC_KEY` (front : `.env.local` et Cloudflare).
- **Private Key** → secret Supabase (jamais dans le front ni dans Git) :

```bash
npx supabase secrets set VAPID_PUBLIC_KEY=<clé publique> VAPID_PRIVATE_KEY=<clé privée> VAPID_SUBJECT=mailto:<ton-email>
```

Garde ces clés : si tu les changes, tous les abonnements existants deviennent invalides. La suite de la configuration (pg_cron) sera détaillée à l'étape 9.

---

## 3. Lancer en local

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
npm install
cp .env.example .env.local     # puis remplis les valeurs
npm run dev                    # http://localhost:5173
```

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm run build` | build de production dans `dist/` (avec service worker) |
| `npm run preview` | sert le build : nécessaire pour tester la PWA (service worker inactif en `dev`) |
| `npm run typecheck` | vérification TypeScript |
| `npm run test:db` | exécute les migrations + seed dans un Postgres embarqué et teste les politiques RLS |

Pour tester sur ton téléphone en local : `npm run build && npx vite preview --host`, puis ouvre `http://<ip-de-ton-ordi>:4173`. L'installation et les notifications exigent HTTPS : teste-les plutôt sur le site Cloudflare.

---

## 4. Déployer sur Cloudflare Pages

1. Pousse le dépôt sur GitHub.
2. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git**, puis choisis le dépôt.
3. Paramètres de build :
   - Framework preset : **Vite** (ou aucun)
   - Build command : `npm run build`
   - Build output directory : `dist`
4. **Environment variables** (Production et Preview) :
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`
   - `NODE_VERSION` = `22`
5. **Save and Deploy**. L'adresse sera du type `https://<projet>.pages.dev`.
6. Reporte cette adresse dans Supabase (**Site URL** et **Redirect URLs**, voir 1.2).

Chaque push sur la branche principale redéploie automatiquement. Le routage de l'application (SPA) est géré par Cloudflare Pages, et les en-têtes de cache et de sécurité sont dans `public/_headers`.

---

## 5. Tester l'étape 1

- [ ] Inscription avec un code de classe valide (`DEMO42`) : le nom de la classe s'affiche sous le champ.
- [ ] Inscription refusée avec un code invalide ou un pseudo déjà pris.
- [ ] Connexion, déconnexion, mot de passe oublié (si SMTP configuré).
- [ ] Au premier lancement dans le navigateur, le guide d'installation s'affiche (onglet iPhone sur iPhone, Android sur Android).
- [ ] iPhone : Safari → Partager → Sur l'écran d'accueil → l'app s'ouvre en plein écran, sans bannière.
- [ ] iPhone dans Safari (non installée) : la bannière « Installe l'app » apparaît en haut ; elle se masque 3 jours avec ×.
- [ ] Android (Chrome) : le bouton « Installer l'application » ouvre la fenêtre d'installation.
- [ ] Profil : changement de pseudo, thème Auto / Clair / Sombre, option « Apparaître dans le classement », page Confidentialité.
- [ ] Suppression de compte (après le déploiement de `delete-account`) : le compte disparaît de **Authentication → Users**.
- [ ] Admin : créer une classe, copier le code ou le lien d'inscription, régénérer le code, fermer les inscriptions, voir les élèves, bloquer/débloquer un élève, le changer de classe.
- [ ] Un élève bloqué voit un message de compte suspendu.

## 6. Tester l'étape 2

- [ ] Onglet **Fiches** : nouveautés, matières (avec le nombre de fiches), recherche sans accents (« revolution » trouve « Révolution »).
- [ ] Une matière affiche ses chapitres et leurs fiches.
- [ ] Une fiche s'ouvre dans le lecteur : zoom −/+, plein écran (sur iPhone : l'app passe en plein écran, sans barre de navigation).
- [ ] Favoris : l'étoile ajoute ou retire la fiche de l'onglet **Favoris**.
- [ ] **Télécharger pour hors ligne**, puis mode avion : l'onglet **Hors ligne** liste la fiche, et elle s'ouvre.
- [ ] L'accueil affiche les nouveautés (fiches publiées depuis moins de 14 jours).
- [ ] Admin → **Matières, chapitres et fiches** : créer une matière (icône, couleur), un chapitre, publier un PDF ; modifier, réordonner, remplacer le PDF, supprimer.
- [ ] Un PDF de plus de 10 Mo, ou un fichier qui n'est pas un PDF, est refusé.
- [ ] Admin → **Statistiques** : élèves actifs, fiches les plus consultées (après quelques ouvertures).
- [ ] Un élève d'une autre classe ne voit pas ces fiches.

> **Hors ligne sur iPhone** : les fiches téléchargées restent disponibles dans l'app installée sur l'écran d'accueil. Dans Safari (non installée), iOS peut effacer les données d'un site après quelques semaines sans visite.

## Limites des plans gratuits

| Service | Limite gratuite | Usage prévu |
|---|---|---|
| Supabase base de données | 500 Mo | < 50 Mo pour une classe |
| Supabase Storage | 1 Go, fichiers ≤ 50 Mo | fiches ≤ 10 Mo (≈ 150–300 PDF) |
| Supabase Edge Functions | 500 000 appels/mois | ≈ 45 000 (push chaque minute) |
| Supabase | pause après 7 jours sans activité | réactivation en un clic depuis le tableau de bord |
| Cloudflare Pages | 500 builds/mois, bande passante illimitée | largement suffisant |
