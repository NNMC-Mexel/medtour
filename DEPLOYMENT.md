# MedTour Coolify Deployment Guide

## Production services

- Frontend: `https://medtour.nnmc.kz`
- Strapi API: `https://medtourserver.nnmc.kz`
- WebRTC signaling: `https://medtourrtc.nnmc.kz`
- Postgres: Coolify managed database
- MinIO/S3: Coolify managed object storage

## Local ports

- Strapi: `1340`
- Signaling: `1341`
- Frontend dev: `5173`
- Frontend preview: `1342`

## Server service: Strapi

Coolify settings:

- Root directory: `server`
- Port: `1340`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Nixpacks: enabled, `server/nixpacks.toml` installs native build dependencies for `better-sqlite3`.

Required env:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=1340
APP_NAME=MedTour
SERVER_URL=https://medtourserver.nnmc.kz
FRONTEND_URL=https://medtour.nnmc.kz
FRONTEND_URLS=https://medtour.nnmc.kz,https://www.medtour.nnmc.kz

APP_KEYS=generate,unique,comma,separated,keys
API_TOKEN_SALT=generate_unique_value
ADMIN_JWT_SECRET=generate_unique_value
TRANSFER_TOKEN_SALT=generate_unique_value
JWT_SECRET=generate_unique_value
ENCRYPTION_KEY=generate_unique_value

DATABASE_CLIENT=postgres
DATABASE_URL=postgres://user:password@postgres:5432/medtour
DATABASE_SSL=false

MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=medtour
S3_REGION=us-east-1

FREE_CONSULTATIONS=true
PAYMENTS_LIVE=false
```

Notes:

- Local development can keep `DATABASE_CLIENT=sqlite`.
- Production should use Postgres.
- MinIO bucket should stay private. Strapi serves files through `/api/file-proxy/:key`.
- Medical document files are checked against document/case permissions before proxying.

## Frontend service

Recommended Coolify option: static site from `frontend/dist`.

- Root directory: `frontend`
- Build command: `npm ci && npm run build`
- Publish/output directory: `dist`

Env:

```env
VITE_APP_NAME=MedTour
VITE_API_URL=https://medtourserver.nnmc.kz
VITE_SIGNALING_SERVER=https://medtourrtc.nnmc.kz
VITE_PRODUCTION_API_URL=https://medtourserver.nnmc.kz
VITE_PRODUCTION_SIGNALING_URL=https://medtourrtc.nnmc.kz
VITE_PRODUCTION_FRONTEND_HOSTS=medtour.nnmc.kz,www.medtour.nnmc.kz
VITE_FREE_CONSULTATIONS=true
VITE_PAYMENTS_LIVE=false
VITE_EPAY_TEST=true
```

If running as a Node service instead of static hosting (Nixpacks):

- Port: `1342` (`PORT` env)
- `frontend/nixpacks.toml` starts Caddy with `frontend/Caddyfile` when the image
  has Caddy (real 404s, per-page SEO copies by `?lang=`, security headers) and
  falls back to `npx vite preview` otherwise.

`npm run build` = `vite build` + `scripts/prerender-seo.mjs` (per-page heads in
en/ru/kk, `sitemap.xml`; doctors are fetched from `VITE_API_URL` at build time
and skipped if the API is unreachable). The mobile app is built with
`npm run build:app` (no SEO copies).

Optional env: `VITE_SITE_URL` (default `https://medtour.nnmc.kz`),
`VITE_YANDEX_METRIKA_ID`, `VITE_META_PIXEL_ID` (public pages only).

## Signaling service

Coolify settings:

- Root directory: `signaling-server`
- Port: `1341`
- Build command: `npm ci`
- Start command: `npm start`
- WebSocket support: enabled

Env:

```env
NODE_ENV=production
PORT=1341
FRONTEND_URL=https://medtour.nnmc.kz
APP_NAME=MedTour
FREE_CONSULTATIONS=true
PAYMENTS_LIVE=false
EPAY_TEST=true
STRAPI_API_URL=https://medtourserver.nnmc.kz
STRAPI_API_TOKEN=...
REDIS_URL=redis://redis:6379
```

Health check:

```bash
curl https://medtourrtc.nnmc.kz/health
```

For more than one signaling instance, `REDIS_URL` is required. Without it, chat presence and staff queue events are single-instance only.

## Case-first chat release steps

Before enabling chat for existing users:

```bash
cd server
npm run migrate:case-chats:dry
npm run migrate:case-chats
npm run check:chat-permissions
```

Run staging API smoke with role JWTs:

```bash
API_URL=https://medtourserver.nnmc.kz CASE_ID=<case-documentId> PATIENT_JWT=<jwt> MANAGER_JWT=<jwt> npm run smoke:chat-workspace
```

## TURN relay

For cross-network video calls, run coturn on a public server.

Preferred: short-lived credentials issued by Strapi (`GET /api/turn-credentials`,
coturn REST API). coturn `turnserver.conf`:

```conf
use-auth-secret
static-auth-secret=<same value as TURN_STATIC_AUTH_SECRET>
realm=medtour.nnmc.kz
```

Strapi env:

```env
TURN_STATIC_AUTH_SECRET=<long random secret>
TURN_URL=turn:medtour.nnmc.kz:3478
# TURN_URL_TLS=turns:medtour.nnmc.kz:5349?transport=tcp
# TURN_URL_INTERNAL=turn:10.x.x.x:3478
# TURN_CREDENTIAL_TTL_SECONDS=14400
```

