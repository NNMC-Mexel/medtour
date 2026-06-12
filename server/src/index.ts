import type { Core } from '@strapi/strapi';
import { decryptUserPII, encryptUserPII, isPiiEncryptionEnabled } from './utils/pii-crypto';

const defaultSpecializations = [
  { name: 'Терапевт', description: 'Врач общей практики', icon: 'stethoscope', sortOrder: 1 },
  { name: 'Кардиолог', description: 'Специалист по сердечно-сосудистой системе', icon: 'heart', sortOrder: 2 },
  { name: 'Невролог', description: 'Специалист по нервной системе', icon: 'brain', sortOrder: 3 },
  { name: 'Дерматолог', description: 'Специалист по кожным заболеваниям', icon: 'hand', sortOrder: 4 },
  { name: 'Офтальмолог', description: 'Специалист по заболеваниям глаз', icon: 'eye', sortOrder: 5 },
  { name: 'ЛОР', description: 'Отоларинголог - специалист по уху, горлу, носу', icon: 'ear', sortOrder: 6 },
  { name: 'Эндокринолог', description: 'Специалист по эндокринной системе', icon: 'activity', sortOrder: 7 },
  { name: 'Гастроэнтеролог', description: 'Специалист по желудочно-кишечному тракту', icon: 'stomach', sortOrder: 8 },
  { name: 'Уролог', description: 'Специалист по мочеполовой системе', icon: 'kidney', sortOrder: 9 },
  { name: 'Гинеколог', description: 'Специалист по женскому здоровью', icon: 'female', sortOrder: 10 },
  { name: 'Педиатр', description: 'Детский врач', icon: 'baby', sortOrder: 11 },
  { name: 'Психиатр', description: 'Специалист по психическому здоровью', icon: 'brain', sortOrder: 12 },
  { name: 'Психолог', description: 'Специалист по психологическому здоровью', icon: 'smile', sortOrder: 13 },
  { name: 'Хирург', description: 'Специалист по хирургическим операциям', icon: 'scissors', sortOrder: 14 },
  { name: 'Ортопед', description: 'Специалист по опорно-двигательной системе', icon: 'bone', sortOrder: 15 },
];

const defaultClinics = [
  {
    name: 'NNMC',
    slug: 'nnmc',
    clinicType: 'nnmc',
    website: 'https://www.nnmc.kz/',
    address: 'Astana, Kazakhstan',
    specializations: ['Cardiac surgery', 'Neurosurgery', 'Orthopedics', 'Transplantology', 'General surgery'],
    description: 'National scientific medical center and multidisciplinary partner clinic for MedTour cases.',
  },
  {
    name: 'MexelHealth',
    slug: 'mexelhealth',
    clinicType: 'mexelhealth',
    website: 'https://www.nnmc.kz/ru/mexelhealth',
    address: 'Astana, Kazakhstan',
    specializations: ['Check-ups', 'Diagnostics', 'Planned surgery', 'International patient programs'],
    description: 'Commercial medical services and planned treatment programs for international patients.',
  },
  {
    name: 'UMIT Tomotherapy',
    slug: 'umit-tomotherapy',
    clinicType: 'umit',
    website: 'https://tomo.kz/',
    address: 'Astana, Kazakhstan',
    specializations: ['Tomotherapy', 'Radiation therapy', 'Oncology', 'Chemotherapy'],
    description: 'Oncology-focused partner clinic with tomotherapy and cancer treatment services.',
  },
];

const medTourReadPermissions = [
  'api::medical-case.medical-case.find',
  'api::medical-case.medical-case.findOne',
  'api::clinic.clinic.find',
  'api::clinic.clinic.findOne',
  'api::global.global.find',
  'api::global.global.findOne',
  'api::about.about.find',
  'api::about.about.findOne',
  'api::price-item.price-item.find',
  'api::price-item.price-item.findOne',
  'api::guide-video.guide-video.find',
  'api::guide-video.guide-video.findOne',
];

