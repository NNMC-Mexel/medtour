'use strict';

/**
 * Verifies users-permissions roles include the case-first chat actions.
 *
 * Usage:
 *   node scripts/check-chat-permissions.js
 */

const REQUIRED = {
  patient: [
    'api::conversation.conversation.find',
    'api::conversation.conversation.findOne',
    'api::conversation.conversation.forCase',
    'api::conversation.conversation.messages',
    'api::conversation.conversation.markRead',
    'api::message.message.find',
    'api::message.message.findOne',
    'api::message.message.create',
    'plugin::upload.content-api.upload',
  ],
  doctor: [
    'api::conversation.conversation.find',
    'api::conversation.conversation.findOne',
    'api::conversation.conversation.forCase',
    'api::conversation.conversation.messages',
    'api::conversation.conversation.markRead',
    'api::message.message.find',
    'api::message.message.findOne',
    'api::message.message.create',
  ],
  manager: [
    'api::conversation.conversation.find',
    'api::conversation.conversation.findOne',
    'api::conversation.conversation.forCase',
    'api::conversation.conversation.messages',
    'api::conversation.conversation.markRead',
    'api::conversation.conversation.takeover',
    'api::message.message.find',
    'api::message.message.findOne',
    'api::message.message.create',
    'plugin::upload.content-api.upload',
  ],
  coordinator: [
    'api::conversation.conversation.find',
    'api::conversation.conversation.findOne',
    'api::conversation.conversation.forCase',
    'api::conversation.conversation.messages',
    'api::conversation.conversation.markRead',
    'api::conversation.conversation.takeover',
    'api::message.message.find',
    'api::message.message.findOne',
    'api::message.message.create',
  ],
  admin: [
    'api::conversation.conversation.find',
    'api::conversation.conversation.findOne',
    'api::conversation.conversation.forCase',
    'api::conversation.conversation.messages',
    'api::conversation.conversation.markRead',
    'api::conversation.conversation.takeover',
    'api::conversation.conversation.update',
    'api::message.message.find',
    'api::message.message.findOne',
    'api::message.message.create',
    'api::message.message.update',
  ],
};

async function checkChatPermissions() {
  console.log('=== Chat permission check ===\n');

  const roles = await strapi.query('plugin::users-permissions.role').findMany();
  let failed = false;

  for (const [roleType, requiredActions] of Object.entries(REQUIRED)) {
    const role = roles.find((item) => item.type === roleType);
    if (!role) {
      console.error(`  [FAIL] role missing: ${roleType}`);
      failed = true;
      continue;
    }

    const permissions = await strapi
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: role.id } });
    const actions = new Set(permissions.map((item) => item.action));
    const missing = requiredActions.filter((action) => !actions.has(action));

    if (missing.length === 0) {
      console.log(`  [OK] ${roleType}`);
    } else {
      failed = true;
      console.error(`  [FAIL] ${roleType}: missing ${missing.length}`);
      for (const action of missing) console.error(`    - ${action}`);
    }
  }

  if (failed) {
    console.error('\nChat permissions are incomplete. Start Strapi once to run bootstrap or update role permissions in Admin UI.');
    process.exitCode = 1;
  } else {
    console.log('\nChat permission check OK.');
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  await checkChatPermissions();
  await app.destroy();
  process.exit(process.exitCode || 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
