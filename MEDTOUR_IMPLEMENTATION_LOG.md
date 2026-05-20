# MedTour Implementation Log

Краткий контекст по адаптации проекта из MedConnect в MedTour.

## Главные Архитектурные Решения

- Backend остается на Strapi v5.
- Prisma не используется.
- `Appointment` не превращаем в главную бизнес-сущность.
- Главная бизнес-сущность MedTour: `MedicalCase`.
- `Appointment` остается онлайн-консультацией внутри medical case.
- MedTour model: пациент не выбирает врача сам, а создает заявку, которую ведет команда MedTour.

## Фаза 1

Цель: переориентировать проект с телемедицины на медицинский туризм.

Сделано:

- Обновлен корневой README: `README.md`.
- Добавлен архитектурный phase note: `MEDTOUR_PHASE1.md`.
- Публичный UX переведен в case-first модель.
- Лендинг больше не ведет пациента к самостоятельному выбору врача.
- CTA ведут к регистрации/созданию medical case.
- Брендинг обновлен с MedConnect на MedTour в основных местах frontend.
- Обновлены `.env.example` файлы.
- Добавлены базовые MedTour case statuses во frontend constants.
- Добавлены будущие роли `manager` и `coordinator` в user schema.
- Public registration защищен: staff/doctor/admin нельзя создать через публичную регистрацию.

Ключевые файлы:

- `README.md`
- `MEDTOUR_PHASE1.md`
- `frontend/src/pages/LandingPage.jsx`
- `frontend/src/components/layout/PublicLayout.jsx`
- `frontend/src/components/layout/Sidebar.jsx`
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/utils/constants.js`
- `server/src/extensions/users-permissions/content-types/user/schema.json`
- `server/src/extensions/users-permissions/strapi-server.ts`

## Фаза 2

Цель: добавить backend data model под MedTour.

Добавлены Strapi content types:

- `medical-case`
- `clinic`
- `treatment-plan`
- `trip-checklist`
- `visa-request`
- `tourism-package`
- `case-event`

Расширены существующие сущности:

- `user`: country, language, timezone, passportNumber, связи с cases.
- `doctor`: связь с clinic, medical cases, treatment plans.
- `appointment`: связь с medical case, consultation purpose/language, doctor decision.
- `medical-document`: связь с medical case.
- `conversation`: связь с medical case.

Добавлены роли и permissions:

- `manager`
- `coordinator`

Добавлен seed клиник:

- NNMC
- MexelHealth
- UMIT Tomotherapy

Ключевые файлы:

- `server/src/api/medical-case/**`
- `server/src/api/clinic/**`
- `server/src/api/treatment-plan/**`
- `server/src/api/trip-checklist/**`
- `server/src/api/visa-request/**`
- `server/src/api/tourism-package/**`
- `server/src/api/case-event/**`
- `server/src/index.ts`
- `server/src/api/appointment/content-types/appointment/schema.json`
- `server/src/api/medical-document/content-types/medical-document/schema.json`
- `server/src/api/conversation/content-types/conversation/schema.json`
- `server/src/api/doctor/content-types/doctor/schema.json`
- `frontend/src/services/api.js`

## Фаза 3

Цель: добавить первый frontend portal layer для medical cases.

Добавлено:

- Страница списка medical cases.
- Детальная карточка medical case.
- Routes для patient/admin/manager/coordinator.
- Навигация для manager и coordinator.
- Redirect после login для manager/coordinator.
- Patient dashboard block: MedTour case.
- Admin/manager/coordinator могут открыть карточку заявки.
- В карточке можно менять status, clinic, doctor, internal notes, tourism notes.
- Admin может назначать manager/coordinator.

Routes:

- `/patient/cases`
- `/patient/cases/:id`
- `/admin/cases`
- `/admin/cases/:id`
- `/manager`
- `/manager/cases`
- `/manager/cases/:id`
- `/coordinator`
- `/coordinator/cases`
- `/coordinator/cases/:id`

Ключевые файлы:

- `frontend/src/pages/cases/MedicalCasesPage.jsx`
- `frontend/src/pages/cases/MedicalCaseDetail.jsx`
- `frontend/src/App.jsx`
- `frontend/src/utils/constants.js`
- `frontend/src/pages/patient/PatientDashboard.jsx`
- `frontend/src/services/api.js`

## Фаза 4

Цель: добавить MVP flow по документам, решению врача и treatment plan.

Добавлено:

- Загрузка документов прямо в medical case.
- Список документов внутри карточки case.
- Doctor route:
  - `/doctor/cases`
  - `/doctor/cases/:id`
- Doctor decision UI:
  - `Treatment required`
  - `Need more documents`
  - `No treatment needed`
- После doctor decision меняется статус case:
  - `treatment_required` -> `PLAN_FORMING`
  - `needs_more_documents` -> `DOCS_PENDING`
  - `no_treatment_needed` -> `NO_TREATMENT_NEEDED`
- При doctor decision создается `case-event`.
- Treatment plan UI:
  - create/update
  - status
  - diagnosis summary
  - doctor decision notes
  - procedures
  - duration days
  - total cost
  - currency
  - recommendations
- Patient видит treatment plan в read-only режиме.

Backend security:

- Добавлен helper доступа: `server/src/utils/medtour-access.ts`.
- Scoped access добавлен для:
  - treatment plans
  - trip checklists
  - visa requests
  - tourism packages
  - case events
- Доступ фильтруется через доступ пользователя к `medical-case`.

Ключевые файлы:

- `frontend/src/pages/cases/MedicalCaseDetail.jsx`
- `frontend/src/stores/documentStore.js`
- `frontend/src/services/api.js`
- `frontend/src/App.jsx`
- `server/src/utils/medtour-access.ts`
- `server/src/api/treatment-plan/controllers/treatment-plan.ts`
- `server/src/api/trip-checklist/controllers/trip-checklist.ts`
- `server/src/api/visa-request/controllers/visa-request.ts`
- `server/src/api/tourism-package/controllers/tourism-package.ts`
- `server/src/api/case-event/controllers/case-event.ts`
- `server/src/index.ts`

## Фаза 5

Цель: QA и подготовка deploy для MedTour MVP.

Сделано:

- Обновлен smoke checklist под MedTour case-first flow.
- Проверены и зафиксированы QA сценарии:
  - роли и доступы;
  - приватность medical documents;
  - полный flow заявки;
  - SQLite local;
  - Postgres deploy;
  - MinIO/S3 uploads;
  - Coolify release checks.
- Обновлен Coolify deployment guide под домены MedTour:
  - `https://medtour.nnmc.kz`;
  - `https://medtourserver.nnmc.kz`;
  - `https://medtourrtc.nnmc.kz`.
- Strapi CORS переведен на `FRONTEND_URLS`.
- Production server URL по умолчанию обновлен на `medtourserver.nnmc.kz`.
- Upload config поддерживает оба набора env:
  - `MINIO_*`;
  - `S3_*`.
- File proxy закрыт для medical documents:
  - без JWT medical document file возвращает 403;
  - с JWT проверяется доступ к связанному document/case;
  - public media, не привязанная к medical document, остается доступной.
- Frontend download/preview документов использует авторизованный blob-запрос.
- Добавлены Nixpacks configs для frontend и signaling service.
- Добавлены missing permissions для custom document routes:
  - `medical-document.share`;
  - `medical-document.myDoctors`.

Ключевые файлы:

- `QA_SMOKE_CHECKLIST.md`
- `DEPLOYMENT.md`
- `server/config/plugins.ts`
- `server/config/middlewares.ts`
- `server/config/server.ts`
- `server/.env.example`
- `server/src/api/file-proxy/controllers/file-proxy.ts`
- `server/src/index.ts`
- `frontend/src/services/api.js`
- `frontend/src/pages/patient/PatientDocuments.jsx`
- `frontend/nixpacks.toml`
- `signaling-server/nixpacks.toml`

## Проверки

Фаза 5 проверки:

```bash
cd server
npm run build
```

```bash
cd server
DATABASE_CLIENT=postgres DATABASE_URL=postgres://user:password@localhost:5432/medtour npm run build
```

```bash
cd server
DATABASE_CLIENT=sqlite DATABASE_FILENAME=.tmp/data.db PORT=1350 npm run develop
```

```bash
cd frontend
npm run build
```

```bash
cd signaling-server
npm start
curl http://localhost:1341/health
```

Результат:

- Server build successful.
- Server build with `DATABASE_CLIENT=postgres` successful.
- SQLite develop стартовал успешно на временном порту, bootstrap ролей/permissions/клиник прошел.
- Frontend build successful.
- Signaling health returned `{"status":"ok"}`.
- `npm run lint` во frontend пока падает на существующих legacy lint errors в разных файлах; это не связано с Фазой 5 build path.
- Реальный MinIO upload не прогонялся без запущенного MinIO bucket/credentials; конфиг и privacy proxy подготовлены.

Последние проверки проходили успешно:

```bash
cd frontend
npm run build
```

```bash
cd server
npm run build
```

```bash
cd server
npm run develop
```

Strapi стартовал успешно:

- `http://localhost:1340`

Frontend dev server:

- `http://localhost:1342`

Примечание:

- Vite показывает warning про большой JS chunk. Это не blocker для MVP.
- Позже стоит сделать lazy routes / code splitting.

## Текущий MVP Flow

1. Patient регистрируется.
2. Patient открывает `/patient/cases`.
3. Patient создает medical case.
4. Patient загружает документы в case.
5. Admin назначает manager/coordinator/clinic/doctor.
6. Doctor открывает `/doctor/cases/:id`.
7. Doctor принимает решение:
   - лечение нужно
   - нужны еще документы
   - лечение не нужно
8. Doctor/coordinator/admin создает treatment plan.
9. Patient видит treatment plan.

## Следующие Логичные Фазы

### Фаза 5

Сделать полноценный manager/coordinator workflow:

- отдельный dashboard manager;
- отдельный dashboard coordinator;
- quick filters по status/SLA;
- auto-create trip checklist при `CONFIRMED`;
- UI для visa/travel/hotel/transfer.

### Фаза 6

Treatment plan polish:

- PDF/export;
- patient accept/decline buttons;
- deposit/payment flow;
- notifications.

### Фаза 7

Tourism module:

- готовые tourism packages;
- custom itinerary;
- add tourism cost to case total.

### Фаза 8

Hardening:

- more strict policies;
- e2e smoke checklist;
- production env cleanup;
- code splitting;
- audit old MedConnect screens.
