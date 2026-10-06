/**
 * Cron tasks:
 *  1. markNoShowAppointments   — every 5 min, marks missed appointments and
 *                                 completes consultations stuck "in progress"
 *  2. notifySlaOverdueCases    — every 30 min, in-app + email alerts for stalled cases
 *  3. notifyDueCaseReminders   — every 5 min, fires reminders created by staff
 *  4. remindAppointmentPreparation — every 15 min, reminds patients 24 h and
 *                                 2 h before a consultation (and asks for case
 *                                 documents when there are none yet)
 */
import { sendSlaOverdueEmail } from '../src/utils/case-email';
import { countPatientDocumentsByCase } from '../src/utils/appointment-preparation';

const CONSULTATION_JOIN_AFTER_BUFFER_MIN = 5;
const STALE_IN_PROGRESS_GRACE_MIN = 60;
const APPOINTMENT_CRON_LOOKBACK_DAYS = Number(process.env.APPOINTMENT_CRON_LOOKBACK_DAYS) > 0
  ? Number(process.env.APPOINTMENT_CRON_LOOKBACK_DAYS)
  : 7;
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

const PREPARATION_TEXT: Record<string, Record<'24h' | '2h' | 'today' | 'tomorrow' | 'title' | 'noDocuments', string>> = {
  ru: {
    title: 'Скоро консультация',
    '24h': 'Консультация с врачом {doctor} {day} в {time} (Астана).',
    today: 'сегодня',
    tomorrow: 'завтра',
    '2h': 'Консультация с врачом {doctor} скоро — в {time} (Астана). Проверьте камеру и микрофон.',
    noDocuments: 'В кейсе пока нет ваших медицинских документов — загрузите их заранее, чтобы врач успел ознакомиться.',
  },
  en: {
    title: 'Upcoming consultation',
    '24h': 'Your consultation with {doctor} is {day} at {time} (Astana time).',
    today: 'today',
    tomorrow: 'tomorrow',
    '2h': 'Your consultation with {doctor} starts soon, at {time} (Astana time). Please check your camera and microphone.',
    noDocuments: 'Your case has no medical documents yet — upload them in advance so the doctor can review them.',
  },
  kk: {
    title: 'Консультация жақында',
    '24h': '{doctor} дәрігерімен консультация {day} {time} (Астана уақыты).',
    today: 'бүгін',
    tomorrow: 'ертең',
    '2h': '{doctor} дәрігерімен консультация жақында — {time} (Астана уақыты). Камера мен микрофонды тексеріңіз.',
    noDocuments: 'Кейсте әзірге медициналық құжаттарыңыз жоқ — дәрігер танысып үлгеруі үшін оларды алдын ала жүктеңіз.',
  },
};

