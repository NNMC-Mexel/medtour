// User Roles
export const ROLES = {
  PATIENT: 'patient',
  MANAGER: 'manager',
  COORDINATOR: 'coordinator',
  DOCTOR: 'doctor',
  ADMIN: 'admin',
}

// Temporary product switch: keep doctor consultation prices out of patient/public UI.
export const SHOW_DOCTOR_PRICES = false

// Medical Case Statuses - target Kazakhstan Med Travel CRM lifecycle
export const MEDICAL_CASE_STATUS = {
  NEW_LEAD: 'NEW_LEAD',
  REGISTERED: 'REGISTERED',
  WAITING_FOR_DOCUMENTS: 'WAITING_FOR_DOCUMENTS',
  DOCUMENTS_UPLOADED: 'DOCUMENTS_UPLOADED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  DOCTOR_ASSIGNED: 'DOCTOR_ASSIGNED',
  WAITING_PATIENT_CONFIRMATION: 'WAITING_PATIENT_CONFIRMATION',
  WAITING_PAYMENT: 'WAITING_PAYMENT',
  CONSULTATION_BOOKED: 'CONSULTATION_BOOKED',
  CONSULTATION_COMPLETED: 'CONSULTATION_COMPLETED',
  LOCAL_TREATMENT: 'LOCAL_TREATMENT',
  TREATMENT_IN_KAZAKHSTAN: 'TREATMENT_IN_KAZAKHSTAN',
  TRAVEL_PREPARATION: 'TRAVEL_PREPARATION',
  ARRIVED_TO_KAZAKHSTAN: 'ARRIVED_TO_KAZAKHSTAN',
  IN_TREATMENT: 'IN_TREATMENT',
  RECOVERY: 'RECOVERY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
}

// Appointment Statuses
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

// Appointment Types
export const APPOINTMENT_TYPES = {
  VIDEO: 'video',
  CHAT: 'chat',
  IN_PERSON: 'in_person',
}

// Time Slots (default)
export const DEFAULT_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '14:00', '14:30', '15:00', '15:30', '16:00',
  '16:30', '17:00', '17:30', '18:00',
]

// Specializations (common)
export const COMMON_SPECIALIZATIONS = [
  { id: 1, name: 'Терапевт', icon: 'stethoscope' },
  { id: 2, name: 'Кардиолог', icon: 'heart' },
  { id: 3, name: 'Невролог', icon: 'brain' },
  { id: 4, name: 'Дерматолог', icon: 'sparkles' },
  { id: 5, name: 'Гастроэнтеролог', icon: 'pill' },
  { id: 6, name: 'Офтальмолог', icon: 'eye' },
  { id: 7, name: 'Хирург', icon: 'scissors' },
  { id: 8, name: 'Педиатр', icon: 'baby' },
  { id: 9, name: 'Гинеколог', icon: 'user' },
  { id: 10, name: 'Уролог', icon: 'user' },
  { id: 11, name: 'Эндокринолог', icon: 'activity' },
  { id: 12, name: 'Психолог', icon: 'smile' },
]

// Navigation Items — labels are i18n keys resolved in Sidebar via t()
export const PATIENT_NAV_ITEMS = [
  { path: '/patient', label: 'nav.home', icon: 'home' },
  { path: '/patient/cases', label: 'nav.medical_cases', icon: 'activity' },
  { path: '/patient/appointments', label: 'nav.consultations', icon: 'calendar' },
  { path: '/patient/chat', label: 'nav.chat', icon: 'message-circle' },
  { path: '/patient/documents', label: 'nav.documents', icon: 'file-text' },
  { path: '/patient/plan-trip', label: 'nav.plan_trip', icon: 'clipboard-list' },
  { path: '/patient/guide', label: 'nav.guide', icon: 'circle-help' },
  { path: '/patient/profile', label: 'nav.profile', icon: 'user' },
]

export const PATIENT_BOTTOM_NAV_ITEMS = [
  { path: '/patient', label: 'nav.case_short', icon: 'activity' },
  { path: '/patient/chat', label: 'nav.chat_short', icon: 'message-circle' },
  { path: '/patient/documents', label: 'nav.documents_short', icon: 'file-text' },
  { path: '/patient/plan-trip', label: 'nav.plan_trip_short', icon: 'clipboard-list' },
  { path: '/patient/profile', label: 'nav.profile_short', icon: 'user' },
]

