// Synthetic users only. Run from server/ with DATABASE_FILENAME pointing at the QA db.
const { createStrapi } = require(require.resolve('@strapi/strapi', { paths: [process.cwd()] }));
const PASSWORD = 'QaMedtour1!x';
(async () => {
  const dir = process.cwd();
  const app = await createStrapi({ appDir: dir, distDir: `${dir}/dist` }).load();
  const conn = app.db.config.connection?.connection || {};
  const dbName = String(conn.filename || conn.database || '');
  if (!/qa-sec\.db$|^medtour_qa$/.test(dbName)) throw new Error(`Refusing to seed a non-QA database: ${dbName}`);
  const roles = await app.query('plugin::users-permissions.role').findMany();
  const roleId = (type) => roles.find((r) => r.type === type)?.id;
  const users = app.plugin('users-permissions').service('user');
  const out = {};
  const people = [
    ['qa-admin', 'admin', 'QA Admin', 'ru'],
    ['qa-admin2', 'admin', 'QA Admin Two', 'ru'],
    ['qa-manager', 'manager', 'QA Manager', 'ru'],
    ['qa-pat-en', 'patient', 'QA <b>Patient</b> <img src=x onerror=alert(1)>', 'en'],
    ['qa-pat-ru', 'patient', 'QA Пациент', 'ru'],
    ['qa-pat-lock', 'patient', 'QA Locked', 'kk'],
    ['qa-pat-reset', 'patient', 'QA Reset', 'ru'],
    ['qa-pat-blocked', 'patient', 'QA Blocked', 'ru', { blocked: true }],
    ['qa-pat-burst', 'patient', 'QA Burst', 'ru'],
    ['qa-pat-phone', 'patient', 'QA Phone', 'ru', { phone: '+7 701 555 0101', phoneNormalized: '77015550101' }],
    ['qa-pat-unconf', 'patient', 'QA Unconfirmed', 'ru', { confirmed: false }],
    ['qa-pat-window', 'patient', 'QA Window', 'ru'],
    ['qa-pat-race', 'patient', 'QA Race', 'ru'],
    ['qa-pat-mailfail', 'patient', 'QA Mail Fail', 'ru'],
    ['qa-pat-blocked2', 'patient', 'QA Blocked Two', 'ru'],
    ['qa-doc', 'doctor', 'QA Doctor', 'ru'],
  ];
  for (const [username, role, fullName, language, extra = {}] of people) {
    const user = await users.add({
      username, email: `${username}@qa.invalid`, password: PASSWORD, provider: 'local',
      confirmed: true, blocked: false, role: roleId(role), userRole: role, fullName, language, ...extra,
    });
    out[username] = { id: user.id, email: user.email };
  }
  console.log('SEED ' + JSON.stringify({ password: PASSWORD, users: out }));
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
