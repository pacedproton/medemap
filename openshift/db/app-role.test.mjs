// Privilege test for app-role.sql on in-memory Postgres (PGlite). Run: see oracle SEC-003 in specs/state.json

import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const sql = fs.readFileSync(process.argv[2], 'utf8').replace(/DATABASE medemap/g, 'DATABASE postgres');
const db = new PGlite();
let failed = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failed++; };
const tryq = async (q) => { try { await db.exec(q); return true; } catch { return false; } };

// owner + app roles, objects owned by medemap, as after the restore
await db.exec(`
  CREATE ROLE medemap LOGIN; CREATE ROLE medemap_app LOGIN; CREATE ROLE intruder LOGIN;
  CREATE SCHEMA medemap_aug AUTHORIZATION medemap; CREATE SCHEMA medemap_aug_v2 AUTHORIZATION medemap; CREATE SCHEMA graphv2 AUTHORIZATION medemap;
  GRANT CREATE ON SCHEMA public TO medemap;  -- in the real database medemap owns it
  SET ROLE medemap;
  CREATE TABLE medemap_aug_v2.supply_side (country text, x int); INSERT INTO medemap_aug_v2.supply_side VALUES ('Austria', 1);
  CREATE TABLE medemap_aug.application_logs (id serial primary key, message text);
  CREATE TABLE graphv2.sectors (id int, name text);
  CREATE TABLE public.user_profiles (email text, password_hash text);
  CREATE TABLE public.globe_data (id int);
  CREATE TABLE public.zuge_mas (id int);
  RESET ROLE;
`);
await db.exec(sql);
await db.exec('SET ROLE medemap_app');
ok('app can read the data schema', await tryq('SELECT * FROM medemap_aug_v2.supply_side'));
ok('app can read graphv2', await tryq('SELECT * FROM graphv2.sectors'));
ok('app can read user_profiles and globe_data', await tryq('SELECT * FROM public.user_profiles; SELECT * FROM public.globe_data'));
const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='medemap_aug_v2' AND table_name='supply_side'`);
ok('app can still discover columns via information_schema', cols.rows.length === 2);
ok('app can append to application_logs and read back the new id', await tryq(`INSERT INTO medemap_aug.application_logs (message) VALUES ('x') RETURNING id`));
ok('app cannot read unrelated public tables', !(await tryq('SELECT * FROM public.zuge_mas')));
ok('app cannot INSERT into data tables', !(await tryq(`INSERT INTO medemap_aug_v2.supply_side VALUES ('X', 1)`)));
ok('app cannot UPDATE data', !(await tryq(`UPDATE medemap_aug_v2.supply_side SET x = 9`)));
ok('app cannot DELETE data', !(await tryq(`DELETE FROM medemap_aug_v2.supply_side`)));
ok('app cannot UPDATE user_profiles (no privilege escalation)', !(await tryq(`UPDATE public.user_profiles SET email = 'a'`)));
ok('app cannot TRUNCATE', !(await tryq('TRUNCATE medemap_aug_v2.supply_side')));
ok('app cannot DROP a table', !(await tryq('DROP TABLE medemap_aug_v2.supply_side')));
ok('app cannot create tables in public', !(await tryq('CREATE TABLE public.evil (a int)')));
ok('app cannot create a schema', !(await tryq('CREATE SCHEMA evil')));
ok('app cannot read the log table', !(await tryq('SELECT * FROM medemap_aug.application_logs')));
await db.exec('RESET ROLE');
await db.exec('SET ROLE medemap');
await db.exec('CREATE TABLE medemap_aug_v2.later_table (a int)');
await db.exec('RESET ROLE; SET ROLE medemap_app');
ok('tables the owner creates later are readable by the app', await tryq('SELECT * FROM medemap_aug_v2.later_table'));
await db.exec('RESET ROLE');
const r = await db.query(`SELECT rolcanlogin FROM pg_roles WHERE rolname='medemap'`);
ok('owner role cannot log in', r.rows[0].rolcanlogin === false);
const c = await db.query(`SELECT has_database_privilege('intruder','postgres','CONNECT') c, has_database_privilege('medemap_app','postgres','CONNECT') a`);
ok('other roles cannot connect to the database, the app can', c.rows[0].c === false && c.rows[0].a === true);
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
