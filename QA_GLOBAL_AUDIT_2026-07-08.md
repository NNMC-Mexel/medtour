# MedTour Global QA Audit

Дата: 2026-07-08  
Объект: локальная среда `frontend` + `server` в `medtourReload`  
Роли: patient, doctor, manager, admin; coordinator проверен по коду, без отдельного UI-login прохода.

## Объем проверки

- Статический аудит frontend/backend по ролям и workflow.
- API smoke по локальному Strapi на `http://localhost:1340`.
- Frontend build/i18n/lint checks.
- Сравнение фактического поведения с `README.md`, `ROLES_FOR_TESTERS.md`, `QA_SMOKE_CHECKLIST.md`, `MEDTOUR_PRODUCT_BACKLOG.md`.

Ограничение: встроенный browser automation tool дважды упал на уровне окружения (`sandboxPolicy` meta), поэтому визуальный QA выполнен по коду, API и предоставленным скриншотам. Frontend dev server был поднят на `http://127.0.0.1:5174/`; порт `5173` в этой среде занят Strapi dev-процессом и отвечает `426 Upgrade Required`.

## Автоматические проверки

| Проверка | Результат | Комментарий |
|---|---:|---|
| `frontend npm run build` | PASS | Есть warning по большому main chunk `1,419 KB`. |
| `frontend npm run i18n:check` | PASS | `en`, `kk`, `ru` синхронизированы. |
| `server npx tsc --noEmit` | PASS | TypeScript clean. |
| `frontend npm run lint` | FAIL | Lint сканирует generated Android/iOS bundles; дополнительно в `src` есть 3 errors и 36 warnings. |
| `frontend npx eslint src` | FAIL | 3 реальные ошибки: unused `price`, unused `formatPrice`, unused `parts`; 36 hook warnings. |

## API role smoke

Проверенный case: `MT-20260708-N55R8K` / `pao1buwhox8729tqmapdtpzp`.

| Сценарий | Результат |
|---|---|
| Patient читает свой case | PASS, 200 |
| Другой patient читает чужой case | PASS, 403 |
| Назначенный doctor читает case | PASS по доступу, но FAIL по privacy |
| Чужой doctor читает case | PASS, 404 |
| Manager читает свой case | PASS, 200 |
| Admin читает case | PASS, 200 |
| Public register с `userRole=admin` | PASS, 403 |
| Case list по ролям | PASS, IDOR не найден; API не вернул дубли `documentId` |

## P0 - Blocking Before Production

1. Doctor видит лишние персональные и бизнес-данные пациента.

Факты:
- `GET /api/medical-cases/:id?populate=*` для назначенного doctor вернул `patient.email`, `patient.phone`, `preferredContact`, `budgetRange`, `leadSource`, `leadCampaign`, `visaSupportNeeded`, `tourismRequested`.
- Backend `DEFAULT_POPULATE` всегда подтягивает patient email/phone и travel/logistics entities.
- `redactCaseForRole()` для doctor скрывает только `clinic`, но не PII/logistics/business fields.
- Frontend case detail для doctor использует общий блок patient request и выводит email, phone, budget, lead source, visa, tourism.

Риск: нарушение принципа least privilege и медицинской приватности. Doctor должен видеть только медицински необходимые данные: ФИО/возраст или идентификатор пациента, диагноз, симптомы, текущую терапию, документы, язык консультации, timezone/время, notes/decision/treatment plan. Логистика, источник лида, бюджет, менеджерские заметки, visa/tourism не должны уходить врачу ни через UI, ни через API.

Рекомендация:
- Сделать role-based DTO/serializer для `medical-case`: `caseForPatient`, `caseForDoctor`, `caseForManager`, `caseForAdmin`.
- Для doctor исключить `email`, `phone`, `preferredContact`, `budgetRange`, `leadSource/*`, `visaSupportNeeded`, `tourismRequested`, `tourismNotes`, `internalNotes`, `trip_checklist`, `visa_requests`, `tourism_packages`, finance.
- На frontend разделить `DoctorCaseDetail` и `StaffCaseDetail` или хотя бы role-based sections.

2. Appointment detail тоже потенциально показывает doctor email/phone пациента.