Legacy fallback (credentials end up in the JS bundle — remove once the secret
works):

```env
VITE_TURN_URL=turn:medtour.nnmc.kz:3478
VITE_TURN_USERNAME=...
VITE_TURN_CREDENTIAL=...
```

Firewall:

```bash
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp
```

## Выкатка обновления «MedTour ← MedConnect» (ветка `feat/medconnect-parity`)

### До деплоя
1. **Бэкап базы Strapi.** При старте Strapi сам добавит колонки и таблицу:
   `up_users.token_valid_after`, `files.uploaded_by_user_id`,
   `doctors.working_intervals`, `doctors.schedule_config`,
   `appointments.preparation_reminder_24_h_sent_at` / `..._2_h_sent_at`,
   таблицу `analytics_events` (+ индекс `analytics_events_day_idx`).
2. Слить ветку в `main` (или указать ветку в Coolify).

### Порядок
1. **Strapi** — новые эндпоинты (`/api/auth/logout`, `/api/turn-credentials`,
   `/api/doctors/:id/schedule`, `/api/appointments/:id/conclusions/:id`,
   `/api/analytics/*`); права ролей досинхронизируются при старте.
2. **Signaling** — вместе со Strapi: перепроверка сессий, `chat:unread`,
   `epay-confirm` только для пациентов. Нужен Node ≥ 18.
3. **Frontend** — пересборка (`npm run build`, теперь с предрендером SEO).

### Переменные окружения
Обязательных новых нет. По желанию:
- Strapi: `TURN_STATIC_AUTH_SECRET`, `TURN_URL` (+ см. «TURN relay»),
  `APPOINTMENT_CRON_LOOKBACK_DAYS` (7), `ANALYTICS_RETENTION_DAYS` (400).
  `CRON_ENABLED` должен оставаться `true`.
- Frontend: `VITE_SITE_URL`, `VITE_YANDEX_METRIKA_ID`, `VITE_META_PIXEL_ID`.
  После включения TURN-секрета — удалить `VITE_TURN_USERNAME` /
  `VITE_TURN_CREDENTIAL` и пересобрать.

### Что изменится сразу после выкатки
- Пользователей не разлогинит: старые токены действуют до выхода/смены пароля.
- Политика паролей (8+, A/a, цифра, символ) — только для новых паролей.
- Cron за первый проход: «неявка» для пропущенных записей и «завершена» для
  зависших «идёт» — только за последние 7 дней; начнутся напоминания пациентам
  за 24 ч и 2 ч.
- Расписание старых карточек врачей работает по прежним полям до первого
  сохранения в новом конструкторе.
- Уже накопленные дубли уведомлений «Новая запись» и проводок
  `PAYMENT_CAPTURED` сами не удаляются (новые не появляются).

### Проверка после выкатки
- `curl -sI https://medtour.nnmc.kz/nonexistent` → `404` и заголовки
  `Strict-Transport-Security`, `X-Frame-Options` (значит, работает Caddy).
  `200` — сработал запасной `vite preview` (сайт работает, но без SEO-копий и 404)
  либо фронтенд развёрнут как статический сайт Coolify.
- `/robots.txt`, `/sitemap.xml`, `/og-image.jpg` открываются; заголовок
  `/doctors?lang=ru` — «Врачи — MedTour».
- Вход по email и по телефону; выход → старый токен получает 401.
- Пациент: кейс, загрузка документа, вложение в чат с телефона.
- Менеджер: «Расписание» у врача, отпуск, запись пациента.
- Врач: два сохранения заключения → две карточки; удаление своего.
- Видеозвонок с двух устройств, перезагрузка страницы — звонок восстанавливается,
  таймер продолжает.
- Админ → «Аналитика»: визит из инкогнито с `?utm_source=test` виден.
- `GET /api/turn-credentials` с токеном → `200` (если задан секрет), без токена → `401`.
- Поисковики: файлы подтверждения уже в `frontend/public`
  (`googlee3e15205bb36212e.html`, `yandex_e02ed575db9e24bc.html`). После
  выкатки нажать «Подтвердить» в Google Search Console и Яндекс Вебмастере,
  затем добавить `https://medtour.nnmc.kz/sitemap.xml`.
- Яндекс Метрика: во фронтенде `VITE_YANDEX_METRIKA_ID=113573334` (переменная
  сборки — после изменения нужна пересборка). Счётчик грузится только на
  публичных страницах, Вебвизор и карта кликов выключены. Цели в Метрике —
  тип «JavaScript-событие» с идентификаторами `sign_up`, `case_created`,
  `price_request`, `booking_complete`.

## Pre-deploy verification

```bash
cd server
npm run build
```

```bash
cd frontend
npm run build
```

```bash
cd signaling-server
npm start
```

## Post-deploy smoke

- After the first deployment with the bundled international catalog, check Strapi logs for `Price catalog import complete` and confirm the public price list contains the 1,882 imported services. Later deployments must log that the catalog was already imported and must preserve edited or deleted prices.
- `https://medtour.nnmc.kz` loads without console CORS/mixed-content errors.
- `https://medtourserver.nnmc.kz/admin` opens.
- `https://medtourserver.nnmc.kz/api/clinics` returns data.
- `https://medtourrtc.nnmc.kz/health` returns OK.
- Patient can create a medical case and upload a document.
- Unauthenticated request to a medical document `/api/file-proxy/:key` returns 404 (no existence oracle).
- Admin can assign manager/coordinator/clinic/doctor.
- Doctor decision updates case status.
- Patient sees read-only treatment plan.