const medTourPatientPermissions = [
  ...medTourReadPermissions,
  'api::device-token.device-token.register',
  'api::device-token.device-token.unregister',
  'api::medical-case.medical-case.create',
  'api::medical-case.medical-case.update',
  'api::conversation.conversation.forCase',
  'api::conversation.conversation.messages',
  'api::conversation.conversation.markRead',
  'api::treatment-plan.treatment-plan.find',
  'api::treatment-plan.treatment-plan.findOne',
  'api::treatment-plan.treatment-plan.update',
  'api::trip-checklist.trip-checklist.find',
  'api::trip-checklist.trip-checklist.findOne',
  'api::visa-request.visa-request.find',
  'api::visa-request.visa-request.findOne',
  'api::tourism-package.tourism-package.find',
  'api::tourism-package.tourism-package.findOne',
  'api::case-event.case-event.find',
  'api::case-event.case-event.findOne',
  'api::finance-ledger.finance-ledger.find',
  'api::finance-ledger.finance-ledger.findOne',
];

const medTourDoctorPermissions = [
  ...medTourReadPermissions,
  'api::device-token.device-token.register',
  'api::device-token.device-token.unregister',
  'api::medical-case.medical-case.update',
  'api::conversation.conversation.forCase',
  'api::conversation.conversation.messages',
  'api::conversation.conversation.markRead',
  'api::treatment-plan.treatment-plan.find',
  'api::treatment-plan.treatment-plan.findOne',
  'api::treatment-plan.treatment-plan.create',
  'api::treatment-plan.treatment-plan.update',
  'api::case-event.case-event.find',
  'api::case-event.case-event.findOne',
  'api::case-event.case-event.create',
  'api::finance-ledger.finance-ledger.find',
  'api::finance-ledger.finance-ledger.findOne',
];

const medTourStaffPermissions = [
  ...medTourReadPermissions,
  'api::device-token.device-token.register',
  'api::device-token.device-token.unregister',
  'api::medical-case.medical-case.create',
  'api::medical-case.medical-case.update',
  'api::medical-case.medical-case.delete',
  'api::conversation.conversation.forCase',
  'api::conversation.conversation.messages',
  'api::conversation.conversation.markRead',
  'api::conversation.conversation.takeover',
  'api::clinic.clinic.create',
  'api::clinic.clinic.update',
  'api::treatment-plan.treatment-plan.find',
  'api::treatment-plan.treatment-plan.findOne',
  'api::treatment-plan.treatment-plan.create',
  'api::treatment-plan.treatment-plan.update',
  'api::treatment-plan.treatment-plan.delete',
  'api::trip-checklist.trip-checklist.find',
  'api::trip-checklist.trip-checklist.findOne',
  'api::visa-request.visa-request.find',
  'api::visa-request.visa-request.findOne',
  'api::tourism-package.tourism-package.find',
  'api::tourism-package.tourism-package.findOne',
  'api::case-event.case-event.find',
  'api::case-event.case-event.findOne',
  'api::case-event.case-event.create',
  'api::case-event.case-event.update',
  'api::case-event.case-event.delete',
  'api::finance-ledger.finance-ledger.find',
  'api::finance-ledger.finance-ledger.findOne',
  'api::finance-ledger.finance-ledger.create',
  'api::finance-ledger.finance-ledger.update',
];

const medTourLogisticsWriterPermissions = [
  'api::trip-checklist.trip-checklist.create',
  'api::trip-checklist.trip-checklist.update',
  'api::visa-request.visa-request.create',
  'api::visa-request.visa-request.update',
  'api::tourism-package.tourism-package.create',
  'api::tourism-package.tourism-package.update',
];

const medTourLogisticsAdminPermissions = [
  'api::trip-checklist.trip-checklist.delete',
  'api::visa-request.visa-request.delete',
  'api::tourism-package.tourism-package.delete',
];