Факты:
- В UI есть условие `isDoctor ? appointment.patient.phone/email : appointment.doctor.phone/email`.
- Сейчас backend `appointment.findOne` возвращает patient только `id/fullName`, но frontend API-запрос явно запрашивает patient email/phone. Это хрупкий контракт: если backend populate расширится, UI сразу покажет контакты врачу.

Рекомендация:
- Убрать doctor-side contact rows полностью или заменить на masked contact через менеджера.
- Зафиксировать backend allowlist для appointment detail по ролям.

3. MedicalCase detail смешивает медицинский, CRM и travel workflow в одном экране.

Факты:
- Один общий `MedicalCaseDetail.jsx` обслуживает patient, doctor, manager, coordinator, admin.
- Doctor получает секции patient request, documents, doctor decision, treatment plan, assignments, logistics summary, activity.
- Manager/admin получают doctor decision controls, treatment plan, documents, finance, logistics, assignments на той же странице.

Риск: экран трудно контролировать по правам, UI выглядит "сырым", роли видят чужой контекст, любое новое поле может утечь не той роли.

Рекомендация:
- Разбить на role workspaces:
  - Doctor: medical summary, documents, decision, treatment plan, appointments.
  - Manager: CRM, communication, logistics, payment/ledger, assignments.
  - Patient: next step, documents, plan/trip read-only, chat.
  - Admin: system management and overrides.

4. Case workflow расхождение backend/frontend.

Факты:
- Backend transitions разрешают `WAITING_FOR_DOCUMENTS -> DOCTOR_ASSIGNED` и `DOCUMENTS_UPLOADED -> DOCTOR_ASSIGNED`.
- Frontend mirror в `medicalCaseWorkflow.js` этих переходов не содержит.

Риск: UI может скрыть допустимое действие или показать некорректный маршрут после backend change.

Рекомендация:
- Генерировать frontend workflow из server spec или держать один shared JSON contract.
- Добавить parity test для workflow constants.

## P1 - High UX/Product Issues

5. Нет устойчивого "Сохранено" для большинства save actions.

Факты:
- `AppointmentDetail` уже имеет временные `diagnosisSaved/planSaved/prescriptionsSaved`.
- `MedicalCaseDetail` main save, treatment plan save и logistics save используют только toast.
- `AdminDoctors` после сохранения закрывает modal и перезагружает список без success toast/inline state.
- `AdminUsers` create/edit делает close/update без success feedback.

Рекомендация:
- Единый компонент `SaveButton`: `idle -> saving -> saved -> dirty`.
- Показывать `Сохранено` на кнопке 1.5-2 сек и "Есть несохраненные изменения" при dirty form.
- Для длинных форм подсвечивать сохраненную секцию, а не только global toast.

6. Manager dashboard card actions слишком "мгновенные" и без подтверждения результата.

Факты:
- `CaseCard` меняет статус и назначает врача через `<select value="">`.
- После выбора нет явной локальной истории действия, undo, confirmation state.
- `Claim` можно нажать даже если case уже assigned; кнопка показывает имя, но остается action.

Рекомендация:
- Разделить display и action: assigned staff как текст/chip, claim только если unassigned.
- Для status/doctor use dropdown menu + confirm/save state.
- Добавить optimistic update rollback indicator и activity event preview.

7. Treatment plan позволяет staff выставлять `ACCEPTED`.

Факты:
- UI options включают `DRAFT`, `SENT`, `ACCEPTED`, `DECLINED`, `EXPIRED`.
- По бизнес-логике `ACCEPTED/DECLINED` должен быть решением patient, не doctor/coordinator.

Рекомендация:
- Для doctor/coordinator/admin оставить `DRAFT`, `SENT`, `EXPIRED/REVOKED`.
- `ACCEPTED/DECLINED` только patient action.
- На backend оставить whitelist, не доверять UI.

8. Patient documents все еще appointment-folder first, а не case-first.

Факты:
- `PatientDocuments` группирует документы по appointment и "Мои загрузки".
- Upload metadata поддерживает `medicalCaseId`, но standalone patient documents page не выбирает case.

Риск: для MedTour case-first пациент ожидает документы по заявке, а не по консультациям.

