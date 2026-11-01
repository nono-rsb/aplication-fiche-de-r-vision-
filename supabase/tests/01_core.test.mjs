// Étape 1 : inscription, profils, classes, RLS
const A = '11111111-1111-4111-8111-111111111111' // futur admin
const E1 = '22222222-2222-4222-8222-222222222222' // élève classe démo
const E2 = '33333333-3333-4333-8333-333333333333' // élève autre classe

export const signup = (db, id, pseudo, code) =>
  db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${pseudo}@test.fr`,
    { pseudo, invite_code: code },
  ])

export default async ({ db, as, ok, fails }) => {
  ok((await as(null, `select public.check_invite_code('demo42') as n`)).rows[0].n === 'Ma classe (démo)', 'code valide reconnu (insensible à la casse)')
  ok((await as(null, `select public.check_invite_code('XXXXXX') as n`)).rows[0].n === null, 'code inconnu refusé')

  await signup(db, A, 'Prof_Admin', 'DEMO42')
  await signup(db, E1, 'Lea', ' demo42 ')
  await signup(db, E2, 'Tom', 'TEST22')
  ok((await db.query(`select count(*)::int c from public.user_settings`)).rows[0].c === 3, 'profils + réglages créés')
  await fails(() => signup(db, crypto.randomUUID(), 'lea', 'DEMO42'), 'pseudo déjà pris (insensible à la casse)')
  await fails(() => signup(db, crypto.randomUUID(), 'Zoé', 'DEMO42'), 'pseudo avec caractères interdits')
  await fails(() => signup(db, crypto.randomUUID(), 'Max', 'NOPE00'), 'code invalide')
  ok((await as(null, `select public.is_pseudo_available('LEA') a`)).rows[0].a === false, 'is_pseudo_available')

  await db.query(`update public.profiles set role = 'admin' where id = $1`, [A])

  // Visibilité
  const seen = (await as(E1, `select pseudo from public.profiles order by pseudo`)).rows.map((r) => r.pseudo)
  ok(seen.join() === 'Lea,Prof_Admin', 'un élève ne voit que sa classe')
  ok((await as(E1, `select count(*)::int c from public.classes`)).rows[0].c === 1, 'un élève ne voit que sa classe (classes)')
  ok((await as(A, `select count(*)::int c from public.profiles`)).rows[0].c === 3, 'admin voit tout le monde')
  ok((await as(E1, `select count(*)::int c from public.user_settings`)).rows[0].c === 1, 'réglages privés')
  ok((await as(null, `select count(*)::int c from public.profiles`)).rows[0].c === 0, 'anonyme ne voit rien')

  // Modifications
  await as(E1, `update public.profiles set pseudo = 'Lea_B' where id = $1`, [E1])
  ok((await db.query(`select pseudo from public.profiles where id = $1`, [E1])).rows[0].pseudo === 'Lea_B', 'élève change son pseudo')
  await fails(() => as(E1, `update public.profiles set role = 'admin' where id = $1`, [E1]), 'élève ne peut pas devenir admin')
  await fails(() => as(E1, `update public.profiles set xp_total = 9999 where id = $1`, [E1]), 'élève ne peut pas modifier ses XP')
  await fails(() => as(E1, `update public.profiles set class_id = '00000000-0000-4000-8000-000000000002' where id = $1`, [E1]), 'élève ne peut pas changer de classe')
  const r = await as(E1, `update public.profiles set pseudo = 'Hack' where id = $1`, [E2])
  ok(r.affectedRows === 0, "élève ne peut pas modifier le profil d'un autre")
  await as(A, `update public.profiles set is_blocked = true where id = $1`, [E2])
  ok((await db.query(`select is_blocked from public.profiles where id = $1`, [E2])).rows[0].is_blocked, 'admin bloque un élève')
  await as(A, `update public.profiles set is_blocked = false where id = $1`, [E2])

  await fails(() => as(E1, `insert into public.classes (name) values ('Pirate')`), 'élève ne crée pas de classe')
  await as(A, `insert into public.classes (name) values ('Nouvelle classe')`)
  const code = (await db.query(`select invite_code from public.classes where name = 'Nouvelle classe'`)).rows[0].invite_code
  ok(/^[A-Z2-9]{6}$/.test(code), `code généré automatiquement (${code})`)
  await fails(() => as(E1, `select public.regenerate_invite_code('00000000-0000-4000-8000-000000000001')`), 'élève ne régénère pas un code')
  const nc = (await as(A, `select public.regenerate_invite_code('00000000-0000-4000-8000-000000000002') c`)).rows[0].c
  ok(nc !== 'TEST22', 'admin régénère un code')

  await as(E1, `update public.user_settings set reminder_time = '19:30' where user_id = $1`, [E1])
  ok((await db.query(`select reminder_time from public.user_settings where user_id = $1`, [E1])).rows[0].reminder_time === '19:30:00', 'élève modifie ses réglages')

  // Suppression de compte : cascade
  await db.query(`delete from auth.users where id = $1`, [E2])
  ok((await db.query(`select count(*)::int c from public.user_settings where user_id = $1`, [E2])).rows[0].c === 0, 'suppression de compte en cascade')
}
