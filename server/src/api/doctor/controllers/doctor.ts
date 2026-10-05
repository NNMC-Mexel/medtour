/**
 * Doctor controller.
 * find/findOne — публичные (управляется permissions роли).
 * update — только свой профиль (policy на route).
 *   Non-admin doctors cannot modify protected fields:
 *   price, rating, reviewsCount, isActive, userId, users_permissions_user,
 *   licenseNumber, position, workplace, clinic
 */
import { factories } from '@strapi/strapi';
import { areFilesAttachable, getRowIdsForDocument } from '../../../utils/file-attach';
import {
  SCHEDULE_FIELDS,
  findScheduleConflicts,
  scheduleActuallyChanges,
  validateScheduleConfigInput,
} from '../../../utils/doctor-schedule';

// Fields only admin may change
const ADMIN_ONLY_FIELDS = [
  'price',
  'rating',
  'reviewsCount',
  'isActive',
  'userId',
  'users_permissions_user',
  'licenseNumber',
  'position',
  'workplace',
  'clinic',
  'treatmentDepartments',
];

const TREATMENT_DEPARTMENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function hasValidTreatmentDepartments(value: unknown) {
  return Array.isArray(value)
    && new Set(value).size === value.length
    && value.every((slug) => (
      typeof slug === 'string'
      && slug.length <= 80
      && TREATMENT_DEPARTMENT_SLUG_PATTERN.test(slug)
    ));
}

// Fields a schedule editor (doctor, manager, coordinator, admin) may send to
// PUT /doctors/:id/schedule. The consultation window follows the slot length:
// the schedule owns the consultation duration.
const SCHEDULE_WRITABLE_FIELDS = [...SCHEDULE_FIELDS, 'consultationDuration'];
const SCHEDULE_EDITOR_ROLES = ['admin', 'manager', 'coordinator'];

const getRequestData = (ctx: any) => {
  const rawBody = ctx.request.body as any;
  return rawBody?.data && typeof rawBody.data === 'object' ? rawBody.data : rawBody || {};
};

/**
 * Validates a schedule change and refuses it with 409 when future active
 * appointments would fall outside the new schedule (or into a vacation). The
 * client shows them and repeats the request with acknowledgeScheduleConflicts.
 * Returns true when the request has already been answered.
 */
async function rejectScheduleChange(strapi: any, ctx: any, body: any): Promise<boolean> {
  const acknowledged = body.acknowledgeScheduleConflicts === true
    || String(ctx.query?.acknowledgeScheduleConflicts || '') === 'true';
  delete body.acknowledgeScheduleConflicts;

  if (!SCHEDULE_FIELDS.some((field) => field in body)) return false;

  const configError = validateScheduleConfigInput(body.scheduleConfig);
  if (configError) {
    ctx.badRequest('Invalid schedule', { code: `schedule_${configError}` });
    return true;
  }
  if ('slotDuration' in body) {
    const slot = Number(body.slotDuration);
    if (!Number.isInteger(slot) || slot < 5 || slot > 240) {
      ctx.badRequest('Invalid slot duration', { code: 'schedule_invalid_slot' });
      return true;
    }
  }
  if (acknowledged) return false;

  const current = await strapi.documents('api::doctor.doctor').findOne({
    documentId: ctx.params.id,
    status: 'published',
  });
  // Forms send schedule fields on every save (price, bio…); check only real changes.
  if (!current || !scheduleActuallyChanges(current, body)) return false;

  const conflicts = await findScheduleConflicts(strapi, ctx.params.id, { ...current, ...body });
  if (conflicts.length === 0) return false;
  ctx.conflict('Schedule change conflicts with existing appointments', {
    code: 'schedule_conflicts',
    conflicts,
  });
  return true;
}

