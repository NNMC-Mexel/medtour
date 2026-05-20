'use strict';

/**
 * Migrates legacy MedTour medical-case statuses to the target CRM lifecycle.
 *
 * Usage:
 *   node scripts/migrate-medical-case-statuses.js --dry-run
 *   node scripts/migrate-medical-case-statuses.js
 */

const isDryRun = process.argv.includes('--dry-run');

const STATUS_MAP = {
  NEW: 'NEW_LEAD',
  DOCS_PENDING: 'WAITING_FOR_DOCUMENTS',
  ASSIGNED: 'UNDER_REVIEW',
  IN_REVIEW: 'UNDER_REVIEW',
  MATCHING: 'DOCTOR_ASSIGNED',
  CONSULTATION_SCHEDULED: 'CONSULTATION_BOOKED',
  CONSULTATION_COMPLETED: 'CONSULTATION_COMPLETED',
  PLAN_FORMING: 'CONSULTATION_COMPLETED',
  PLAN_READY: 'WAITING_PATIENT_CONFIRMATION',
  PATIENT_DECISION: 'WAITING_PATIENT_CONFIRMATION',
  CONFIRMED: 'TREATMENT_IN_KAZAKHSTAN',
  VISA_PROCESS: 'TRAVEL_PREPARATION',
  TRAVEL_ARRANGED: 'TRAVEL_PREPARATION',
  ARRIVED: 'ARRIVED_TO_KAZAKHSTAN',
  IN_TREATMENT: 'IN_TREATMENT',
  DISCHARGED: 'RECOVERY',
  POST_CARE: 'RECOVERY',
  COMPLETED: 'COMPLETED',
  NO_TREATMENT_NEEDED: 'LOCAL_TREATMENT',
  CANCELLED: 'CANCELLED',
};

const TARGET_STATUSES = new Set([
  'NEW_LEAD',
  'REGISTERED',
  'WAITING_FOR_DOCUMENTS',
  'DOCUMENTS_UPLOADED',
  'UNDER_REVIEW',
  'DOCTOR_ASSIGNED',
  'WAITING_PATIENT_CONFIRMATION',
  'WAITING_PAYMENT',
  'CONSULTATION_BOOKED',
  'CONSULTATION_COMPLETED',
  'LOCAL_TREATMENT',
  'TREATMENT_IN_KAZAKHSTAN',
  'TRAVEL_PREPARATION',
  'ARRIVED_TO_KAZAKHSTAN',
  'IN_TREATMENT',
  'RECOVERY',
  'COMPLETED',
  'CANCELLED',
]);

async function migrateMedicalCaseStatuses() {
  console.log(`=== Medical case status migration ${isDryRun ? '(DRY RUN)' : ''} ===\n`);

  const cases = await strapi.documents('api::medical-case.medical-case').findMany({
    status: 'published',
    fields: ['id', 'documentId', 'caseNumber', 'status'],
  });

  const stats = { migrated: 0, skipped: 0, unknown: 0 };

  for (const item of cases) {
    const current = item.status;

    if (TARGET_STATUSES.has(current)) {
      console.log(`  [SKIP] ${item.caseNumber || item.documentId}: ${current}`);
      stats.skipped++;
      continue;
    }

    const next = STATUS_MAP[current];
    if (!next) {
      console.log(`  [UNKNOWN] ${item.caseNumber || item.documentId}: ${current}`);
      stats.unknown++;
      continue;
    }

    console.log(`  [${isDryRun ? 'PLAN' : 'MIGRATE'}] ${item.caseNumber || item.documentId}: ${current} -> ${next}`);
    stats.migrated++;

    if (!isDryRun) {
      await strapi.documents('api::medical-case.medical-case').update({
        documentId: item.documentId,
        data: { status: next },
        status: 'published',
      });

      await strapi.documents('api::case-event.case-event').create({
        data: {
          medical_case: item.documentId,
          eventType: 'STATUS_CHANGED',
          fromStatus: current,
          toStatus: next,
          message: 'Medical case status migrated to target CRM lifecycle',
          metadata: { migration: 'migrate-medical-case-statuses' },
        },
      });
    }
  }

  console.log('\n=== Result ===');
  console.log(`  Migrated: ${stats.migrated}`);
  console.log(`  Skipped:  ${stats.skipped}`);
  console.log(`  Unknown:  ${stats.unknown}`);
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await migrateMedicalCaseStatuses();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