export const DOCTOR_NAV_ITEMS = [
  { path: '/doctor', label: 'nav.home', icon: 'home' },
  { path: '/doctor/cases', label: 'nav.medical_cases', icon: 'activity' },
  { path: '/doctor/schedule', label: 'nav.schedule', icon: 'calendar' },
  { path: '/doctor/patients', label: 'nav.patients', icon: 'users' },
  { path: '/doctor/chat', label: 'nav.chat', icon: 'message-circle' },
  { path: '/doctor/profile', label: 'nav.profile', icon: 'user' },
]

export const ADMIN_NAV_ITEMS = [
  { path: '/admin', label: 'nav.admin_dashboard', icon: 'layout-dashboard' },
  { path: '/admin/cases', label: 'nav.medical_cases', icon: 'activity' },
  { path: '/admin/users', label: 'nav.admin_users', icon: 'users' },
  { path: '/admin/doctors', label: 'nav.doctors', icon: 'stethoscope' },
  { path: '/admin/appointments', label: 'nav.admin_appointments', icon: 'calendar' },
  { path: '/admin/chat', label: 'nav.chat', icon: 'message-circle' },
  { path: '/admin/specializations', label: 'nav.admin_specializations', icon: 'tags' },
  { path: '/admin/treatment-departments', label: 'nav.admin_treatments', icon: 'activity' },
  { path: '/admin/prices', label: 'nav.admin_prices', icon: 'receipt-text' },
  { path: '/admin/guide-videos', label: 'nav.admin_guide_videos', icon: 'circle-help' },
  { path: '/admin/settings', label: 'nav.admin_settings', icon: 'settings' },
]

export const MANAGER_NAV_ITEMS = [
  { path: '/manager', label: 'nav.home', icon: 'home' },
  { path: '/manager/cases', label: 'nav.medical_cases', icon: 'activity' },
  { path: '/manager/chat', label: 'nav.chat', icon: 'message-circle' },
  { path: '/manager/documents', label: 'nav.documents', icon: 'file-text' },
]

export const COORDINATOR_NAV_ITEMS = [
  { path: '/coordinator', label: 'nav.home', icon: 'home' },
  { path: '/coordinator/cases', label: 'nav.medical_cases', icon: 'activity' },
  { path: '/coordinator/chat', label: 'nav.chat', icon: 'message-circle' },
  { path: '/coordinator/doctors', label: 'nav.doctors', icon: 'stethoscope' },
  { path: '/coordinator/documents', label: 'nav.documents', icon: 'file-text' },
]

// API Endpoints
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/local',
    REGISTER: '/api/auth/local/register',
    ME: '/api/users/me',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
  },
  APPOINTMENTS: '/api/appointments',
  MEDICAL_CASES: '/api/medical-cases',
  CLINICS: '/api/clinics',
  TREATMENT_PLANS: '/api/treatment-plans',
  TRIP_CHECKLISTS: '/api/trip-checklists',
  DOCTORS: '/api/doctors',
  PATIENTS: '/api/patients',
  SPECIALIZATIONS: '/api/specializations',
  CONVERSATIONS: '/api/conversations',
  MESSAGES: '/api/messages',
  DOCUMENTS: '/api/medical-documents', // Изменено с documents на medical-documents
  TIME_SLOTS: '/api/time-slots',
  REVIEWS: '/api/reviews',
  UPLOAD: '/api/upload',
}

// Validation Rules
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_NAME_LENGTH: 50,
  IIN_LENGTH: 12,
  PHONE_LENGTH: 11,
}

// Error Messages
export const ERROR_MESSAGES = {
  REQUIRED: 'Это поле обязательно',
  INVALID_EMAIL: 'Неверный формат email',
  INVALID_PHONE: 'Неверный формат телефона',
  INVALID_IIN: 'ИИН должен содержать 12 цифр',
  PASSWORD_TOO_SHORT: `Пароль должен содержать минимум ${VALIDATION.MIN_PASSWORD_LENGTH} символов`,
  PASSWORDS_NOT_MATCH: 'Пароли не совпадают',
  NETWORK_ERROR: 'Ошибка сети. Проверьте подключение к интернету',
  SERVER_ERROR: 'Ошибка сервера. Попробуйте позже',
}