// Определение ролей и их permissions
const roleDefinitions = {
  patient: {
    name: 'Patient',
    description: 'Пациент — может записываться к врачам, просматривать свои записи и документы',
    permissions: [
      // Doctors — только чтение
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      ...medTourPatientPermissions,
      // Specializations — только чтение
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      // Appointments — CRUD (ownership проверяется policy)
      'api::appointment.appointment.find',
      'api::appointment.appointment.findOne',
      'api::appointment.appointment.create',
      'api::appointment.appointment.update',
      'api::appointment.appointment.canJoin',
      'api::appointment.appointment.findBookedSlots',
      // Reviews — чтение + создание
      'api::review.review.find',
      'api::review.review.findOne',
      'api::review.review.create',
      // Time slots — только чтение
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
      // Messages & Conversations
      'api::message.message.find',
      'api::message.message.findOne',
      'api::message.message.create',
      'api::conversation.conversation.find',
      'api::conversation.conversation.findOne',
      'api::conversation.conversation.create',
      // Medical documents — чтение + создание
      'api::medical-document.medical-document.find',
      'api::medical-document.medical-document.findOne',
      'api::medical-document.medical-document.create',
      'api::medical-document.medical-document.share',
      'api::medical-document.medical-document.myDoctors',
      // Notifications — свои
      'api::notification.notification.find',
      'api::notification.notification.findOne',
      'api::notification.notification.update',
      'api::notification.notification.delete',
      'api::notification.notification.unreadCount',
      'api::notification.notification.markAllAsRead',
      // Upload — write only. Listing removed: /api/upload/files is not
      // owner-scoped in Strapi, so it leaked the whole media library and fed
      // the file-IDOR (see N1). Files come back inline on POST /api/upload.
      'plugin::upload.content-api.upload',
      // Users-permissions — профиль
      'plugin::users-permissions.user.me',
      'plugin::users-permissions.user.updateMe',
      'plugin::users-permissions.auth.changePassword',
    ],
  },
  doctor: {
    name: 'Doctor',
    description: 'Врач — управляет своим профилем, слотами, видит свои записи',
    permissions: [
      // Doctor profile — чтение + обновление своего
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      'api::doctor.doctor.update',
      ...medTourDoctorPermissions,
      // Specializations — чтение
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      // Appointments — чтение + обновление (статус)
      'api::appointment.appointment.find',
      'api::appointment.appointment.findOne',
      'api::appointment.appointment.update',
      'api::appointment.appointment.canJoin',
      'api::appointment.appointment.findBookedSlots',
      // Reviews — только чтение
      'api::review.review.find',
      'api::review.review.findOne',
      // Time slots — полный CRUD
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
      'api::time-slot.time-slot.create',
      'api::time-slot.time-slot.update',
      'api::time-slot.time-slot.delete',
      // Messages & Conversations
      'api::message.message.find',
      'api::message.message.findOne',
      'api::message.message.create',
      'api::conversation.conversation.find',
      'api::conversation.conversation.findOne',
      'api::conversation.conversation.create',
      // Medical documents — полный CRUD (для своих пациентов)
      'api::medical-document.medical-document.find',
      'api::medical-document.medical-document.findOne',
      'api::medical-document.medical-document.create',
      'api::medical-document.medical-document.update',
      'api::medical-document.medical-document.myDoctors',
      // Notifications — свои
      'api::notification.notification.find',
      'api::notification.notification.findOne',
      'api::notification.notification.update',
      'api::notification.notification.delete',
      'api::notification.notification.unreadCount',
      'api::notification.notification.markAllAsRead',
      // Upload — write only. Listing removed: /api/upload/files is not
      // owner-scoped in Strapi, so it leaked the whole media library and fed
      // the file-IDOR (see N1). Files come back inline on POST /api/upload.
      'plugin::upload.content-api.upload',
      // Users-permissions — профиль
      'plugin::users-permissions.user.me',
      'plugin::users-permissions.user.updateMe',
      'plugin::users-permissions.auth.changePassword',
    ],
  },
  manager: {
    name: 'Manager',
    description: 'Менеджер MedTour — ведёт заявки, коммуникацию и логистику своего пула',
    permissions: [
      ...medTourStaffPermissions,
      ...medTourLogisticsWriterPermissions,
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      'api::appointment.appointment.find',
      'api::appointment.appointment.findOne',
      'api::appointment.appointment.create',
      'api::appointment.appointment.update',
      'api::appointment.appointment.canJoin',
      'api::appointment.appointment.findBookedSlots',
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
      'api::message.message.find',
      'api::message.message.findOne',
      'api::message.message.create',
      'api::conversation.conversation.find',
      'api::conversation.conversation.findOne',
      'api::conversation.conversation.create',
      'api::conversation.conversation.update',
      'api::medical-document.medical-document.find',
      'api::medical-document.medical-document.findOne',
      'api::medical-document.medical-document.create',
      'api::medical-document.medical-document.update',
      'api::medical-document.medical-document.myDoctors',
      'api::notification.notification.find',
      'api::notification.notification.findOne',
      'api::notification.notification.create',
      'api::notification.notification.update',
      'api::notification.notification.delete',
      'api::notification.notification.unreadCount',
      'api::notification.notification.markAllAsRead',
      // Upload — write only (listing removed, see N1).
      'plugin::upload.content-api.upload',
      'plugin::users-permissions.user.me',
      'plugin::users-permissions.user.updateMe',
      'plugin::users-permissions.auth.changePassword',
    ],
  },
  coordinator: {
    name: 'Coordinator',
    description: 'Медицинский координатор MedTour — проверяет документы, подбирает клинику и врача, готовит план лечения',
    permissions: [
      ...medTourStaffPermissions,
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      'api::appointment.appointment.find',
      'api::appointment.appointment.findOne',
      'api::appointment.appointment.create',
      'api::appointment.appointment.update',
      'api::appointment.appointment.canJoin',
      'api::appointment.appointment.findBookedSlots',
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
      'api::message.message.find',
      'api::message.message.findOne',
      'api::message.message.create',
      'api::conversation.conversation.find',
      'api::conversation.conversation.findOne',
      'api::conversation.conversation.create',
      'api::conversation.conversation.update',
      'api::medical-document.medical-document.find',
      'api::medical-document.medical-document.findOne',
      'api::medical-document.medical-document.create',
      'api::medical-document.medical-document.update',
      'api::medical-document.medical-document.myDoctors',
      'api::notification.notification.find',
      'api::notification.notification.findOne',
      'api::notification.notification.create',
      'api::notification.notification.update',
      'api::notification.notification.delete',
      'api::notification.notification.unreadCount',
      'api::notification.notification.markAllAsRead',
      // Upload — write only (listing removed, see N1).
      'plugin::upload.content-api.upload',
      'plugin::users-permissions.user.me',
      'plugin::users-permissions.user.updateMe',
      'plugin::users-permissions.auth.changePassword',
    ],
  },
  admin: {
    name: 'Admin',
    description: 'Администратор — полный доступ ко всем данным',
    permissions: [
      // Doctors — полный CRUD
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      'api::doctor.doctor.create',
      'api::doctor.doctor.update',
      'api::doctor.doctor.delete',
      ...medTourStaffPermissions,
      ...medTourLogisticsWriterPermissions,
      ...medTourLogisticsAdminPermissions,
      'api::clinic.clinic.delete',
      // Specializations — полный CRUD
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      'api::specialization.specialization.create',
      'api::specialization.specialization.update',
      'api::specialization.specialization.delete',
      // Price list — полный CRUD
      'api::price-item.price-item.create',
      'api::price-item.price-item.update',
      'api::price-item.price-item.delete',
      // Patient guide videos — полный CRUD
      'api::guide-video.guide-video.create',
      'api::guide-video.guide-video.update',
      'api::guide-video.guide-video.delete',
      // Appointments — полный CRUD
      'api::appointment.appointment.find',
      'api::appointment.appointment.findOne',
      'api::appointment.appointment.create',
      'api::appointment.appointment.update',
      'api::appointment.appointment.delete',
      'api::appointment.appointment.canJoin',
      'api::appointment.appointment.findBookedSlots',
      // Reviews — полный CRUD
      'api::review.review.find',
      'api::review.review.findOne',
      'api::review.review.create',
      'api::review.review.update',
      'api::review.review.delete',
      // Time slots — полный CRUD
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
      'api::time-slot.time-slot.create',
      'api::time-slot.time-slot.update',
      'api::time-slot.time-slot.delete',
      // Messages & Conversations — полный CRUD
      'api::message.message.find',
      'api::message.message.findOne',
      'api::message.message.create',
      'api::message.message.update',
      'api::message.message.delete',
      'api::conversation.conversation.find',
      'api::conversation.conversation.findOne',
      'api::conversation.conversation.create',
      'api::conversation.conversation.update',
      'api::conversation.conversation.delete',
      // Medical documents — полный CRUD
      'api::medical-document.medical-document.find',
      'api::medical-document.medical-document.findOne',
      'api::medical-document.medical-document.create',
      'api::medical-document.medical-document.update',
      'api::medical-document.medical-document.delete',
      'api::medical-document.medical-document.share',
      'api::medical-document.medical-document.myDoctors',
      // Notifications — полный CRUD
      'api::notification.notification.find',
      'api::notification.notification.findOne',
      'api::notification.notification.create',
      'api::notification.notification.update',
      'api::notification.notification.delete',
      'api::notification.notification.unreadCount',
      'api::notification.notification.markAllAsRead',
      // Articles — полный CRUD
      'api::article.article.find',
      'api::article.article.findOne',
      'api::article.article.create',
      'api::article.article.update',
      'api::article.article.delete',
      // Landing content — управление single types
      'api::global.global.find',
      'api::global.global.findOne',
      'api::global.global.update',
      'api::about.about.find',
      'api::about.about.findOne',
      'api::about.about.update',
      // Upload
      'plugin::upload.content-api.upload',
      'plugin::upload.content-api.find',
      'plugin::upload.content-api.findOne',
      'plugin::upload.content-api.destroy',
      // Users-permissions
      'plugin::users-permissions.user.find',
      'plugin::users-permissions.user.findOne',
      'plugin::users-permissions.user.create',
      'plugin::users-permissions.user.update',
      'plugin::users-permissions.user.destroy',
      'plugin::users-permissions.user.me',
      'plugin::users-permissions.user.updateMe',
      'plugin::users-permissions.role.find',
      'plugin::users-permissions.role.findOne',
      'plugin::users-permissions.auth.changePassword',
    ],
  },
};

