import { factories } from '@strapi/strapi';
import { getMedicalCaseAccessFilter, getUserRole, isAdminUser, userCanAccessMedicalCase } from '../../../utils/medtour-access';
import { canRoleCreateCaseEvent, PATIENT_VISIBLE_CASE_EVENT_TYPES } from '../../../utils/case-event-policy';

const UID = 'api::case-event.case-event' as any;

function redactEventForPatient(event: any) {
  if (!event || typeof event !== 'object') return event;
  return {
    id: event.id,
    documentId: event.documentId,
    eventType: event.eventType,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    message: event.message,
    metadata: event.metadata,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    actor: event.actor ? {
      id: event.actor.id,
      documentId: event.actor.documentId,
      fullName: event.actor.fullName,
      userRole: event.actor.userRole,
    } : null,
  };
}

export default factories.createCoreController(UID, () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const caseFilter = await getMedicalCaseAccessFilter(strapi, user);
    if (caseFilter === null) return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
    const queryFilters = (ctx.query?.filters as any) || {};
    const role = getUserRole(user);
    // Keep the case requested by the client and apply the user's access scope as
    // an additional condition. Replacing `medical_case` here used to drop the
    // requested case id and return events from every case available to the user.
    const accessFilters = isAdminUser(user)
      ? queryFilters
      : {
        $and: [
          queryFilters,
          { medical_case: caseFilter },
          ...(role === 'patient'
            ? [{ eventType: { $in: PATIENT_VISIBLE_CASE_EVENT_TYPES } }]
            : []),
        ],
      };
    const data = await strapi.documents(UID).findMany({
      filters: accessFilters,
      sort: (ctx.query?.sort as any) || ['createdAt:asc'],
      populate: '*',
    });
    const safeData = role === 'patient' ? data.map(redactEventForPatient) : data;
    return { data: safeData, meta: { pagination: { page: 1, pageSize: safeData.length, pageCount: 1, total: safeData.length } } };
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const caseFilter = await getMedicalCaseAccessFilter(strapi, user);
    if (caseFilter === null) return ctx.notFound('Case event not found');
    const role = getUserRole(user);
    const events = await strapi.documents(UID).findMany({
      filters: {
        documentId: ctx.params.id,
        ...(isAdminUser(user) ? {} : { medical_case: caseFilter }),
        ...(role === 'patient' && { eventType: { $in: PATIENT_VISIBLE_CASE_EVENT_TYPES } }),
      },
      limit: 1,
      populate: '*',
    });
    if (!events[0]) return ctx.notFound('Case event not found');
    return { data: role === 'patient' ? redactEventForPatient(events[0]) : events[0] };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const role = getUserRole(user);
    if (!(await userCanAccessMedicalCase(strapi, user, body.medical_case))) return ctx.forbidden('Forbidden');
    if (!canRoleCreateCaseEvent(role, body.eventType)) {
      return ctx.forbidden('This role cannot create the requested case event');
    }
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
    const item = await strapi.documents(UID).create({
      data: {
        medical_case: body.medical_case,
        actor: user.documentId || user.id,
        eventType: body.eventType,
        fromStatus: typeof body.fromStatus === 'string' ? body.fromStatus.slice(0, 100) : null,
        toStatus: typeof body.toStatus === 'string' ? body.toStatus.slice(0, 100) : null,
        message,
        metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
          ? body.metadata
          : null,
      },
      populate: '*',
    });
    return { data: item };
  },
}));
