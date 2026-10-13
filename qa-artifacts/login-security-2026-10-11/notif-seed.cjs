// Adds unread notifications for qa-admin (2) and qa-pat-ru (3). Synthetic data, QA db only.
const { createStrapi } = require(require.resolve('@strapi/strapi', { paths: [process.cwd()] }));
(async () => {
  const dir = process.cwd();
  const app = await createStrapi({ appDir: dir, distDir: `${dir}/dist` }).load();
  const name = String(app.db.config.connection?.connection?.filename || '');
  if (!/qa-sec\.db$/.test(name)) throw new Error('not the QA db');
  const uid = async (u) => (await app.query('plugin::users-permissions.user').findOne({ where: { username: u } })).id;
  const add = async (u, title) => app.documents('api::notification.notification').create({ data: { title, message: 'qa', type: 'message', isRead: false, user: await uid(u) } });
  for (const t of ['admin-1', 'admin-2']) await add('qa-admin', t);
  for (const t of ['patient-1', 'patient-2', 'patient-3']) await add('qa-pat-ru', t);
  console.log('NOTIF OK');
  await app.destroy(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