async function seedSpecializations(strapi: Core.Strapi) {
  const existing = await strapi.documents('api::specialization.specialization').findMany({
    limit: 1,
  });

  if (existing.length > 0) {
    console.log('Specializations already exist, skipping seed.');
    return;
  }

  console.log('Seeding specializations...');
  for (const spec of defaultSpecializations) {
    try {
      const created = await strapi.documents('api::specialization.specialization').create({
        data: {
          name: spec.name,
          description: spec.description,
          icon: spec.icon,
          sortOrder: spec.sortOrder,
        },
      });

      if (created?.documentId) {
        await strapi.documents('api::specialization.specialization').publish({
          documentId: created.documentId,
        });
      }
      console.log(`  Created specialization: ${spec.name}`);
    } catch (error) {
      console.error(`  Error creating specialization ${spec.name}:`, error);
    }
  }
  console.log('Specializations seeded.');
}

async function seedClinics(strapi: Core.Strapi) {
  const existing = await strapi.documents('api::clinic.clinic' as any).findMany({
    limit: 1,
  });

  if (existing.length > 0) {
    console.log('Clinics already exist, skipping seed.');
    return;
  }

  console.log('Seeding MedTour clinics...');
  for (const clinic of defaultClinics) {
    try {
      const created = await strapi.documents('api::clinic.clinic' as any).create({
        data: {
          ...clinic,
          isActive: true,
        },
      });

      if (created?.documentId) {
        await (strapi.documents('api::clinic.clinic' as any) as any).publish({
          documentId: created.documentId,
        });
      }
      console.log(`  Created clinic: ${clinic.name}`);
    } catch (error) {
      console.error(`  Error creating clinic ${clinic.name}:`, error);
    }
  }
  console.log('MedTour clinics seeded.');
}

