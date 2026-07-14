'use strict';

/**
 * Audits duplicate active doctor slots and optionally repairs them.
 *
 * Safe default:
 *   npm run audit:appointment-slots
 *
 * Explicit repair (keeps the oldest booking, cancels later duplicates and
 * backfills persistent slot locks for future active appointments):
 *   npm run repair:appointment-slots
 */

const shouldFix = process.argv.includes('--fix');
const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'in_progress']);
const SLOT_UID = 'api::appointment-slot.appointment-slot';

function appointmentKey(appointment) {
  const doctorId = appointment.doctor?.documentId;
  const timestamp = new Date(appointment.dateTime).toISOString();
  return `${doctorId}:${timestamp}`;
}

function byCreationOrder(left, right) {
  const timeDifference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  return timeDifference || String(left.documentId).localeCompare(String(right.documentId));
}

async function ensureSlotLock(appointment) {
  const slotKey = appointmentKey(appointment);
  const existing = await strapi.documents(SLOT_UID).findMany({
    filters: { slotKey },
    limit: 1,
  });
  if (existing[0]) {
    if (existing[0].appointmentDocumentId !== appointment.documentId) {
      await strapi.documents(SLOT_UID).update({
        documentId: existing[0].documentId,
        data: { appointmentDocumentId: appointment.documentId },
      });
    }
    return false;
  }

  await strapi.documents(SLOT_UID).create({
    data: {
      slotKey,
      doctorDocumentId: appointment.doctor.documentId,
      dateTime: new Date(appointment.dateTime).toISOString(),
      appointmentDocumentId: appointment.documentId,
    },
  });
  return true;
}

async function auditDuplicateAppointments() {
  console.log(`=== Appointment slot audit ${shouldFix ? '(REPAIR)' : '(DRY RUN)'} ===\n`);

  const appointments = await strapi.documents('api::appointment.appointment').findMany({
    status: 'published',
    limit: 10000,
    fields: ['documentId', 'dateTime', 'statuse', 'createdAt'],
    populate: {
      doctor: { fields: ['documentId', 'fullName'] },
      medical_case: { fields: ['documentId', 'caseNumber'] },
    },
  });

  const groups = new Map();
  for (const appointment of appointments) {
    if (!ACTIVE_STATUSES.has(appointment.statuse) || !appointment.doctor?.documentId || !appointment.dateTime) continue;
    const key = appointmentKey(appointment);
    groups.set(key, [...(groups.get(key) || []), appointment]);
  }

  const duplicateGroups = [...groups.entries()].filter(([, items]) => items.length > 1);
  let cancelled = 0;
  for (const [key, items] of duplicateGroups) {
    const ordered = [...items].sort(byCreationOrder);
    const [winner, ...duplicates] = ordered;
    console.log(`[DUPLICATE] ${key}`);
    console.log(`  KEEP   ${winner.documentId} (${winner.medical_case?.caseNumber || 'no case'})`);
    for (const duplicate of duplicates) {
      console.log(`  ${shouldFix ? 'CANCEL' : 'WOULD CANCEL'} ${duplicate.documentId} (${duplicate.medical_case?.caseNumber || 'no case'})`);
      if (shouldFix) {
        await strapi.db.transaction(async () => {
          await strapi.documents('api::appointment.appointment').update({
            documentId: duplicate.documentId,
            data: { statuse: 'cancelled' },
            status: 'published',
          });
          if (duplicate.medical_case?.documentId) {
            await strapi.documents('api::case-event.case-event').create({
              data: {
                medical_case: duplicate.medical_case.documentId,
                eventType: 'NOTE',
                message: 'Duplicate consultation booking cancelled during slot repair.',
                metadata: {
                  migration: 'audit-duplicate-appointments',
                  appointmentId: duplicate.documentId,
                  retainedAppointmentId: winner.documentId,
                },
              },
            });
          }
        });
        cancelled += 1;
      }
    }
  }

  let locksCreated = 0;
  if (shouldFix) {
    const now = Date.now();
    const winners = [...groups.values()]
      .map((items) => [...items].sort(byCreationOrder)[0])
      .filter((appointment) => new Date(appointment.dateTime).getTime() > now);
    for (const appointment of winners) {
      if (await ensureSlotLock(appointment)) locksCreated += 1;
    }
  }

  console.log('\n=== Result ===');
  console.log(`  Active appointments: ${[...groups.values()].reduce((sum, items) => sum + items.length, 0)}`);
  console.log(`  Duplicate slots:     ${duplicateGroups.length}`);
  console.log(`  Cancelled:            ${cancelled}`);
  console.log(`  Locks created:        ${locksCreated}`);
  if (!shouldFix && duplicateGroups.length > 0) {
    console.log('\nNo data was changed. Run npm run repair:appointment-slots after reviewing this report.');
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  await auditDuplicateAppointments();
  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
