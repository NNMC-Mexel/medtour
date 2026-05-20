/**
 * Cron: mark appointments as no_show if nobody joined within the grace period.
 *
 * Runs every 5 minutes. Targets appointments with statuse confirmed/pending
 * whose dateTime is more than NO_SHOW_GRACE_MIN minutes in the past.
 * The signaling server sets statuse=in_progress as soon as the first participant
 * joins the room, so in_progress / completed / cancelled are never touched.
 */

const NO_SHOW_GRACE_MIN = 15;
const CASE_SLA_HOURS: Record<string, number> = {
  NEW_LEAD: 2,
  REGISTERED: 4,
  WAITING_FOR_DOCUMENTS: 48,
  DOCUMENTS_UPLOADED: 4,
  UNDER_REVIEW: 24,
  DOCTOR_ASSIGNED: 24,
  WAITING_PATIENT_CONFIRMATION: 72,
  WAITING_PAYMENT: 1,
  CONSULTATION_BOOKED: 72,
  CONSULTATION_COMPLETED: 12,
  LOCAL_TREATMENT: 24,
  TREATMENT_IN_KAZAKHSTAN: 24,
  TRAVEL_PREPARATION: 72,
  ARRIVED_TO_KAZAKHSTAN: 8,
  IN_TREATMENT: 24,
  RECOVERY: 168,
};

const TERMINAL_CASE_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

function isCaseOverdue(item: any, now = Date.now()) {
  const status = item?.status || 'NEW_LEAD';
  const hours = CASE_SLA_HOURS[status];
  if (!hours || TERMINAL_CASE_STATUSES.has(status)) return false;
  const startMs = Date.parse(item.updatedAt || item.createdAt || new Date().toISOString());
  if (Number.isNaN(startMs)) return false;
  return now - startMs >= hours * 60 * 60 * 1000;
}

async function notifyUsers(strapi: any, users: any[], payload: any) {
  const svc = strapi.service('api::notification.notification');
  const seen = new Set();
  for (const user of users) {
    if (!user?.id || seen.has(user.id)) continue;
    seen.add(user.id);
    await svc.notifyUser(user.id, payload);
  }
}

export default {
  markNoShowAppointments: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        const cutoff = new Date(Date.now() - NO_SHOW_GRACE_MIN * 60 * 1000);

        const overdue = await strapi.documents('api::appointment.appointment').findMany({
          filters: {
            statuse: { $in: ['pending', 'confirmed'] },
            dateTime: { $lt: cutoff.toISOString() },
          },
          fields: ['documentId'],
        });

        if (overdue.length === 0) return;

        strapi.log.info(`[cron:no_show] Marking ${overdue.length} appointment(s) as no_show`);

        await Promise.all(
          overdue.map((appt: any) =>
            strapi
              .documents('api::appointment.appointment')
              .update({ documentId: appt.documentId, data: { statuse: 'no_show' } })
              .catch((err: any) =>
                strapi.log.error(`[cron:no_show] Failed ${appt.documentId}: ${err.message}`)
              )
          )
        );
      } catch (err: any) {
        strapi.log.error('[cron:no_show] Unexpected error:', err.message);
      }
    },
    options: {
      rule: '*/5 * * * *',
    },
  },
  notifySlaOverdueCases: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        const items = await strapi.documents('api::medical-case.medical-case').findMany({
          filters: { status: { $notIn: ['COMPLETED', 'CANCELLED'] } },
          limit: 1000,
          populate: {
            patient: { fields: ['id', 'fullName', 'email'] },
            manager: { fields: ['id', 'fullName', 'email'] },
            coordinator: { fields: ['id', 'fullName', 'email'] },
            case_events: true,
          },
        });

        const admins = await strapi.query('plugin::users-permissions.user').findMany({
          where: { userRole: 'admin' },
          select: ['id', 'fullName', 'email'],
        });

        for (const item of items as any[]) {
          if (!isCaseOverdue(item)) continue;
          const status = item.status || 'NEW_LEAD';
          const alreadyNotified = (item.case_events || []).some((event: any) =>
            event.eventType === 'SLA_OVERDUE' && event.metadata?.slaStatus === status
          );
          if (alreadyNotified) continue;

          const caseLabel = item.caseNumber || item.title || `Case ${item.id}`;
          await strapi.documents('api::case-event.case-event').create({
            data: {
              medical_case: item.documentId,
              eventType: 'SLA_OVERDUE',
              message: `SLA overdue for ${status}`,
              metadata: {
                slaStatus: status,
                caseNumber: item.caseNumber || null,
                source: 'cron:notifySlaOverdueCases',
              },
            },
          });

          await notifyUsers(strapi, [item.manager, item.coordinator, ...admins], {
            title: 'SLA overdue',
            message: `${caseLabel}: ${status}`,
            type: 'reminder',
            link: item.manager ? '/manager' : '/admin',
            metadata: { caseId: item.documentId, caseNumber: item.caseNumber, status },
          });
        }
      } catch (err: any) {
        strapi.log.error('[cron:sla_overdue] Unexpected error:', err.message);
      }
    },
    options: {
      rule: '*/30 * * * *',
    },
  },
  notifyDueCaseReminders: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        const now = new Date().toISOString();
        const reminders = await strapi.documents('api::case-event.case-event').findMany({
          filters: { eventType: 'REMINDER_CREATED' },
          limit: 1000,
          populate: {
            actor: { fields: ['id', 'fullName', 'email'] },
            medical_case: { fields: ['id', 'documentId', 'caseNumber', 'title'] },
          },
        });

        for (const reminder of reminders as any[]) {
          const dueAt = reminder.metadata?.dueAt;
          if (!dueAt || dueAt > now || reminder.metadata?.notifiedAt) continue;

          await notifyUsers(strapi, [reminder.actor], {
            title: 'Case reminder',
            message: reminder.message || 'Reminder is due',
            type: 'reminder',
            link: '/manager',
            metadata: {
              caseId: reminder.medical_case?.documentId,
              caseNumber: reminder.medical_case?.caseNumber,
              reminderId: reminder.documentId,
            },
          });

          await strapi.documents('api::case-event.case-event').update({
            documentId: reminder.documentId,
            data: {
              metadata: {
                ...(reminder.metadata || {}),
                notifiedAt: now,
              },
            },
          });
        }
      } catch (err: any) {
        strapi.log.error('[cron:case_reminders] Unexpected error:', err.message);
      }
    },
    options: {
      rule: '*/5 * * * *',
    },
  },
};