async function seedRolesAndPermissions(strapi: Core.Strapi) {
  console.log('Setting up roles and permissions...');

  for (const [roleType, definition] of Object.entries(roleDefinitions)) {
    // Проверяем, существует ли роль
    const existingRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: roleType } });

    let roleId: number;

    if (existingRole) {
      console.log(`  Role "${definition.name}" already exists (id=${existingRole.id}).`);
      roleId = existingRole.id;
    } else {
      const created = await strapi.query('plugin::users-permissions.role').create({
        data: {
          name: definition.name,
          description: definition.description,
          type: roleType,
        },
      });
      console.log(`  Created role "${definition.name}" (id=${created.id}).`);
      roleId = created.id;
    }

    // Назначаем permissions
    for (const action of definition.permissions) {
      try {
        const existingPerm = await strapi
          .query('plugin::users-permissions.permission')
          .findOne({ where: { action, role: roleId } });

        if (!existingPerm) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: { action, role: roleId },
          });
        }
      } catch (e: any) {
        console.error(`  Error setting permission ${action} for ${definition.name}: ${e.message}`);
      }
    }
    console.log(`  Permissions set for "${definition.name}".`);
  }

  // SECURITY (N1): the loop above only ADDS permissions, it never removes
  // them. On databases provisioned before this fix, patient/doctor/manager/
  // coordinator still carry upload list/findOne, which exposes the entire
  // media library and enables the file-IDOR. Actively revoke them here so the
  // fix applies to existing deployments, not just fresh seeds.
  const revokeFromNonAdmin = [
    'plugin::upload.content-api.find',
    'plugin::upload.content-api.findOne',
  ];
  for (const roleType of ['patient', 'doctor', 'manager', 'coordinator']) {
    const role = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: roleType } });
    if (!role) continue;
    for (const action of revokeFromNonAdmin) {
      const stale = await strapi
        .query('plugin::users-permissions.permission')
        .findMany({ where: { action, role: role.id } });
      for (const perm of stale) {
        await strapi.query('plugin::users-permissions.permission').delete({ where: { id: perm.id } });
        console.log(`  Revoked ${action} from role "${roleType}" (N1).`);
      }
    }
  }

  // Убираем опасные permissions из authenticated (если она осталась дефолтной)
  const authenticatedRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });

  if (authenticatedRole) {
    // Для authenticated оставляем только минимальный доступ (чтение публичных данных)
    const allowedForAuthenticated = [
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      'api::clinic.clinic.find',
      'api::clinic.clinic.findOne',
      'api::global.global.find',
      'api::global.global.findOne',
      'api::about.about.find',
      'api::about.about.findOne',
      'api::price-item.price-item.find',
      'api::price-item.price-item.findOne',
      'api::guide-video.guide-video.find',
      'api::guide-video.guide-video.findOne',
      'api::review.review.find',
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
      'plugin::users-permissions.user.me',
      'plugin::users-permissions.user.updateMe',
      'plugin::users-permissions.auth.changePassword',
    ];

    // Удаляем все текущие permissions этой роли
    const currentPerms = await strapi
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: authenticatedRole.id } });

    for (const perm of currentPerms) {
      if (!allowedForAuthenticated.includes(perm.action)) {
        await strapi.query('plugin::users-permissions.permission').delete({
          where: { id: perm.id },
        });
      }
    }

    // Добавляем минимальные, если их нет
    for (const action of allowedForAuthenticated) {
      const existing = await strapi
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action, role: authenticatedRole.id } });
      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action, role: authenticatedRole.id },
        });
      }
    }
    console.log('  Authenticated role stripped to read-only public data.');
  }

  const publicRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (publicRole) {
    const allowedForPublic = [
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      'api::clinic.clinic.find',
      'api::clinic.clinic.findOne',
      'api::global.global.find',
      'api::global.global.findOne',
      'api::about.about.find',
      'api::about.about.findOne',
      'api::price-item.price-item.find',
      'api::price-item.price-item.findOne',
      'api::guide-video.guide-video.find',
      'api::guide-video.guide-video.findOne',
      'api::review.review.find',
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
    ];

    for (const action of allowedForPublic) {
      const existing = await strapi
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action, role: publicRole.id } });
      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action, role: publicRole.id },
        });
      }
    }
    console.log('  Public role granted landing read access.');
  }

  console.log('Roles and permissions setup complete.');
}

