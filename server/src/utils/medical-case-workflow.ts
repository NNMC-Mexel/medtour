export const MEDICAL_CASE_STATUSES = [
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
  'COMMISSION_REVIEW',
  'LOCAL_TREATMENT',
  'TREATMENT_IN_KAZAKHSTAN',
  'TRAVEL_PREPARATION',
  'ARRIVED_TO_KAZAKHSTAN',
  'IN_TREATMENT',
  'RECOVERY',
  'COMPLETED',
  'CANCELLED',
] as const;

export const LEGACY_MEDICAL_CASE_STATUS_MAP: Record<string, MedicalCaseStatus> = {
  NEW: 'NEW_LEAD',
  DOCS_PENDING: 'WAITING_FOR_DOCUMENTS',
  ASSIGNED: 'UNDER_REVIEW',
  IN_REVIEW: 'UNDER_REVIEW',
  MATCHING: 'DOCTOR_ASSIGNED',
  CONSULTATION_SCHEDULED: 'CONSULTATION_BOOKED',
  PLAN_FORMING: 'CONSULTATION_COMPLETED',
  PLAN_READY: 'WAITING_PATIENT_CONFIRMATION',
  PATIENT_DECISION: 'WAITING_PATIENT_CONFIRMATION',
  CONFIRMED: 'TREATMENT_IN_KAZAKHSTAN',
  VISA_PROCESS: 'TRAVEL_PREPARATION',
  TRAVEL_ARRANGED: 'TRAVEL_PREPARATION',
  ARRIVED: 'ARRIVED_TO_KAZAKHSTAN',
  DISCHARGED: 'RECOVERY',
  POST_CARE: 'RECOVERY',
  NO_TREATMENT_NEEDED: 'LOCAL_TREATMENT',
};

export type MedicalCaseStatus = typeof MEDICAL_CASE_STATUSES[number];
export type MedTourRole = 'patient' | 'doctor' | 'manager' | 'coordinator' | 'admin';

const TERMINAL_STATUSES: MedicalCaseStatus[] = ['COMPLETED', 'CANCELLED'];

