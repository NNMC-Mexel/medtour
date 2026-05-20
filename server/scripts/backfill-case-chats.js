'use strict';

/**
 * Ensures every MedicalCase has a case-first Conversation.
 *
 * Usage:
 *   node scripts/backfill-case-chats.js --dry-run
 *   node scripts/backfill-case-chats.js
 */

const isDryRun = process.argv.includes('--dry-run');

function participantsForCase(item) {
  return [
    item.patient,
    item.manager,
    item.coordinator,
    item.conversation?.doctorChatEnabled ? item.doctor?.users_permissions_user : null,
  ].filter(Boolean);
}

async function connectConversationMembers(conversationId, participants) {
  const seen = new Set();
  for (const participant of participants) {
    if (!participant?.id || seen.has(participant.id)) continue;
    seen.add(participant.id);
    await strapi.query('plugin::users-permissions.user').update({
      where: { id: participant.id },
      data: { conversations: { connect: [conversationId] } },
    });
  }
}

async function backfillCaseChats() {
  console.log(`=== MedicalCase chat backfill ${isDryRun ? '(DRY RUN)' : ''} ===\n`);

  const cases = await strapi.documents('api::medical-case.medical-case').findMany({
    status: 'published',
    limit: 10000,
    populate: {
      patient: true,
      manager: true,
      coordinator: true,
      doctor: { populate: { users_permissions_user: true } },
      conversation: true,
    },
  });

  const stats = { created: 0, linked: 0, skipped: 0 };

  for (const item of cases) {
    const label = item.caseNumber || item.documentId || item.id;

    const existing = item.conversation || (await strapi.documents('api::conversation.conversation').findMany({
      filters: { medical_case: { documentId: item.documentId } },
      limit: 1,
      populate: { users_permissions_users: true },
    }))[0];

    if (existing) {
      console.log(`  [LINK] ${label}: conversation ${existing.documentId || existing.id}`);
      stats.linked++;
      if (!isDryRun) {
        await strapi.documents('api::conversation.conversation').update({
          documentId: existing.documentId,
          data: {
            channel: existing.channel || 'case',
            lifecycleStatus: existing.lifecycleStatus || 'open',
            sharedQueue: existing.sharedQueue !== false,
            medical_case: item.documentId,
          },
          status: 'published',
        });
        await connectConversationMembers(existing.id, participantsForCase({ ...item, conversation: existing }));
      }
      continue;
    }

    console.log(`  [CREATE] ${label}`);
    stats.created++;
    if (!isDryRun) {
      const created = await strapi.documents('api::conversation.conversation').create({
        data: {
          channel: 'case',
          lifecycleStatus: 'open',
          sharedQueue: true,
          doctorChatEnabled: false,
          medical_case: item.documentId,
          lastMessageAt: new Date().toISOString(),
        },
        status: 'published',
      });
      await connectConversationMembers(created.id, participantsForCase(item));
      await strapi.documents('api::case-event.case-event').create({
        data: {
          medical_case: item.documentId,
          eventType: 'NOTE',
          message: 'Case chat backfilled',
          metadata: { migration: 'backfill-case-chats', conversationId: created.documentId },
        },
      });
    }
  }

  console.log('\n=== Result ===');
  console.log(`  Created: ${stats.created}`);
  console.log(`  Linked:  ${stats.linked}`);
  console.log(`  Skipped: ${stats.skipped}`);
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  await backfillCaseChats();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
