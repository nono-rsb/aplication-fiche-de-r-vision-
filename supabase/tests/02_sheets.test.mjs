// Étape 2 : matières, chapitres, fiches, favoris, vues, stockage
import { signup } from './01_core.test.mjs'

const A = '11111111-1111-4111-8111-111111111111' // admin (créé en 01)
const E1 = '22222222-2222-4222-8222-222222222222' // élève classe démo
const E3 = '44444444-4444-4444-8444-444444444444' // élève autre classe
const S1 = '30000000-0000-4000-8000-000000000001'

export default async ({ db, as, ok, fails }) => {
  const otherCode = (await db.query(`select invite_code from public.classes where id = '00000000-0000-4000-8000-000000000002'`)).rows[0].invite_code
  await signup(db, E3, 'Nina', otherCode)

  ok((await as(E1, `select count(*)::int c from public.subjects`)).rows[0].c === 5, 'élève voit les matières de sa classe')
  ok((await as(E3, `select count(*)::int c from public.subjects`)).rows[0].c === 0, "élève d'une autre classe ne voit rien")
  ok((await as(E1, `select count(*)::int c from public.sheets`)).rows[0].c === 5, 'élève voit les fiches publiées')
  ok((await db.query(`select class_id from public.chapters where id = '20000000-0000-4000-8000-000000000001'`)).rows[0].class_id === '00000000-0000-4000-8000-000000000001', 'class_id recopié sur les chapitres')

  // Fiche en attente : invisible pour la classe
  await db.query(`insert into public.sheets (id, chapter_id, title, file_path, file_size, status, author_id)
    values ('30000000-0000-4000-8000-0000000000aa', '20000000-0000-4000-8000-000000000001', 'Brouillon', 'contributions/x/a.pdf', 100, 'pending', $1)`, [A])
  ok((await as(E1, `select count(*)::int c from public.sheets where status = 'pending'`)).rows[0].c === 0, 'fiche en attente invisible')
  ok((await db.query(`select published_at from public.sheets where id = '30000000-0000-4000-8000-0000000000aa'`)).rows[0].published_at === null, 'pas de date de publication pour une fiche en attente')

  // Écritures
  await fails(() => as(E1, `insert into public.subjects (class_id, name) values ('00000000-0000-4000-8000-000000000001', 'Pirate')`), 'élève ne crée pas de matière')
  const r = await as(E1, `update public.sheets set title = 'X' where id = $1`, [S1])
  ok(r.affectedRows === 0, 'élève ne modifie pas une fiche')
  await as(A, `insert into public.subjects (class_id, name) values ('00000000-0000-4000-8000-000000000001', 'Philo')`)
  ok((await as(E1, `select count(*)::int c from public.subjects`)).rows[0].c === 6, 'admin crée une matière')
  await fails(() => as(A, `insert into public.sheets (chapter_id, title, file_path, file_size) values ('20000000-0000-4000-8000-000000000001', 'Trop gros', 'x.pdf', 20000000)`), 'fiche > 10 Mo refusée')

  // Favoris
  await as(E1, `insert into public.favorites (user_id, sheet_id) values ($1, $2)`, [E1, S1])
  ok((await as(E1, `select count(*)::int c from public.favorites`)).rows[0].c === 1, 'ajout aux favoris')
  await fails(() => as(E3, `insert into public.favorites (user_id, sheet_id) values ($1, $2)`, [E3, S1]), "pas de favori sur une fiche d'une autre classe")
  await fails(() => as(E1, `insert into public.favorites (user_id, sheet_id) values ($1, $2)`, [E3, S1]), "pas de favori au nom d'un autre")
  ok((await as(A, `select count(*)::int c from public.favorites`)).rows[0].c === 0, 'favoris privés (même pour l’admin)')

  // Vues et statistiques
  await as(E1, `select public.record_sheet_view($1)`, [S1])
  await as(E1, `select public.record_sheet_view($1)`, [S1])
  await as(E3, `select public.record_sheet_view($1)`, [S1])
  ok((await db.query(`select count(*)::int c from public.sheet_views`)).rows[0].c === 1, 'une vue par jour, fiche invisible ignorée')
  await as(E1, `select public.ping()`)
  const stats = (await as(A, `select public.admin_stats('00000000-0000-4000-8000-000000000001') s`)).rows[0].s
  ok(stats.active_today === 1 && stats.top_sheets[0]?.views === 1 && stats.sheets === 5, 'statistiques admin')
  await fails(() => as(E1, `select public.admin_stats()`), 'statistiques réservées à l’admin')

  // Stockage
  await db.query(`insert into storage.objects (bucket_id, name) values
    ('sheets', 'published/00000000-0000-4000-8000-000000000001/${S1}.pdf'),
    ('sheets', 'contributions/x/a.pdf'),
    ('sheets', 'contributions/${E1}/b.pdf')`)
  const files = (await as(E1, `select name from storage.objects order by name`)).rows.map((r) => r.name)
  ok(files.length === 2 && files.some((n) => n.includes(S1)) && files.some((n) => n.includes(E1)), 'fichiers visibles : fiches publiées de la classe + mes contributions')
  ok((await as(E3, `select count(*)::int c from storage.objects`)).rows[0].c === 0, "pas d'accès aux fichiers d'une autre classe")
  await fails(() => as(E1, `insert into storage.objects (bucket_id, name) values ('sheets', 'published/x/y.pdf')`), "élève n'envoie pas de fichier publié")

  // Nettoyage pour les tests suivants
  await db.query(`delete from public.sheets where id = '30000000-0000-4000-8000-0000000000aa'`)
  await db.query(`delete from public.subjects where name = 'Philo'`)
}