export const MEDICAL_CASE_TRANSITIONS: Record<MedicalCaseStatus, MedicalCaseStatus[]> = {
  NEW_LEAD: ['REGISTERED', 'WAITING_FOR_DOCUMENTS', 'CANCELLED'],
  REGISTERED: ['WAITING_FOR_DOCUMENTS', 'CANCELLED'],
  WAITING_FOR_DOCUMENTS: ['DOCUMENTS_UPLOADED', 'UNDER_REVIEW', 'DOCTOR_ASSIGNED', 'CANCELLED'],
  DOCUMENTS_UPLOADED: ['UNDER_REVIEW', 'WAITING_FOR_DOCUMENTS', 'DOCTOR_ASSIGNED', 'CANCELLED'],
  UNDER_REVIEW: ['WAITING_FOR_DOCUMENTS', 'DOCTOR_ASSIGNED', 'LOCAL_TREATMENT', 'CANCELLED'],
  DOCTOR_ASSIGNED: ['WAITING_PATIENT_CONFIRMATION', 'WAITING_FOR_DOCUMENTS', 'CANCELLED'],
  WAITING_PATIENT_CONFIRMATION: ['WAITING_PAYMENT', 'DOCTOR_ASSIGNED', 'CANCELLED'],
  WAITING_PAYMENT: ['CONSULTATION_BOOKED', 'WAITING_PATIENT_CONFIRMATION', 'CANCELLED'],
  CONSULTATION_BOOKED: ['CONSULTATION_COMPLETED', 'WAITING_PATIENT_CONFIRMATION', 'CANCELLED'],
  CONSULTATION_COMPLETED: [
    'COMMISSION_REVIEW',
    'CANCELLED',
  ],
  COMMISSION_REVIEW: [
    'LOCAL_TREATMENT',
    'TREATMENT_IN_KAZAKHSTAN',
    'WAITING_FOR_DOCUMENTS',
    'DOCTOR_ASSIGNED',
    'CANCELLED',
  ],
  LOCAL_TREATMENT: ['COMPLETED', 'CANCELLED'],
  TREATMENT_IN_KAZAKHSTAN: ['TRAVEL_PREPARATION', 'CANCELLED'],
  TRAVEL_PREPARATION: ['ARRIVED_TO_KAZAKHSTAN', 'CANCELLED'],
  ARRIVED_TO_KAZAKHSTAN: ['IN_TREATMENT', 'CANCELLED'],
  IN_TREATMENT: ['RECOVERY', 'CANCELLED'],
  RECOVERY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const ROLE_STATUS_TRANSITIONS: Record<MedTourRole, MedicalCaseStatus[]> = {
  patient: [
    'REGISTERED',
    'WAITING_FOR_DOCUMENTS',
    'DOCUMENTS_UPLOADED',
    'WAITING_PAYMENT',
    'CANCELLED',
  ],
  doctor: [
    'COMMISSION_REVIEW',
  ],
  manager: [
    'REGISTERED',
    'WAITING_FOR_DOCUMENTS',
    'DOCUMENTS_UPLOADED',
    'UNDER_REVIEW',
    'DOCTOR_ASSIGNED',
    'WAITING_PATIENT_CONFIRMATION',
    'WAITING_PAYMENT',
    'CONSULTATION_BOOKED',
    'CONSULTATION_COMPLETED',
    'COMMISSION_REVIEW',
    'LOCAL_TREATMENT',
    'TREATMENT_IN_KAZAKHSTAN',
    'TRAVEL_PREPARATION',
    'ARRIVED_TO_KAZAKHSTAN',
    'IN_TREATMENT',
    'RECOVERY',
    'COMPLETED',
    'CANCELLED',
  ],
  coordinator: [
    'WAITING_FOR_DOCUMENTS',
    'DOCUMENTS_UPLOADED',
    'UNDER_REVIEW',
    'DOCTOR_ASSIGNED',
    'WAITING_PATIENT_CONFIRMATION',
    'CONSULTATION_BOOKED',
    'CONSULTATION_COMPLETED',
    'COMMISSION_REVIEW',
    'LOCAL_TREATMENT',
    'TREATMENT_IN_KAZAKHSTAN',
    'CANCELLED',
  ],
  admin: [...MEDICAL_CASE_STATUSES],
};

export const CASE_SLA_HOURS: Partial<Record<MedicalCaseStatus, number>> = {
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
  COMMISSION_REVIEW: 24,
  LOCAL_TREATMENT: 24,
  TREATMENT_IN_KAZAKHSTAN: 24,
  TRAVEL_PREPARATION: 72,
  ARRIVED_TO_KAZAKHSTAN: 8,
  IN_TREATMENT: 24,
  RECOVERY: 168,
};

export const ROLE_PERMISSION_MATRIX = {
  patient: {
    case: ['create_own', 'read_own', 'update_patient_fields', 'cancel_own'],
    document: ['upload_own', 'read_own', 'share_own'],
    treatmentPlan: ['read_own', 'accept_or_decline'],
    appointment: ['book_own', 'read_own', 'cancel_own', 'review_completed'],
    chat: ['read_own', 'send_own'],
    payment: ['pay_own', 'read_own_ledger'],
    notification: ['read_own', 'mark_read_own'],
  },
  doctor: {
    case: ['read_assigned', 'doctor_decision'],
    document: ['read_assigned', 'upload_decision_files'],
    treatmentPlan: ['create_assigned', 'update_assigned'],
    appointment: ['read_assigned', 'confirm_assigned', 'complete_assigned'],
    chat: ['read_assigned', 'send_assigned'],
    payment: ['no_write'],
    notification: ['read_own', 'mark_read_own'],
  },
  manager: {
    case: ['create_for_patient', 'read_assigned', 'assign_logistics', 'advance_logistics'],
    document: ['read_assigned', 'upload_assigned'],
    treatmentPlan: ['read_assigned'],
    appointment: ['create_assigned', 'update_assigned'],
    chat: ['read_assigned', 'send_assigned', 'takeover_assigned'],
    payment: ['read_assigned_ledger', 'request_refund'],
    notification: ['create_assigned', 'read_own', 'mark_read_own'],
  },
  coordinator: {
    case: ['read_assigned', 'assign_clinic_doctor', 'advance_medical_review'],
    document: ['read_assigned', 'upload_assigned'],
    treatmentPlan: ['create_assigned', 'update_assigned'],
    appointment: ['create_assigned', 'update_assigned'],
    chat: ['read_assigned', 'send_assigned'],
    payment: ['read_assigned_ledger'],
    notification: ['create_assigned', 'read_own', 'mark_read_own'],
  },
  admin: {
    case: ['full'],
    document: ['full'],
    treatmentPlan: ['full'],
    appointment: ['full'],
    chat: ['full'],
    payment: ['full'],
    notification: ['full'],
  },
} as const;

export function normalizeCaseStatus(value: unknown): MedicalCaseStatus | undefined {
  if (typeof value !== 'string') return undefined;
  if (MEDICAL_CASE_STATUSES.includes(value as MedicalCaseStatus)) return value as MedicalCaseStatus;
  return LEGACY_MEDICAL_CASE_STATUS_MAP[value];
}

export function isMedicalCaseStatus(value: unknown): value is MedicalCaseStatus {
  return normalizeCaseStatus(value) !== undefined;
}

export function isTerminalCaseStatus(status: string | undefined) {
  const normalized = normalizeCaseStatus(status);
  return normalized ? TERMINAL_STATUSES.includes(normalized) : false;
}

export function canTransitionCaseStatus(role: string, fromStatus: string, toStatus: string) {
  const normalizedFrom = normalizeCaseStatus(fromStatus);
  const normalizedTo = normalizeCaseStatus(toStatus);
  if (!normalizedFrom || !normalizedTo) return false;
  if (normalizedFrom === normalizedTo) return true;
  const normalizedRole = (role || 'patient') as MedTourRole;
  const roleTargets = ROLE_STATUS_TRANSITIONS[normalizedRole] || [];
  return MEDICAL_CASE_TRANSITIONS[normalizedFrom].includes(normalizedTo) && roleTargets.includes(normalizedTo);
}

export function getAllowedCaseTransitions(role: string, fromStatus: string) {
  const normalizedFrom = normalizeCaseStatus(fromStatus);
  if (!normalizedFrom) return [];
  const normalizedRole = (role || 'patient') as MedTourRole;
  const roleTargets = ROLE_STATUS_TRANSITIONS[normalizedRole] || [];
  return MEDICAL_CASE_TRANSITIONS[normalizedFrom].filter((status) => roleTargets.includes(status));
}