export default factories.createCoreController('api::doctor.doctor', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    const isAdmin = user?.role?.type === 'admin' || user?.userRole === 'admin';
    const isDoctor = user?.role?.type === 'doctor' || user?.userRole === 'doctor';
    const isStaff = ['manager', 'coordinator'].includes(user?.userRole);

    // Public/patient-facing catalog must only expose active doctors.
    // Admins, doctors, and internal staff (manager/coordinator) need the full list.
    if (!isAdmin && !isDoctor && !isStaff) {
      ctx.query = {
        ...ctx.query,
        filters: {
          ...((ctx.query?.filters as any) || {}),
          isActive: { $eq: true },
        },
      };
    }

    return await super.find(ctx);
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    const user = ctx.state.user;
    const isAdmin = user?.role?.type === 'admin' || user?.userRole === 'admin';
    const isDoctor = user?.role?.type === 'doctor' || user?.userRole === 'doctor';
    const isStaff = ['manager', 'coordinator'].includes(user?.userRole);
    const doctor = (response as any)?.data;

    if (!isAdmin && !isDoctor && !isStaff && doctor?.isActive === false) {
      return ctx.notFound('Doctor not found');
    }

    return response;
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    if (!isAdmin) return ctx.forbidden('Only admins can create doctors');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    if ('treatmentDepartments' in body && !hasValidTreatmentDepartments(body.treatmentDepartments)) {
      return ctx.badRequest('Treatment department assignments are invalid');
    }

    return await super.create(ctx);
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    if (!isAdmin) {
      const rawBody = ctx.request.body as any;
      const body = rawBody?.data && typeof rawBody.data === 'object' ? rawBody.data : rawBody || {};
      const filtered = { ...body };
      ADMIN_ONLY_FIELDS.forEach((f) => delete filtered[f]);
      // A doctor photo is public, so attaching someone else's upload here
      // would publish it. Only the doctor's own fresh upload may be used.
      if (filtered.photo) {
        const attachable = await areFilesAttachable(filtered.photo, {
          userId: user.id,
          ownRelatedType: 'api::doctor.doctor',
          ownRelatedIds: await getRowIdsForDocument('api::doctor.doctor', ctx.params.id),
        });
        if (!attachable) return ctx.forbidden('This file is not available');
      }
      if (rawBody?.data && typeof rawBody.data === 'object') {
        (ctx.request.body as any) = { ...rawBody, data: filtered };
      } else {
        ctx.request.body = filtered;
      }
    }

    // Audit log for price changes (admin only path)
    if (isAdmin) {
      const body = (ctx.request.body as any)?.data || ctx.request.body || {};
      if ('treatmentDepartments' in body && !hasValidTreatmentDepartments(body.treatmentDepartments)) {
        return ctx.badRequest('Treatment department assignments are invalid');
      }
      if ('price' in body) {
        strapi.log.info(JSON.stringify({
          audit: 'DOCTOR_PRICE_CHANGED',
          doctorId: ctx.params.id,
          newPrice: body.price,
          changedBy: user.id,
          ip: ctx.request.ip,
          ts: new Date().toISOString(),
        }));
      }
    }

    if (await rejectScheduleChange(strapi, ctx, getRequestData(ctx))) return;

    return await super.update(ctx);
  },

  /**
   * PUT /doctors/:id/schedule — only the schedule, nothing else on the card.
   * Managers and coordinators fine-tune doctors' schedules without getting
   * write access to price, licence or the rest of the profile.
   */
  async updateSchedule(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Not authenticated');

    const role = user.role?.type || user.userRole;
    const doctor: any = await strapi.documents('api::doctor.doctor').findOne({
      documentId: ctx.params.id,
      status: 'published',
      populate: { users_permissions_user: { fields: ['id'] } },
    });
    if (!doctor) return ctx.notFound('Doctor not found');

    const isOwner = role === 'doctor' && doctor.users_permissions_user?.id === user.id;
    if (!SCHEDULE_EDITOR_ROLES.includes(role) && !isOwner) {
      return ctx.forbidden('You cannot change this schedule');
    }

    const body = getRequestData(ctx);
    const data: Record<string, any> = Object.fromEntries(
      Object.entries(body).filter(([key]) => SCHEDULE_WRITABLE_FIELDS.includes(key)),
    );
    if (Object.keys(data).length === 0) return ctx.badRequest('No schedule fields to update');
    if ('slotDuration' in data && !('consultationDuration' in data)) {
      data.consultationDuration = Number(data.slotDuration);
    }
    if (body.acknowledgeScheduleConflicts === true) data.acknowledgeScheduleConflicts = true;

    if (await rejectScheduleChange(strapi, ctx, data)) return;

    const updated = await strapi.documents('api::doctor.doctor').update({
      documentId: ctx.params.id,
      data,
      status: 'published',
    });

    strapi.log.info(JSON.stringify({
      audit: 'DOCTOR_SCHEDULE_CHANGED',
      doctorId: ctx.params.id,
      changedBy: user.id,
      role,
      ts: new Date().toISOString(),
    }));

    const sanitized = await this.sanitizeOutput(updated, ctx);
    return this.transformResponse(sanitized);
  },
}));
