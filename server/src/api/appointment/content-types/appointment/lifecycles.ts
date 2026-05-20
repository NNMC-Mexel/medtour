/**
 * Appointment lifecycle hooks.
 * afterCreate: уведомляет доктора о новой записи.
 * afterUpdate:
 *   - если изменился статус → уведомляет противоположную сторону
 *   - если выставлен rating → создаёт/обновляет review и пересчитывает средний рейтинг врача
 */
import { normalizeCaseStatus } from '../../../../utils/medical-case-workflow';

function formatDateTime(dt: string | Date | undefined): string {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleString('ru-RU', {
      timeZone: 'Asia/Almaty',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

async function createFinanceLedgerEntry(appointment: any, entryType: string, notes: string, metadata: Record<string, any> = {}) {
  if (!appointment?.documentId || appointment?.price === undefined || appointment?.price === null) return;

  try {
    await strapi.documents('api::finance-ledger.finance-ledger' as any).create({
      data: {
        entryType,
        amount: Number(appointment.price),
        currency: 'KZT',
        providerPaymentId: appointment.paymentId || null,
        reconciliationStatus: 'PENDING',
        appointment: appointment.documentId,
        medical_case: appointment.medical_case?.documentId || appointment.medical_case?.id || null,
        patient: appointment.patient?.documentId || appointment.patient?.id || null,
        notes,
        metadata: {
          appointmentId: appointment.documentId,
          paymentStatus: appointment.paymentStatus,
          ...metadata,
        },
      },
    });
  } catch (error) {
    strapi.log.error('appointment finance ledger error:', error);
  }
}

function paymentStatusToLedgerEntry(paymentStatus: string | undefined) {
  if (paymentStatus === 'paid') return 'PAYMENT_CAPTURED';
  if (paymentStatus === 'pending') return 'PAYMENT_AUTHORIZED';
  if (paymentStatus === 'failed') return 'PAYMENT_FAILED';
  if (paymentStatus === 'refunded') return 'REFUND_SETTLED';
  return null;
}

export default {
  async afterCreate(event) {
    const { result } = event;
    const documentId = result?.documentId;
    if (!documentId) return;

    try {
      const appointment = await strapi.documents('api::appointment.appointment').findOne({
        documentId: String(documentId),
        populate: {
          doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
          patient: { fields: ['id', 'documentId', 'fullName'] },
          medical_case: true,
        },
      });

      const doctorUserId = (appointment as any)?.doctor?.users_permissions_user?.id;
      const patientName = (appointment as any)?.patient?.fullName || 'Пациент';
      const dateTime = (appointment as any)?.dateTime;
      const when = formatDateTime(dateTime);

      if (doctorUserId) {
        await strapi.service('api::notification.notification').notifyUser(doctorUserId, {
          title: 'Новая запись',
          message: `${patientName} записался(лась) на приём${when ? ' — ' + when : ''}`,
          type: 'appointment',
          link: `/doctor/appointments/${documentId}`,
          metadata: { appointmentId: documentId },
        });
      }

      const ledgerEntry = paymentStatusToLedgerEntry((appointment as any)?.paymentStatus);
      if (ledgerEntry) {
        await createFinanceLedgerEntry(appointment, ledgerEntry, 'Appointment created');
      }

      const caseDocId = (appointment as any)?.medical_case?.documentId;
      if (caseDocId) {
        const currentCaseStatus = normalizeCaseStatus((appointment as any)?.medical_case?.status);
        const nextCaseStatus = (appointment as any)?.paymentStatus === 'paid' || (appointment as any)?.statuse === 'confirmed'
          ? 'CONSULTATION_BOOKED'
          : 'WAITING_PAYMENT';

        if (
          currentCaseStatus &&
          !['CONSULTATION_BOOKED', 'CONSULTATION_COMPLETED', 'LOCAL_TREATMENT', 'TREATMENT_IN_KAZAKHSTAN', 'TRAVEL_PREPARATION', 'ARRIVED_TO_KAZAKHSTAN', 'IN_TREATMENT', 'RECOVERY', 'COMPLETED', 'CANCELLED'].includes(currentCaseStatus)
        ) {
          await strapi.documents('api::medical-case.medical-case' as any).update({
            documentId: caseDocId,
            data: { status: nextCaseStatus } as any,
            status: 'published',
          });
        }
      }
    } catch (error) {
      strapi.log.error('appointment afterCreate notification error:', error);
    }
  },

  async afterUpdate(event) {
    const { result, params } = event;
    const updatedData = params?.data || {};
    const documentId = result?.documentId;

    // 1. Уведомления о смене статуса
    const newStatus = updatedData?.statuse || updatedData?.status;
    if (newStatus && documentId) {
      try {
        const appointment = await strapi.documents('api::appointment.appointment').findOne({
          documentId: String(documentId),
          populate: {
            doctor: {
              fields: ['fullName'],
              populate: { users_permissions_user: { fields: ['id'] } },
            },
            patient: { fields: ['id', 'documentId', 'fullName'] },
            medical_case: true,
          },
        });

        const doctorUserId = (appointment as any)?.doctor?.users_permissions_user?.id;
        const doctorName = (appointment as any)?.doctor?.fullName || 'Врач';
        const patientId = (appointment as any)?.patient?.id;
        const patientName = (appointment as any)?.patient?.fullName || 'Пациент';
        const when = formatDateTime((appointment as any)?.dateTime);
        const svc = strapi.service('api::notification.notification');

        if (newStatus === 'confirmed' && patientId) {
          await svc.notifyUser(patientId, {
            title: 'Запись подтверждена',
            message: `${doctorName} подтвердил(а) вашу запись${when ? ' — ' + when : ''}`,
            type: 'appointment',
            link: `/patient/appointments/${documentId}`,
            metadata: { appointmentId: documentId, status: 'confirmed' },
          });
        } else if (newStatus === 'cancelled') {
          if (patientId) {
            await svc.notifyUser(patientId, {
              title: 'Запись отменена',
              message: `Запись с ${doctorName}${when ? ' (' + when + ')' : ''} отменена`,
              type: 'appointment',
              link: `/patient/appointments/${documentId}`,
              metadata: { appointmentId: documentId, status: 'cancelled' },
            });
          }
          if (doctorUserId) {
            await svc.notifyUser(doctorUserId, {
              title: 'Запись отменена',
              message: `Пациент ${patientName}${when ? ' (' + when + ')' : ''} отменил(а) запись`,
              type: 'appointment',
              link: `/doctor/appointments/${documentId}`,
              metadata: { appointmentId: documentId, status: 'cancelled' },
            });
          }
        } else if (newStatus === 'completed' && patientId) {
          await svc.notifyUser(patientId, {
            title: 'Консультация завершена',
            message: `Пожалуйста, оцените консультацию с ${doctorName}`,
            type: 'appointment',
            link: `/patient/appointments/${documentId}`,
            metadata: { appointmentId: documentId, status: 'completed' },
          });
        }

        const caseDocId = (appointment as any)?.medical_case?.documentId;
        if (caseDocId) {
          const currentCaseStatus = normalizeCaseStatus((appointment as any)?.medical_case?.status);
          let nextCaseStatus: string | null = null;

          if (newStatus === 'completed') nextCaseStatus = 'CONSULTATION_COMPLETED';
          if (newStatus === 'confirmed') nextCaseStatus = 'CONSULTATION_BOOKED';
          if (updatedData?.paymentStatus === 'paid') nextCaseStatus = 'CONSULTATION_BOOKED';

          if (
            nextCaseStatus &&
            currentCaseStatus &&
            !['LOCAL_TREATMENT', 'TREATMENT_IN_KAZAKHSTAN', 'TRAVEL_PREPARATION', 'ARRIVED_TO_KAZAKHSTAN', 'IN_TREATMENT', 'RECOVERY', 'COMPLETED', 'CANCELLED'].includes(currentCaseStatus)
          ) {
            await strapi.documents('api::medical-case.medical-case' as any).update({
              documentId: caseDocId,
              data: { status: nextCaseStatus } as any,
              status: 'published',
            });
          }
        }

        if (updatedData?.paymentStatus) {
          const ledgerEntry = paymentStatusToLedgerEntry(updatedData.paymentStatus);
          if (ledgerEntry) {
            await createFinanceLedgerEntry(appointment, ledgerEntry, `Payment status changed to ${updatedData.paymentStatus}`, {
              changedByLifecycle: true,
            });
          }
        }
      } catch (error) {
        strapi.log.error('appointment afterUpdate status-notification error:', error);
      }
    }

    // 2. Существующая логика: rating → review + пересчёт среднего у врача
    if (!updatedData?.rating || !documentId) return;

    try {
      const appointment = await strapi.documents('api::appointment.appointment').findOne({
        documentId: String(documentId),
        populate: {
          doctor: true,
          patient: true,
        },
      });

      if (!appointment?.doctor || !appointment?.patient) return;

      const doctorDocId = appointment.doctor.documentId || appointment.doctor.id;
      const patientDocId = appointment.patient.documentId || appointment.patient.id;

      const existingReviews = await strapi.documents('api::review.review').findMany({
        filters: {
          appointment: { documentId: String(documentId) },
        },
      });

      if (existingReviews.length === 0) {
        await strapi.documents('api::review.review').create({
          data: {
            rating: appointment.rating,
            text: appointment.review || '',
            doctor: doctorDocId,
            patient: patientDocId,
            appointment: documentId,
            isPublished: true,
          } as any,
          status: 'published',
        });
      } else {
        await strapi.documents('api::review.review').update({
          documentId: existingReviews[0].documentId,
          data: {
            rating: appointment.rating,
            text: appointment.review || '',
            isPublished: true,
          } as any,
          status: 'published',
        });
      }

      const doctorRecord = await strapi.documents('api::doctor.doctor').findOne({
        documentId: String(doctorDocId),
        populate: { reviews: true },
      });

      if (doctorRecord) {
        const allReviews = await strapi.documents('api::review.review').findMany({
          filters: {
            doctor: { documentId: String(doctorDocId) },
          },
          status: 'published',
        });

        const reviewsCount = allReviews.length;
        const avgRating =
          reviewsCount > 0
            ? Math.round((allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsCount) * 10) / 10
            : 0;

        strapi.log.info(
          `Updating doctor ${doctorDocId}: rating=${avgRating}, reviewsCount=${reviewsCount}`,
        );

        await strapi.documents('api::doctor.doctor').update({
          documentId: String(doctorDocId),
          data: {
            rating: avgRating,
            reviewsCount: reviewsCount,
          } as any,
          status: 'published',
        });
      }
    } catch (error) {
      strapi.log.error('Error in appointment afterUpdate lifecycle (rating):', error);
    }
  },
};