Рекомендация:
- Основная навигация: Case documents by active case.
- Appointment folders оставить как secondary grouping внутри case.
- Upload должен требовать medical case, если case существует.

9. Patient plan-trip выбирает первый open case автоматически.

Факты:
- `PatientPlanTrip` берет первый не terminal case, без selector.

Риск: при нескольких активных кейсах пациент может видеть не тот план/логистику.

Рекомендация:
- Добавить case selector в `plan-trip`.
- Переходы из case detail должны открывать `/patient/plan-trip?case=<documentId>`.

10. Direct file links в appointment documents.

Факты:
- `AppointmentDetail` открывает file через `<a href={getMediaUrl(doc.file)} target="_blank">`.
- В `PatientDocuments` уже используется authenticated blob fetch для preview.

Риск: private file-proxy может не открываться без auth header; query token подход уже отмечен как high risk в старом audit.

Рекомендация:
- Везде использовать `openMediaInNewTab()` / authenticated blob fetch.
- Запретить прямые `href` на private medical documents.

11. Lint gate нерабочий.

Факты:
- `npm run lint` проверяет `android/app/src/main/assets/public` и `ios/App/App/public`, из-за этого сотни ошибок в generated bundle.
- `src` имеет 3 errors и 36 warnings.

Рекомендация:
- В `eslint.config.js` игнорировать `android/**`, `ios/**`, `dist/**`.
- Исправить 3 src errors.
- Hook warnings вынести в P1 quality task.

12. Main JS chunk слишком большой.

Факт: Vite build warning: `index` chunk 1.4 MB minified / 385 KB gzip.

Рекомендация:
- Lazy-load heavy public pages/components.
- Manual chunks for `react`, `i18n`, `socket/video`, admin modules.

## P2 - Polish / UI Consistency

13. Page title "Страница" на screenshot выглядит как placeholder.

Рекомендация: header title должен отражать текущий раздел: "Медицинские заявки", "Детали заявки", "Рабочий стол менеджера".

14. Mixed terminology: заявка / case / appointment / консультация.

Рекомендация:
- Product glossary: "Медицинская заявка" as main object.
- Appointment = "Консультация".
- Treatment plan = "План лечения".
- Trip checklist = "Поездка".

15. Status/SLA chips не объясняют next action.

Рекомендация:
- Для каждой роли показывать "Следующее действие" вместо только статуса.
- Например doctor: "Ожидается заключение врача"; manager: "Назначьте слот"; patient: "Выберите время консультации".

16. Empty states слишком общие.

Рекомендация: заменить "Активности пока нет" на role-specific empty states и CTA.

17. Admin doctors save flow закрывает modal без success feedback.

Рекомендация: после сохранения показать row highlight `updated`, toast success, и сохранить scroll/filters.

18. Manager/coordinator distinction не очевиден.

Факт: coordinator route использует `StaffDashboard`, но role text отличается минимально.

Рекомендация: разные queues/permissions на UI уровне: coordinator = medical review, manager = logistics/communication.

## Рекомендация архитектора

1. Ввести API DTO слой по ролям. Не возвращать `populate=*` в role dashboards.
2. Убрать общий all-in-one detail для всех ролей. Собирать страницы из role-specific panels.
3. Сделать single source of truth для workflow constants.
4. Добавить e2e smoke на 4 роли:
   - patient creates case/uploads doc/books consultation/accepts plan;
   - manager claims/assigns doctor/updates logistics;
   - doctor sees only medical scope/creates decision;
   - admin creates doctor/user/specialization and audits case.
5. Ввести UI quality gate: no placeholder titles, all save actions have saved state, no direct private file links, no role-overexposure.

## Быстрый P0/P1 план исправлений

1. Backend: implement `redactCaseForRole()` properly for doctor/patient and stop exposing logistics/contact/business fields.
2. Frontend: hide doctor-only unnecessary fields in `MedicalCaseDetail` and `AppointmentDetail`.
3. Frontend: add saved/dirty states to case management, treatment plan, logistics, admin doctors/users.
4. Workflow: fix frontend/server transition parity and add test.
5. Lint: ignore generated mobile bundles and fix 3 `src` errors.
6. Documents: migrate appointment direct links to authenticated blob helper.
