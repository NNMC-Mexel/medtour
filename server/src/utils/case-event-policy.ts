export const PATIENT_VISIBLE_CASE_EVENT_TYPES = [
  'CREATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_REQUESTED',
  'CONSULTATION_SCHEDULED',
  'CONSULTATION_COMPLETED',
  'DOCTOR_FEEDBACK_UPLOADED',
  'PLAN_SENT',
  'PLAN_ACCEPTED',
  'PLAN_DECLINED',
  'TRAVEL_UPDATED',
  'CHAT_MESSAGE_SENT',
  'CHAT_UPLOAD',
] as const;

const CLIENT_CREATABLE_EVENT_TYPES: Record<string, readonly string[]> = {
  manager: ['DOCUMENT_REQUESTED', 'NOTE', 'REMINDER_CREATED'],
  coordinator: ['DOCUMENT_REQUESTED', 'NOTE', 'REMINDER_CREATED'],
  admin: ['DOCUMENT_REQUESTED', 'NOTE', 'REMINDER_CREATED'],
};

export function canRoleCreateCaseEvent(role: string, eventType: unknown) {
  return typeof eventType === 'string'
    && (CLIENT_CREATABLE_EVENT_TYPES[role] || []).includes(eventType);
}