const astanaDateKey = (value: string | number) =>
  new Date(new Date(value).getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

const formatAstanaTime = (value: string) => new Date(value).toLocaleTimeString('ru-RU', {
  timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit',
});

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
      const appointments = strapi.documents('api::appointment.appointment');
      // Appointments use draft & publish and the API serves the published
      // version. Reading/updating without `status: 'published'` changed only the
      // draft, so users never saw the no_show and slots stayed "confirmed".
      const setStatus = (documentId: string, statuse: string, tag: string) =>
        appointments
          .update({ documentId, data: { statuse }, status: 'published' })
          .catch((err: any) => strapi.log.error(`[cron:${tag}] Failed ${documentId}: ${err.message}`));
      const windowEnd = (appt: any) =>
        new Date(appt.dateTime).getTime() +
        ((Number(appt.doctor?.consultationDuration) || 30) + CONSULTATION_JOIN_AFTER_BUFFER_MIN) * 60 * 1000;

      try {
        const now = Date.now();
        // Without a lower bound the first run after a deploy would rewrite the
        // whole history at once. Older records are closed by staff by hand.
        const lookbackFrom = new Date(now - APPOINTMENT_CRON_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

        // 1. Mark pending/confirmed appointments as no_show only after the same
        // server-side join window has closed. Otherwise cron can block users
        // while the video room still allows entry.
        const candidates = await appointments.findMany({
          status: 'published',
          filters: {
            statuse: { $in: ['pending', 'confirmed'] },
            dateTime: { $lt: new Date(now).toISOString(), $gte: lookbackFrom },
          },
          populate: { doctor: { fields: ['consultationDuration'] } },
          fields: ['documentId', 'dateTime'],
          limit: 500,
        });

        const overdue = candidates.filter((appt: any) => appt.dateTime && now > windowEnd(appt));
        if (overdue.length > 0) {
          strapi.log.info(`[cron:no_show] Marking ${overdue.length} appointment(s) as no_show`);
          await Promise.all(overdue.map((appt: any) => setStatus(appt.documentId, 'no_show', 'no_show')));
        }

        // 2. A consultation becomes in_progress when someone joins the room and
        // completed only when the doctor presses "Complete". If the doctor just
        // left the call it stayed "in progress" forever. The call did happen,
        // so close it as completed — an hour after the join window, because
        // participants already in the room may talk past the scheduled end.
        const inProgress = await appointments.findMany({
          status: 'published',
          filters: { statuse: 'in_progress', dateTime: { $gte: lookbackFrom } },
          populate: { doctor: { fields: ['consultationDuration'] } },
          fields: ['documentId', 'dateTime'],
          limit: 500,
        });

        const stale = inProgress.filter((appt: any) =>
          appt.dateTime && now > windowEnd(appt) + STALE_IN_PROGRESS_GRACE_MIN * 60 * 1000);
        if (stale.length > 0) {
          strapi.log.info(`[cron:stale_in_progress] Completing ${stale.length} appointment(s)`);
          await Promise.all(stale.map((appt: any) => setStatus(appt.documentId, 'completed', 'stale_in_progress')));
        }
      } catch (err: any) {
        strapi.log.error('[cron:no_show] Unexpected error:', err.message);
      }
    },
    options: {
      rule: '*/5 * * * *',
    },
  },
  remindAppointmentPreparation: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        const now = Date.now();
        const inTwoHours = now + 2 * 60 * 60 * 1000;
        const inTwentyFourHours = now + 24 * 60 * 60 * 1000;
        const appointments = await strapi.documents('api::appointment.appointment').findMany({
          status: 'published',
          filters: {
            statuse: { $in: ['pending', 'confirmed'] },
            dateTime: { $gte: new Date(now).toISOString(), $lte: new Date(inTwentyFourHours).toISOString() },
          },
          fields: ['documentId', 'dateTime', 'preparationReminder24hSentAt', 'preparationReminder2hSentAt'],
          populate: {
            patient: { fields: ['id', 'language'] },
            doctor: { fields: ['fullName'] },
            medical_case: { fields: ['documentId'] },
          },
          limit: 500,
        });
        if (appointments.length === 0) return;

        const documentCounts = await countPatientDocumentsByCase(
          strapi,
          appointments.map((appointment: any) => appointment.medical_case?.documentId),
        );

        for (const appointment of appointments as any[]) {
          const startsAt = new Date(appointment.dateTime).getTime();
          // One reminder per window; the 2 h one supersedes a missed 24 h one.
          const bucket: '24h' | '2h' | null = startsAt <= inTwoHours
            ? (appointment.preparationReminder2hSentAt ? null : '2h')
            : (appointment.preparationReminder24hSentAt ? null : '24h');
          if (!bucket || !appointment.patient?.id) continue;

          const caseId = appointment.medical_case?.documentId;
          const copy = PREPARATION_TEXT[appointment.patient.language] || PREPARATION_TEXT.ru;
          const missingDocuments = caseId && !documentCounts.get(caseId);
          const message = copy[bucket]
            .replace('{doctor}', appointment.doctor?.fullName || '')
            .replace('{day}', astanaDateKey(appointment.dateTime) === astanaDateKey(now) ? copy.today : copy.tomorrow)
            .replace('{time}', formatAstanaTime(appointment.dateTime))
            + (missingDocuments ? ` ${copy.noDocuments}` : '');

          await strapi.service('api::notification.notification').notifyUser(appointment.patient.id, {
            title: copy.title,
            message,
            type: 'reminder',
            link: caseId ? `/patient/cases/${caseId}` : '/patient/appointments',
            metadata: { appointmentId: appointment.documentId, reminder: bucket, missingDocuments: Boolean(missingDocuments) },
          });
          await strapi.documents('api::appointment.appointment').update({
            documentId: appointment.documentId,
            data: bucket === '2h'
              ? { preparationReminder2hSentAt: new Date(now).toISOString() }
              : { preparationReminder24hSentAt: new Date(now).toISOString() },
            status: 'published',
          });
        }
      } catch (err: any) {
        strapi.log.error('[cron:preparation_reminder] Unexpected error:', err.message);
      }
    },
    options: {
      rule: '*/15 * * * *',
    },
  },
  // Сырые события аналитики хранятся ограниченное время: старше
  // ANALYTICS_RETENTION_DAYS (по умолчанию 400 дней) удаляются раз в сутки.
  purgeOldAnalyticsEvents: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        const retentionDays = Number(process.env.ANALYTICS_RETENTION_DAYS) > 0
          ? Number(process.env.ANALYTICS_RETENTION_DAYS)
          : 400;
        const cutoff = new Date(Date.now() + 5 * 60 * 60 * 1000 - retentionDays * 86_400_000)
          .toISOString()
          .slice(0, 10);
        const removed = await strapi.db.connection('analytics_events').where('day', '<', cutoff).del();
        if (removed) strapi.log.info(`[cron:analytics_purge] removed ${removed} events older than ${cutoff}`);
      } catch (err: any) {
        strapi.log.error('[cron:analytics_purge] Unexpected error:', err.message);
      }
    },
    options: {
      rule: '40 3 * * *',
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

          // Also send email alerts to manager + coordinator
          const slaHours = CASE_SLA_HOURS[status] || 24;
          const emailTargets: any[] = [item.manager, item.coordinator, ...admins].filter(Boolean);
          const seen = new Set<string>();
          for (const person of emailTargets) {
            if (!person?.email || seen.has(person.email)) continue;
            seen.add(person.email);
            sendSlaOverdueEmail(strapi, person, item, status, slaHours).catch(() => {});
          }
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
