import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    adminPermissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::permission'
    >;
    adminUserOwner: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    kind: Schema.Attribute.Enumeration<['content-api', 'admin']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'content-api'>;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    apiToken: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_sessions';
  info: {
    description: 'Session Manager storage';
    displayName: 'Session';
    name: 'Session';
    pluralName: 'sessions';
    singularName: 'session';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
    i18n: {
      localized: false;
    };
  };
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    childId: Schema.Attribute.String & Schema.Attribute.Private;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::session'> &
      Schema.Attribute.Private;
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique;
    status: Schema.Attribute.String & Schema.Attribute.Private;
    type: Schema.Attribute.String & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    apiTokens: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiAboutAbout extends Struct.SingleTypeSchema {
  collectionName: 'abouts';
  info: {
    description: 'Write about yourself and the content you create';
    displayName: 'About';
    pluralName: 'abouts';
    singularName: 'about';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      ['shared.media', 'shared.quote', 'shared.rich-text', 'shared.slider']
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::about.about'> &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAppointmentAppointment extends Struct.CollectionTypeSchema {
  collectionName: 'appointments';
  info: {
    displayName: 'Appointment';
    pluralName: 'appointments';
    singularName: 'appointment';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    chatLog: Schema.Attribute.JSON;
    consultationLanguage: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'en'>;
    consultationPurpose: Schema.Attribute.Enumeration<
      ['initial_case_review', 'follow_up', 'pre_treatment', 'post_treatment']
    > &
      Schema.Attribute.DefaultTo<'initial_case_review'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dateTime: Schema.Attribute.DateTime;
    doctor: Schema.Attribute.Relation<'manyToOne', 'api::doctor.doctor'>;
    doctorDecision: Schema.Attribute.Enumeration<
      ['treatment_required', 'no_treatment_needed', 'needs_more_documents']
    >;
    doctorDecisionNotes: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::appointment.appointment'
    > &
      Schema.Attribute.Private;
    medical_case: Schema.Attribute.Relation<
      'manyToOne',
      'api::medical-case.medical-case'
    >;
    medical_documents: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-document.medical-document'
    >;
    patient: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    paymentId: Schema.Attribute.String;
    paymentStatus: Schema.Attribute.Enumeration<
      ['pending', 'paid', 'refunded', 'failed']
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    price: Schema.Attribute.Integer & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    rating: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 10;
          min: 1;
        },
        number
      >;
    review: Schema.Attribute.Text;
    roomId: Schema.Attribute.String;
    statuse: Schema.Attribute.Enumeration<
      [
        'pending',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
        'no_show',
      ]
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    type: Schema.Attribute.Enumeration<['video', 'chat']> &
      Schema.Attribute.DefaultTo<'video'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiArticleArticle extends Struct.CollectionTypeSchema {
  collectionName: 'articles';
  info: {
    description: 'Create your blog content';
    displayName: 'Article';
    pluralName: 'articles';
    singularName: 'article';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    author: Schema.Attribute.Relation<'manyToOne', 'api::author.author'>;
    blocks: Schema.Attribute.DynamicZone<
      ['shared.media', 'shared.quote', 'shared.rich-text', 'shared.slider']
    >;
    category: Schema.Attribute.Relation<'manyToOne', 'api::category.category'>;
    cover: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::article.article'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'title'>;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAuthorAuthor extends Struct.CollectionTypeSchema {
  collectionName: 'authors';
  info: {
    description: 'Create authors for your content';
    displayName: 'Author';
    pluralName: 'authors';
    singularName: 'author';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    articles: Schema.Attribute.Relation<'oneToMany', 'api::article.article'>;
    avatar: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::author.author'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCaseEventCaseEvent extends Struct.CollectionTypeSchema {
  collectionName: 'case_events';
  info: {
    displayName: 'CaseEvent';
    pluralName: 'case-events';
    singularName: 'case-event';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    actor: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    eventType: Schema.Attribute.Enumeration<
      [
        'CREATED',
        'STATUS_CHANGED',
        'ASSIGNED',
        'DOCUMENT_UPLOADED',
        'CONSULTATION_SCHEDULED',
        'DOCTOR_DECISION',
        'PLAN_SENT',
        'PLAN_ACCEPTED',
        'TRAVEL_UPDATED',
        'CHAT_MESSAGE_SENT',
        'CHAT_READ',
        'CHAT_TAKEOVER',
        'CHAT_UPLOAD',
        'DOCUMENT_REQUESTED',
        'REMINDER_CREATED',
        'SLA_OVERDUE',
        'NOTE',
      ]
    > &
      Schema.Attribute.DefaultTo<'NOTE'>;
    fromStatus: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::case-event.case-event'
    > &
      Schema.Attribute.Private;
    medical_case: Schema.Attribute.Relation<
      'manyToOne',
      'api::medical-case.medical-case'
    >;
    message: Schema.Attribute.Text;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    toStatus: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCategoryCategory extends Struct.CollectionTypeSchema {
  collectionName: 'categories';
  info: {
    description: 'Organize your content into categories';
    displayName: 'Category';
    pluralName: 'categories';
    singularName: 'category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    articles: Schema.Attribute.Relation<'oneToMany', 'api::article.article'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::category.category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiClinicClinic extends Struct.CollectionTypeSchema {
  collectionName: 'clinics';
  info: {
    displayName: 'Clinic';
    pluralName: 'clinics';
    singularName: 'clinic';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    address: Schema.Attribute.String;
    clinicType: Schema.Attribute.Enumeration<
      ['nnmc', 'mexelhealth', 'umit', 'other']
    > &
      Schema.Attribute.DefaultTo<'other'>;
    contactPerson: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.RichText;
    doctors: Schema.Attribute.Relation<'oneToMany', 'api::doctor.doctor'>;
    email: Schema.Attribute.Email;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::clinic.clinic'
    > &
      Schema.Attribute.Private;
    medical_cases: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-case.medical-case'
    >;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'>;
    specializations: Schema.Attribute.JSON;
    treatment_plans: Schema.Attribute.Relation<
      'oneToMany',
      'api::treatment-plan.treatment-plan'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    website: Schema.Attribute.String;
  };
}

export interface ApiConversationConversation
  extends Struct.CollectionTypeSchema {
  collectionName: 'conversations';
  info: {
    displayName: 'Conversation';
    pluralName: 'conversations';
    singularName: 'conversation';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    activeManager: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    appointment: Schema.Attribute.Relation<
      'oneToOne',
      'api::appointment.appointment'
    >;
    channel: Schema.Attribute.Enumeration<['case', 'appointment', 'support']> &
      Schema.Attribute.DefaultTo<'case'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    doctorChatEnabled: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    guestContact: Schema.Attribute.String;
    guestId: Schema.Attribute.String;
    guestLocale: Schema.Attribute.String;
    guestName: Schema.Attribute.String;
    guestSourceUrl: Schema.Attribute.Text;
    lastMessage: Schema.Attribute.Text;
    lastMessageAt: Schema.Attribute.DateTime;
    lastReadBy: Schema.Attribute.JSON;
    lifecycleStatus: Schema.Attribute.Enumeration<
      ['open', 'pending', 'closed']
    > &
      Schema.Attribute.DefaultTo<'open'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::conversation.conversation'
    > &
      Schema.Attribute.Private;
    medical_case: Schema.Attribute.Relation<
      'oneToOne',
      'api::medical-case.medical-case'
    >;
    messages: Schema.Attribute.Relation<'oneToMany', 'api::message.message'>;
    publishedAt: Schema.Attribute.DateTime;
    sharedQueue: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    takeoverAt: Schema.Attribute.DateTime;
    unreadBy: Schema.Attribute.JSON;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users_permissions_users: Schema.Attribute.Relation<
      'manyToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiDeviceTokenDeviceToken extends Struct.CollectionTypeSchema {
  collectionName: 'device_tokens';
  info: {
    displayName: 'DeviceToken';
    pluralName: 'device-tokens';
    singularName: 'device-token';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    appId: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'kz.nnmc.medtour'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    disabledAt: Schema.Attribute.DateTime;
    lastSeenAt: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::device-token.device-token'
    > &
      Schema.Attribute.Private;
    platform: Schema.Attribute.Enumeration<['ios', 'android']> &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiDoctorDoctor extends Struct.CollectionTypeSchema {
  collectionName: 'doctors';
  info: {
    displayName: 'Doctor';
    pluralName: 'doctors';
    singularName: 'doctor';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    appointments: Schema.Attribute.Relation<
      'oneToMany',
      'api::appointment.appointment'
    >;
    bio: Schema.Attribute.RichText;
    breakEnd: Schema.Attribute.String;
    breakStart: Schema.Attribute.String;
    clinic: Schema.Attribute.Relation<'manyToOne', 'api::clinic.clinic'>;
    consultationDuration: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<30>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    education: Schema.Attribute.Text;
    experience: Schema.Attribute.Integer;
    fullName: Schema.Attribute.String;
    i18n: Schema.Attribute.JSON;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    languages: Schema.Attribute.JSON;
    licenseNumber: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::doctor.doctor'
    > &
      Schema.Attribute.Private;
    medical_cases: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-case.medical-case'
    >;
    medical_documents: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-document.medical-document'
    >;
    photo: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    position: Schema.Attribute.String;
    price: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 10000000;
          min: 0;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    rating: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 10;
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    reviews: Schema.Attribute.Relation<'oneToMany', 'api::review.review'>;
    reviewsCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    slotDuration: Schema.Attribute.Integer;
    specialization: Schema.Attribute.Relation<
      'manyToOne',
      'api::specialization.specialization'
    >;
    time_slots: Schema.Attribute.Relation<
      'oneToMany',
      'api::time-slot.time-slot'
    >;
    treatment_plans: Schema.Attribute.Relation<
      'oneToMany',
      'api::treatment-plan.treatment-plan'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userId: Schema.Attribute.Integer;
    users_permissions_user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    workEndTime: Schema.Attribute.String;
    workingDays: Schema.Attribute.String;
    workingHours: Schema.Attribute.JSON;
    workplace: Schema.Attribute.String;
    workStartTime: Schema.Attribute.String;
  };
}

export interface ApiFinanceLedgerFinanceLedger
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_ledgers';
  info: {
    displayName: 'FinanceLedger';
    pluralName: 'finance-ledgers';
    singularName: 'finance-ledger';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    appointment: Schema.Attribute.Relation<
      'manyToOne',
      'api::appointment.appointment'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    createdByUser: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'KZT'>;
    entryType: Schema.Attribute.Enumeration<
      [
        'PAYMENT_AUTHORIZED',
        'PAYMENT_CAPTURED',
        'PAYMENT_FAILED',
        'REFUND_REQUESTED',
        'REFUND_APPROVED',
        'REFUND_REJECTED',
        'REFUND_SETTLED',
        'ADJUSTMENT',
      ]
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-ledger.finance-ledger'
    > &
      Schema.Attribute.Private;
    medical_case: Schema.Attribute.Relation<
      'manyToOne',
      'api::medical-case.medical-case'
    >;
    metadata: Schema.Attribute.JSON;
    notes: Schema.Attribute.Text;
    patient: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    paymentProvider: Schema.Attribute.String;
    providerPaymentId: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    reconciliationStatus: Schema.Attribute.Enumeration<
      ['PENDING', 'MATCHED', 'MISMATCH', 'MANUAL_REVIEW']
    > &
      Schema.Attribute.DefaultTo<'PENDING'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiGlobalGlobal extends Struct.SingleTypeSchema {
  collectionName: 'globals';
  info: {
    description: 'Define global settings';
    displayName: 'Global';
    pluralName: 'globals';
    singularName: 'global';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultSeo: Schema.Attribute.Component<'shared.seo', false>;
    favicon: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    landingConfig: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::global.global'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    siteDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    siteName: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiGuideVideoGuideVideo extends Struct.CollectionTypeSchema {
  collectionName: 'guide_videos';
  info: {
    description: 'Patient platform guide videos';
    displayName: 'Guide Video';
    pluralName: 'guide-videos';
    singularName: 'guide-video';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    i18n: Schema.Attribute.JSON;
    icon: Schema.Attribute.Enumeration<
      ['play', 'upload', 'video', 'chat', 'document']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'play'>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::guide-video.guide-video'
    > &
      Schema.Attribute.Private;
    poster: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    videoFile: Schema.Attribute.Media<'videos'>;
    videoUrl: Schema.Attribute.String;
  };
}

export interface ApiMedicalCaseMedicalCase extends Struct.CollectionTypeSchema {
  collectionName: 'medical_cases';
  info: {
    displayName: 'MedicalCase';
    pluralName: 'medical-cases';
    singularName: 'medical-case';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    appointments: Schema.Attribute.Relation<
      'oneToMany',
      'api::appointment.appointment'
    >;
    arrivalDate: Schema.Attribute.Date;
    budgetRange: Schema.Attribute.String;
    cancellationReason: Schema.Attribute.Text;
    case_events: Schema.Attribute.Relation<
      'oneToMany',
      'api::case-event.case-event'
    >;
    caseNumber: Schema.Attribute.String & Schema.Attribute.Unique;
    clinic: Schema.Attribute.Relation<'manyToOne', 'api::clinic.clinic'>;
    conversation: Schema.Attribute.Relation<
      'oneToOne',
      'api::conversation.conversation'
    >;
    coordinator: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    country: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currentTreatment: Schema.Attribute.Text;
    departureDate: Schema.Attribute.Date;
    desiredDates: Schema.Attribute.JSON;
    diagnosis: Schema.Attribute.Text;
    doctor: Schema.Attribute.Relation<'manyToOne', 'api::doctor.doctor'>;
    flightDetails: Schema.Attribute.JSON;
    hotelName: Schema.Attribute.String;
    internalNotes: Schema.Attribute.Text;
    language: Schema.Attribute.String & Schema.Attribute.DefaultTo<'en'>;
    leadCampaign: Schema.Attribute.String;
    leadMedium: Schema.Attribute.String;
    leadReferrer: Schema.Attribute.Text;
    leadSource: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-case.medical-case'
    > &
      Schema.Attribute.Private;
    manager: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    medical_documents: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-document.medical-document'
    >;
    patient: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    preferredContact: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      [
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
      ]
    > &
      Schema.Attribute.DefaultTo<'NEW_LEAD'>;
    symptoms: Schema.Attribute.Text;
    timezone: Schema.Attribute.String;
    title: Schema.Attribute.String;
    tourism_packages: Schema.Attribute.Relation<
      'oneToMany',
      'api::tourism-package.tourism-package'
    >;
    tourismNotes: Schema.Attribute.Text;
    tourismRequested: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    treatment_plans: Schema.Attribute.Relation<
      'oneToMany',
      'api::treatment-plan.treatment-plan'
    >;
    treatmentCategory: Schema.Attribute.String;
    trip_checklist: Schema.Attribute.Relation<
      'oneToOne',
      'api::trip-checklist.trip-checklist'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    urgency: Schema.Attribute.Enumeration<['routine', 'soon', 'urgent']> &
      Schema.Attribute.DefaultTo<'routine'>;
    visa_requests: Schema.Attribute.Relation<
      'oneToMany',
      'api::visa-request.visa-request'
    >;
    visaSupportNeeded: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
  };
}

export interface ApiMedicalDocumentMedicalDocument
  extends Struct.CollectionTypeSchema {
  collectionName: 'medical_documents';
  info: {
    displayName: 'MedicalDocument';
    pluralName: 'medical-documents';
    singularName: 'medical-document';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    appointment: Schema.Attribute.Relation<
      'manyToOne',
      'api::appointment.appointment'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    doctor: Schema.Attribute.Relation<'manyToOne', 'api::doctor.doctor'>;
    dueDate: Schema.Attribute.Date;
    file: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-document.medical-document'
    > &
      Schema.Attribute.Private;
    medical_case: Schema.Attribute.Relation<
      'manyToOne',
      'api::medical-case.medical-case'
    >;
    publishedAt: Schema.Attribute.DateTime;
    requestedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    requestedLanguage: Schema.Attribute.String;
    reviewedAt: Schema.Attribute.DateTime;
    reviewedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    reviewNotes: Schema.Attribute.Text;
    reviewStatus: Schema.Attribute.Enumeration<
      [
        'REQUESTED',
        'UPLOADED',
        'IN_REVIEW',
        'APPROVED',
        'REJECTED',
        'TRANSLATION_NEEDED',
        'TRANSLATED',
      ]
    > &
      Schema.Attribute.DefaultTo<'UPLOADED'>;
    sharedWithDoctors: Schema.Attribute.Relation<
      'manyToMany',
      'api::doctor.doctor'
    >;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<
      [
        'analysis',
        'prescription',
        'certificate',
        'mrt',
        'xray',
        'ultrasound',
        'other',
      ]
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiMessageMessage extends Struct.CollectionTypeSchema {
  collectionName: 'messages';
  info: {
    displayName: 'Message';
    pluralName: 'messages';
    singularName: 'message';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    attachments: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    conversation: Schema.Attribute.Relation<
      'manyToOne',
      'api::conversation.conversation'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deliveredAt: Schema.Attribute.DateTime;
    isRead: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::message.message'
    > &
      Schema.Attribute.Private;
    messageType: Schema.Attribute.Enumeration<
      ['text', 'file', 'image', 'system']
    > &
      Schema.Attribute.DefaultTo<'text'>;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    readAt: Schema.Attribute.DateTime;
    readBy: Schema.Attribute.JSON;
    sender: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNotificationNotification
  extends Struct.CollectionTypeSchema {
  collectionName: 'notifications';
  info: {
    displayName: 'Notification';
    pluralName: 'notifications';
    singularName: 'notification';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isRead: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    link: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::notification.notification'
    > &
      Schema.Attribute.Private;
    message: Schema.Attribute.Text;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<
      ['appointment', 'reminder', 'message', 'document', 'video', 'system']
    > &
      Schema.Attribute.DefaultTo<'system'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiPriceItemPriceItem extends Struct.CollectionTypeSchema {
  collectionName: 'price_items';
  info: {
    description: 'Editable services and prices for the public price list';
    displayName: 'Price Item';
    pluralName: 'price-items';
    singularName: 'price-item';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    badge: Schema.Attribute.String;
    category: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.Enumeration<['KZT', 'USD', 'EUR', 'RUB']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'KZT'>;
    description: Schema.Attribute.Text;
    i18n: Schema.Attribute.JSON;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    isFeatured: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::price-item.price-item'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    price: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    unit: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'\u0443\u0441\u043B\u0443\u0433\u0430'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiReviewReview extends Struct.CollectionTypeSchema {
  collectionName: 'reviews';
  info: {
    displayName: 'Review';
    pluralName: 'reviews';
    singularName: 'review';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    appointment: Schema.Attribute.Relation<
      'oneToOne',
      'api::appointment.appointment'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    doctor: Schema.Attribute.Relation<'manyToOne', 'api::doctor.doctor'>;
    isPublished: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::review.review'
    > &
      Schema.Attribute.Private;
    patient: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    publishedAt: Schema.Attribute.DateTime;
    rating: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 10;
          min: 1;
        },
        number
      >;
    text: Schema.Attribute.Text;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSpecializationSpecialization
  extends Struct.CollectionTypeSchema {
  collectionName: 'specializations';
  info: {
    displayName: 'Specialization';
    pluralName: 'specializations';
    singularName: 'specialization';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    doctors: Schema.Attribute.Relation<'oneToMany', 'api::doctor.doctor'>;
    icon: Schema.Attribute.String;
    image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::specialization.specialization'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    nameEn: Schema.Attribute.String;
    nameKk: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTimeSlotTimeSlot extends Struct.CollectionTypeSchema {
  collectionName: 'time_slots';
  info: {
    displayName: 'TimeSlot';
    pluralName: 'time-slots';
    singularName: 'time-slot';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    appointment: Schema.Attribute.Relation<
      'oneToOne',
      'api::appointment.appointment'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.Date & Schema.Attribute.Required;
    doctor: Schema.Attribute.Relation<'manyToOne', 'api::doctor.doctor'>;
    isBooked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::time-slot.time-slot'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    time: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTourismPackageTourismPackage
  extends Struct.CollectionTypeSchema {
  collectionName: 'tourism_packages';
  info: {
    displayName: 'TourismPackage';
    pluralName: 'tourism-packages';
    singularName: 'tourism-package';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    city: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.Enumeration<['USD', 'EUR', 'GBP', 'KZT']> &
      Schema.Attribute.DefaultTo<'USD'>;
    description: Schema.Attribute.Text;
    itinerary: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tourism-package.tourism-package'
    > &
      Schema.Attribute.Private;
    medical_case: Schema.Attribute.Relation<
      'manyToOne',
      'api::medical-case.medical-case'
    >;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      [
        'DRAFT',
        'OFFERED',
        'ACCEPTED',
        'DECLINED',
        'BOOKED',
        'COMPLETED',
        'CANCELLED',
      ]
    > &
      Schema.Attribute.DefaultTo<'DRAFT'>;
    title: Schema.Attribute.String;
    totalCost: Schema.Attribute.Decimal;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTreatmentPlanTreatmentPlan
  extends Struct.CollectionTypeSchema {
  collectionName: 'treatment_plans';
  info: {
    displayName: 'TreatmentPlan';
    pluralName: 'treatment-plans';
    singularName: 'treatment-plan';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    acceptedAt: Schema.Attribute.DateTime;
    clinic: Schema.Attribute.Relation<'manyToOne', 'api::clinic.clinic'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.Enumeration<['USD', 'EUR', 'GBP', 'KZT']> &
      Schema.Attribute.DefaultTo<'USD'>;
    diagnosisSummary: Schema.Attribute.Text;
    doctor: Schema.Attribute.Relation<'manyToOne', 'api::doctor.doctor'>;
    doctorDecisionNotes: Schema.Attribute.Text;
    estimatedDurationDays: Schema.Attribute.Integer;
    excludedServices: Schema.Attribute.JSON;
    includedServices: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::treatment-plan.treatment-plan'
    > &
      Schema.Attribute.Private;
    medical_case: Schema.Attribute.Relation<
      'manyToOne',
      'api::medical-case.medical-case'
    >;
    procedures: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    recommendations: Schema.Attribute.Text;
    risks: Schema.Attribute.Text;
    sentAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED']
    > &
      Schema.Attribute.DefaultTo<'DRAFT'>;
    title: Schema.Attribute.String;
    totalCost: Schema.Attribute.Decimal;
    treatmentNeeded: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTripChecklistTripChecklist
  extends Struct.CollectionTypeSchema {
  collectionName: 'trip_checklists';
  info: {
    displayName: 'TripChecklist';
    pluralName: 'trip-checklists';
    singularName: 'trip-checklist';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    items: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::trip-checklist.trip-checklist'
    > &
      Schema.Attribute.Private;
    managerNotes: Schema.Attribute.Text;
    medical_case: Schema.Attribute.Relation<
      'oneToOne',
      'api::medical-case.medical-case'
    >;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['OPEN', 'IN_PROGRESS', 'COMPLETED']> &
      Schema.Attribute.DefaultTo<'OPEN'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiVisaRequestVisaRequest extends Struct.CollectionTypeSchema {
  collectionName: 'visa_requests';
  info: {
    displayName: 'VisaRequest';
    pluralName: 'visa-requests';
    singularName: 'visa-request';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    approvedAt: Schema.Attribute.DateTime;
    country: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    invitationLetter: Schema.Attribute.Media<'files'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::visa-request.visa-request'
    > &
      Schema.Attribute.Private;
    medical_case: Schema.Attribute.Relation<
      'manyToOne',
      'api::medical-case.medical-case'
    >;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    requiredDocs: Schema.Attribute.JSON;
    status: Schema.Attribute.Enumeration<
      [
        'NOT_STARTED',
        'DOCS_REQUESTED',
        'DOCS_RECEIVED',
        'INVITATION_PREPARING',
        'INVITATION_SENT',
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'NOT_REQUIRED',
      ]
    > &
      Schema.Attribute.DefaultTo<'NOT_STARTED'>;
    submittedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    visaType: Schema.Attribute.String;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.Text;
    caption: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    focalPoint: Schema.Attribute.JSON;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.Text;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.Text & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    appointments: Schema.Attribute.Relation<
      'oneToMany',
      'api::appointment.appointment'
    >;
    avatar: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    birthDate: Schema.Attribute.Date;
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    conversations: Schema.Attribute.Relation<
      'manyToMany',
      'api::conversation.conversation'
    >;
    coordinated_medical_cases: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-case.medical-case'
    >;
    country: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    fullName: Schema.Attribute.String;
    gender: Schema.Attribute.Enumeration<['male', 'female']>;
    i18n: Schema.Attribute.JSON;
    iin: Schema.Attribute.String;
    isVerified: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    language: Schema.Attribute.String & Schema.Attribute.DefaultTo<'en'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    managed_medical_cases: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-case.medical-case'
    >;
    medical_cases: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-case.medical-case'
    >;
    medical_documents: Schema.Attribute.Relation<
      'oneToMany',
      'api::medical-document.medical-document'
    >;
    messages: Schema.Attribute.Relation<'oneToMany', 'api::message.message'>;
    passportNumber: Schema.Attribute.String;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    phone: Schema.Attribute.String;
    phoneNormalized: Schema.Attribute.String & Schema.Attribute.Private;
    platformGuideCompleted: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    platformGuideCompletedAt: Schema.Attribute.DateTime;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    reviews: Schema.Attribute.Relation<'oneToMany', 'api::review.review'>;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    userRole: Schema.Attribute.Enumeration<
      ['patient', 'manager', 'coordinator', 'doctor', 'admin']
    > &
      Schema.Attribute.DefaultTo<'patient'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::session': AdminSession;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::about.about': ApiAboutAbout;
      'api::appointment.appointment': ApiAppointmentAppointment;
      'api::article.article': ApiArticleArticle;
      'api::author.author': ApiAuthorAuthor;
      'api::case-event.case-event': ApiCaseEventCaseEvent;
      'api::category.category': ApiCategoryCategory;
      'api::clinic.clinic': ApiClinicClinic;
      'api::conversation.conversation': ApiConversationConversation;
      'api::device-token.device-token': ApiDeviceTokenDeviceToken;
      'api::doctor.doctor': ApiDoctorDoctor;
      'api::finance-ledger.finance-ledger': ApiFinanceLedgerFinanceLedger;
      'api::global.global': ApiGlobalGlobal;
      'api::guide-video.guide-video': ApiGuideVideoGuideVideo;
      'api::medical-case.medical-case': ApiMedicalCaseMedicalCase;
      'api::medical-document.medical-document': ApiMedicalDocumentMedicalDocument;
      'api::message.message': ApiMessageMessage;
      'api::notification.notification': ApiNotificationNotification;
      'api::price-item.price-item': ApiPriceItemPriceItem;
      'api::review.review': ApiReviewReview;
      'api::specialization.specialization': ApiSpecializationSpecialization;
      'api::time-slot.time-slot': ApiTimeSlotTimeSlot;
      'api::tourism-package.tourism-package': ApiTourismPackageTourismPackage;
      'api::treatment-plan.treatment-plan': ApiTreatmentPlanTreatmentPlan;
      'api::trip-checklist.trip-checklist': ApiTripChecklistTripChecklist;
      'api::visa-request.visa-request': ApiVisaRequestVisaRequest;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
