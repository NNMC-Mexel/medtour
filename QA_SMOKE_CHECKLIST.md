# MedTour QA Smoke Checklist

Минимальный smoke/UAT набор для Фазы 5 перед staging или production deploy.

## 1. Роли и доступы

- Public registration: `/register` создает только `patient`.
- Negative check: прямой POST `/api/auth/local/register` с `userRole=doctor`, `manager`, `coordinator` или `admin` возвращает 403.
- Patient видит только свои `/patient/cases` и не может назначить manager/coordinator/doctor/clinic/status через update case.
- Doctor видит только cases, где он назначен как doctor.
- Manager видит только cases, где он назначен как manager.
- Coordinator видит только cases, где он назначен как coordinator.
- Admin видит все cases и может назначать manager/coordinator/clinic/doctor.

## 2. Приватность документов

- Patient загружает документ в свой medical case и видит его в карточке case.
- Другой patient не видит этот document через `/api/medical-documents` и не может открыть его напрямую через `/api/medical-documents/:id`.
- Doctor видит документы только назначенного case или документы, расшаренные ему пациентом.
- Manager/coordinator видят документы только в назначенных им cases.
- MinIO/S3 object по `/api/file-proxy/:key` для medical document без JWT возвращает 403.
- MinIO/S3 object по `/api/file-proxy/:key` с JWT пользователя без доступа к document возвращает 403.
- Public media, не привязанная к `medical-document` (например фото врача), остается доступной.

## 3. Полный flow заявки

1. Patient регистрируется и открывает `/patient/cases`.
2. Patient создает medical case.
3. Patient загружает medical documents в case.
4. Admin назначает manager, coordinator, clinic и doctor.
5. Manager/coordinator открывает назначенный case и меняет operational fields.
6. Doctor открывает `/doctor/cases/:id` и принимает decision:
   - `treatment_required` -> case status `PLAN_FORMING`;
   - `needs_more_documents` -> case status `DOCS_PENDING`;
   - `no_treatment_needed` -> case status `NO_TREATMENT_NEEDED`.
7. Doctor/coordinator/admin создает или обновляет treatment plan.
8. Patient видит treatment plan read-only.
9. Case events отражают doctor decision и key updates.

## 4. SQLite local

```bash
cd server
DATABASE_CLIENT=sqlite DATABASE_FILENAME=.tmp/data.db npm run build
DATABASE_CLIENT=sqlite DATABASE_FILENAME=.tmp/data.db npm run develop
```

Ожидаемо:

- Strapi стартует на `http://localhost:1340`.
- Auto-seed ролей, permissions и клиник проходит без ошибок.
- `frontend` с `VITE_API_URL=http://localhost:1340` открывает patient flow.

## 5. Postgres deploy

```bash
cd server
DATABASE_CLIENT=postgres DATABASE_URL=postgres://user:password@host:5432/medtour npm run build
```

Ожидаемо:

- Build проходит без SQLite-only ошибок.
- На первом запуске production Strapi создает таблицы и выполняет bootstrap ролей/permissions.
- `DATABASE_SSL=true` включается только если Postgres требует SSL.

## 6. MinIO/S3 uploads

Server env:

```env
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=medtour
SERVER_URL=https://medtourserver.nnmc.kz
```

Ожидаемо:

- Upload через Strapi возвращает media `url` вида `https://medtourserver.nnmc.kz/api/file-proxy/<key>`.
- Bucket не должен быть public.
- Medical document files открываются только пользователям с доступом к связанному document/case.

## 7. Coolify release check

- Frontend: `https://medtour.nnmc.kz`.
- Strapi API: `https://medtourserver.nnmc.kz`.
- Signaling: `https://medtourrtc.nnmc.kz`.
- Frontend env указывает на production API/signaling.
- Strapi env содержит production secrets, Postgres и MinIO.
- CORS разрешает только `FRONTEND_URLS`.
- WebSocket включен для signaling service.
- После deploy проверить:
  - `/admin` открывается;
  - `/api/clinics` отвечает;
  - `/health` signaling отвечает;
  - patient case flow проходит end to end;
  - browser console без CORS и mixed-content ошибок.

## 8. Case-first chat and manager workspace

- Patient видит fixed bottom-right chat widget на `/patient/*`.
- Widget отсутствует на видеоконсультации `/consultation/:roomId`.
- Если manager online, patient видит `Manager online`.
- Если manager offline, patient видит `We will reply later`.
- Patient отправляет текстовое сообщение, файл и изображение.
- Manager видит case chat в shared inbox на `/manager`.
- Unread counter увеличивается у manager после patient message.
- Manager нажимает `Take over`, событие появляется в timeline/case events.
- Typing indicator виден второй стороне.
- Read receipt появляется после открытия чата получателем.
- Обновление страницы сохраняет историю сообщений.
- Другой patient не может открыть conversation напрямую.
- Doctor не видит case chat, если `doctorChatEnabled=false`.
- `npm run check:chat-permissions` проходит в server.
- `npm run smoke:chat-workspace` проходит на staging с JWT ролей.