/**
 * Force users-permissions advanced settings into a secure baseline on every
 * boot. Specifically: email_confirmation = true so /api/auth/local refuses
 * to log in unconfirmed accounts. Without this, anyone could register any
 * email address and immediately receive a JWT — enabling email squatting
 * and impersonation.
 *
 * Strapi stores advanced settings in core_store. We read the current value,
 * merge our overrides and write it back so an admin can still tune other
 * fields via the Strapi admin panel.
 */
async function enforceUsersPermissionsAdvanced(strapi: Core.Strapi) {
  try {
    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions', key: 'advanced' });
    const current = ((await pluginStore.get()) as Record<string, unknown> | null) || {};

    const desiredRedirect = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/email-confirmed`
      : (current.email_confirmation_redirection as string | undefined) || '/email-confirmed';

    const next = {
      ...current,
      email_confirmation: true,
      email_confirmation_redirection: desiredRedirect,
      // Defence: refuse login for blocked accounts; default-strict on
      // unique email (Strapi default is true, but we make it explicit).
      unique_email: true,
      allow_register: current.allow_register !== false,
    };

    await pluginStore.set({ value: next });
    console.log('Users-permissions advanced settings enforced: email_confirmation=true');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to enforce users-permissions advanced settings:', msg);
  }
}

/**
 * users-permissions stores transactional email templates in core_store. Those
 * templates carry their own "from" address and do not use the email provider's
 * defaultFrom. Keep them aligned with SMTP env so Yandex does not reject
 * confirmation emails with "Sender address rejected: user not found".
 */
async function enforceUsersPermissionsEmailSettings(strapi: Core.Strapi) {
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!fromEmail) {
    strapi.log.warn('SMTP_FROM/SMTP_USER is not set; users-permissions email sender was not enforced.');
    return;
  }

  try {
    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const current = ((await pluginStore.get({ key: 'email' })) as Record<string, any> | null) || {};
    const from = {
      name: process.env.SMTP_FROM_NAME || 'MedTour',
      email: fromEmail,
    };

    const patchTemplate = (template: any) => ({
      ...(template || {}),
      options: {
        ...(template?.options || {}),
        from,
        response_email: fromEmail,
      },
    });

    const next = {
      ...current,
      email_confirmation: patchTemplate(current.email_confirmation),
      reset_password: patchTemplate(current.reset_password),
    };

    await pluginStore.set({ key: 'email', value: next });
    strapi.log.info(`Users-permissions email sender enforced: ${from.email}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    strapi.log.error(`Failed to enforce users-permissions email settings: ${msg}`);
  }
}

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    // PII encryption-at-rest for iin / passportNumber (RK Law 94-V art.10).
    // Hooks the DB layer so every write path — REST API, custom register,
    // updateMe and the Strapi admin panel — is covered uniformly. Encrypt
    // before persisting; decrypt after reading so app code & admin see plaintext.
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      async beforeCreate(event: any) {
        encryptUserPII(event.params?.data);
      },
      async beforeUpdate(event: any) {
        encryptUserPII(event.params?.data);
      },
      async afterCreate(event: any) {
        decryptUserPII(event.result);
      },
      async afterUpdate(event: any) {
        decryptUserPII(event.result);
      },
      async afterFindOne(event: any) {
        decryptUserPII(event.result);
      },
      async afterFindMany(event: any) {
        if (Array.isArray(event.result)) event.result.forEach(decryptUserPII);
      },
    });
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seedSpecializations(strapi);
    await seedClinics(strapi);
    await seedRolesAndPermissions(strapi);
    await enforceUsersPermissionsAdvanced(strapi);
    await enforceUsersPermissionsEmailSettings(strapi);

    // L1: refuse to silently store IIN / passport in plaintext in production.
    if (!isPiiEncryptionEnabled()) {
      const msg = 'PII_ENCRYPTION_KEY missing/invalid (need 32 bytes as hex or base64): ' +
        'iin/passportNumber would be stored in PLAINTEXT. Required for RK Law 94-V compliance.';
      if (process.env.NODE_ENV === 'production') {
        // Hard fail: do not boot a production node that would persist medical
        // PII in the clear. Crashing here is safer than silently leaking.
        strapi.log.error('⛔ ' + msg + ' Refusing to start.');
        throw new Error('PII_ENCRYPTION_KEY is required in production');
      }
      strapi.log.warn('⚠️  ' + msg);
    } else {
      strapi.log.info('PII encryption enabled (iin/passportNumber, AES-256-GCM).');
    }

    // N3: test-payment mode lets patients create "paid" appointments without a
    // real gateway charge. Acceptable in staging, dangerous in production. Make
    // it impossible to leave on silently.
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.PAYMENTS_LIVE !== 'true' &&
      process.env.ALLOW_TEST_PAYMENTS_IN_PRODUCTION === 'true'
    ) {
      strapi.log.warn(
        '⚠️  ALLOW_TEST_PAYMENTS_IN_PRODUCTION=true with PAYMENTS_LIVE!=true: ' +
        'appointments can be marked PAID without a real payment. Disable this before going live.'
      );
    }
  },
};
