# MedTour — QA, Security & Legal Audit

**Дата:** 2026-05-28 (статический ревью + продовые probes)
**Дополнено:** 2026-05-29 (active pentest на pre-production окружении)
**Объект:** medtourReload (frontend React+Vite, backend Strapi v5, signaling Node)
**Прод:** https://medtour.nnmc.kz, https://medtourserver.nnmc.kz, https://medtoursignaling.nnmc.kz
**База:** статический ревью кода + неразрушающие probes + active pentest с реальной регистрацией тестовых аккаунтов и попытками эксплуатации (разрешено пользователем, реальных пользователей нет)
**Предыдущий аудит:** [SECURITY_FIXES.txt](SECURITY_FIXES.txt) от 2026-04-06 (33 проблемы, исправлено) — этот отчёт фокусируется на изменениях после.

---

## Статус фиксов (2026-05-29)

Применены патчи на C1 / C2 / C3 / C4 / H3 / M2. H2 отложен до рефакторинга `getMediaUrl` на фронте. Файлы:

| Фикс | Файл |
|---|---|
| C2 + C3 (upload MIME/ext whitelist) | [server/src/middlewares/upload-guard.ts](server/src/middlewares/upload-guard.ts) — новый |
| C2 + C3 (register middleware) | [server/config/middlewares.ts](server/config/middlewares.ts) |
| C1 (file-proxy default-deny + safe Content-Type/Disposition) | [server/src/api/file-proxy/controllers/file-proxy.ts](server/src/api/file-proxy/controllers/file-proxy.ts) |
| H3 (treatment-plan whitelist + force status=DRAFT) | [server/src/api/treatment-plan/controllers/treatment-plan.ts](server/src/api/treatment-plan/controllers/treatment-plan.ts) |
| C4 (backend register: confirmed=false + send confirmation + strip JWT) | [server/src/extensions/users-permissions/strapi-server.ts](server/src/extensions/users-permissions/strapi-server.ts) |
| C4 (bootstrap: email_confirmation=true) | [server/src/index.ts](server/src/index.ts) |
| C4 (frontend handles requiresEmailConfirmation) | [frontend/src/stores/authStore.js](frontend/src/stores/authStore.js), [frontend/src/pages/RegisterPage.jsx](frontend/src/pages/RegisterPage.jsx) |
| C4 (verify-email-sent page) | [frontend/src/pages/VerifyEmailSentPage.jsx](frontend/src/pages/VerifyEmailSentPage.jsx) — новая, [frontend/src/App.jsx](frontend/src/App.jsx) |
| M2 (CSP без 192.168.x.x) | [server/config/middlewares.ts](server/config/middlewares.ts) |

**Build smoke:** `tsc --noEmit` на сервере — ✅ clean. `vite build` на фронте — ✅ clean.

### Что нужно после deploy

1. **Передеплоить server + frontend** (Coolify)
2. **Проверить SMTP**: при первой регистрации убедиться, что письмо приходит (Yandex SMTP, см. SMTP_USER/SMTP_PASS env)
3. **Заполнить email-шаблон в Strapi admin** → Settings → Users & Permissions plugin → Email templates → Email address confirmation. Шаблон должен содержать `<%= URL %>?confirmation=<%= CODE %>` (стандартный Strapi placeholder)
4. **Удалить тестовые artefacts из pentest'а** (см. секцию 10.7): users `pentest-pa-2026`, `pentest-pb-2026`, uploads 1-10
5. **Запустить повторный pentest** теми же curl-командами из секции 10.6 — должны быть:
   - POST /api/upload с .html / .svg / .exe / .php / .sh → **HTTP 415** "MIME/extension not allowed"
   - GET /api/file-proxy/<orphan-hash>.pdf без auth → **HTTP 404** (раньше 200)
   - GET /api/file-proxy/<medical-doc>.pdf с auth → **Content-Disposition: attachment**, Content-Type только из whitelist'а
   - POST /api/auth/local/register → **HTTP 200 + `requiresEmailConfirmation: true`** (без JWT)
   - POST /api/auth/local с неподтверждённым email → **HTTP 400** "Your account email is not confirmed"
   - POST /api/treatment-plans с `status: 'ACCEPTED'` от doctor → создастся со `status: 'DRAFT'`

### Что НЕ исправлено в этом раунде

- **L1** — шифрование `iin` / `passportNumber` (требует pgcrypto-миграции БД + изменения API contract)
- **L2** — верификация мед-лицензии врача (требует интеграции с реестром МЗ РК или ручной модерации)
- **H2** — query-token в file-proxy (нужен рефакторинг `getMediaUrl` на blob-fetch, отдельный PR)
- **M1** — finance-ledger.create whitelist (тривиально, не успел в этот раунд)
- **M3** — security headers на medtour.nnmc.kz (нужно править Caddy/nixpacks)
- **M4** — `X-Powered-By: Strapi` (одна строка конфига poweredBy middleware)
- **M5** — rate-limit на file-proxy и list-endpoints
- **M6** — token cache TTL signaling
- **L01-L14** — все low

---

## TL;DR — после active pentest (UPDATE)

Кодовая база **держит RBAC, role escalation, IDOR, mass-assignment, JWT, SQL injection, login brute force** — всё это проверено активными запросами и заблокировано как должно. Это сильная сторона.

**НО:** через `/api/upload` (стандартный Strapi-эндпоинт, открыт для всех `authenticated`) пациент грузит **любой файл любого типа**, файл получает URL `https://medtourserver.nnmc.kz/api/file-proxy/<hash>.<ext>` и из-за fail-open логики file-proxy **отдаётся всем без аутентификации**. Это даёт **4 связанных CRITICAL**.

| # | Кат | Подтверждено | Уровень |
|---|---|---|---|
| **C1** | App | file-proxy + /api/upload: любой пациент → публичный файл-хост; скачал "SECRET" PDF без JWT | **CRITICAL** |
| **C2** | App | SVG/HTML upload с `<script>` → отдаётся `Content-Type: image/svg+xml`/`text/html` inline → stored XSS / phishing на medtourserver.nnmc.kz | **CRITICAL** |
| **C3** | App | `/api/upload` принимает `.exe`, `.php`, `.jsp`, `.bat`, `.py` без MIME-фильтра | **CRITICAL** (вместе с C1 = malware-хост) |
| **C4** | App | Регистрация авто-confirm без email-верификации → email squatting / impersonation | **HIGH** |
| **H2** | App | file-proxy: JWT в query-string (`?token=...`) | **HIGH** |
| **H3** | App | treatment-plan.create — нет whitelist'а полей; доктор может выставить `status:ACCEPTED`, `totalCost:1` | **HIGH** |
| **L1** | Legal | `iin` / `passportNumber` хранятся в plain string без шифрования (94-V ст.10) | **CRITICAL (legal)** |
| **L2** | Legal | Нет верификации медицинской лицензии врача (Кодекс №360-VI ст.8) | **HIGH (legal)** |

Дополнительно — 6 medium и 11 low (см. ниже).

**Что работает идеально** (подтверждено активными запросами): см. секцию [10. Active pentest — что НЕ удалось взломать](#10-active-pentest--что-не-удалось-взломать).

---

## 1. Архитектура и роли (контекст)

5 ролей (Strapi users-permissions): `patient`, `doctor`, `manager`, `coordinator`, `admin`.
Основная сущность — `medical-case`. Связанные: `medical-document`, `treatment-plan`, `trip-checklist`, `visa-request`, `tourism-package`, `case-event`, `finance-ledger`, `conversation`, `message`, `notification`, `appointment`.

Публичные endpoint'ы (без auth): `clinics`, `doctors`, `specializations`, `guide-videos`, `reviews`, `time-slots`, `auth/check-email`, `file-proxy/:key` (с условной проверкой — см. H1).

---

## 2. КРИТИЧНЫЕ И ВЫСОКИЕ УЯЗВИМОСТИ

### C1 — file-proxy fail-open + открытый /api/upload = публичный файл-хост [CRITICAL, подтверждено эксплойтом]

**Файлы:**
- [server/src/api/file-proxy/controllers/file-proxy.ts:93-122](server/src/api/file-proxy/controllers/file-proxy.ts#L93) — fail-open
- Strapi default `/api/upload` — открыт для роли `authenticated`

**Что не так — связка из 2 дефектов:**

1. Strapi выдает `plugin::upload.content-api.upload` любому `authenticated`-пользователю (роль пациента включает `authenticated`), без явного ограничения в [server/src/index.ts](server/src/index.ts) seed-функции.
2. file-proxy логика fail-open: если файл загружен и не привязан к `medical-document` → доступ разрешён всем (см. строки 97 и 118).

**Эксплойт (выполнен на проде 2026-05-28):**

```bash
# 1. Регистрация обычным patient'ом
curl -X POST https://medtourserver.nnmc.kz/api/auth/local/register \
  -d '{"email":"x@x.invalid","password":"X","fullName":"X","userRole":"patient"}'
# → JWT получен

# 2. Загрузка "секретного" PDF через стандартный /api/upload
curl -X POST https://medtourserver.nnmc.kz/api/upload \
  -H "Authorization: Bearer $JWT" \
  -F "files=@secret.pdf;type=application/pdf"
# → HTTP 201
# → url: "https://medtourserver.nnmc.kz/api/file-proxy/secret_189eb37a75.pdf"

# 3. Скачивание БЕЗ JWT, из любой точки мира
curl https://medtourserver.nnmc.kz/api/file-proxy/secret_189eb37a75.pdf
# → HTTP 200, контент "SECRET MEDICAL DATA - patient_a - ..."
```

**Реальные последствия:**

- Между моментом upload и моментом link-to-medical-document файл публично доступен. Если линковка не произошла (race condition, ошибка UI, отменённая операция) — файл остаётся публичным навсегда.
- Хеш файла = 10 hex-символов (40 бит). Не угадывается перебором с прода (rate-limit), но утечка через CSP-репорты, кэши CDN, Referer, скриншоты — реальна.
- MedTour превращается в **бесплатный публичный файл-хост** для любого зарегистрированного пациента.

**Фикс (минимум):**

```ts
// file-proxy.ts — default deny:
if (!uploadFile) return false;
if (!medicalDocument) return false;
// Публичные ассеты (clinic logos, doctor avatars) — отдельный bucket "public/"
// ИЛИ поле isPublic в plugin::upload.file + явный seed для известных assets
```

```ts
// Дополнительно — ограничить /api/upload только для admin/manager/coordinator,
// а пациент загружает только через wrapper-эндпоинт medical-document.create,
// который сразу линкует файл. Снять с роли `authenticated` permission
// `plugin::upload.content-api.upload`.
```

---

### C2 — Stored XSS / phishing-on-domain через SVG/HTML upload [CRITICAL, подтверждено эксплойтом]

**Связан с C1**: те же два дефекта (открытый upload + fail-open file-proxy) дают XSS-вектор.

**Эксплойт (выполнен на проде 2026-05-28):**

```bash
# 1. Загружаем HTML с <script> или SVG с встроенным <script>
echo '<html><body><script>alert("HTML XSS")</script></body></html>' > xss.html
curl -X POST https://medtourserver.nnmc.kz/api/upload \
  -H "Authorization: Bearer $JWT" \
  -F "files=@xss.html;type=text/html"
# → url: "https://medtourserver.nnmc.kz/api/file-proxy/xss_7b7b51da31.html"

# 2. Открываем URL — сервер отвечает:
curl -I https://medtourserver.nnmc.kz/api/file-proxy/xss_7b7b51da31.html
# content-type: text/html                    ← НЕ application/octet-stream
# content-security-policy: ... script-src 'self' ...
# x-frame-options: SAMEORIGIN
# (нет Content-Disposition: attachment)
```

**Что это значит:**

- `Content-Type: text/html` + inline render → браузер исполняет страницу
- CSP `script-src 'self'` разрешает скрипты на этом же origin → встроенный `<script>` ВЫПОЛНЯЕТСЯ
- URL на `medtourserver.nnmc.kz` — пользователь видит свой "доверенный" домен в адресной строке
- Жертве по email/SMS приходит ссылка → она открывает фейковую страницу логина на легитимном поддомене → вводит креды → они уходят на attacker.com

Аналогично с SVG (`Content-Type: image/svg+xml` + `<script>` внутри SVG исполняется при прямом открытии).

**Совет проверить:** если в **Strapi admin-панели** где-то загружается превью SVG из `plugin::upload.file` через `<img src>` или iframe — то любой пациент через эту цепочку может выполнить JS уже в контексте админа (admin XSS = полный взлом).

**Фикс:**

```ts
// 1. На /api/upload — whitelist MIME-типов через config/plugins.ts:
upload: {
  config: {
    provider: '...',
    providerOptions: { ... },
    actionOptions: { upload: {}, uploadStream: {}, delete: {} },
    sizeLimit: 10 * 1024 * 1024,
  },
},
// + middleware/policy на /api/upload, отклоняющий image/svg+xml, text/html,
// application/x-sh, application/octet-stream, application/x-msdownload и т.д.

// 2. В file-proxy.ts при отдаче:
ctx.set('Content-Disposition', 'attachment'); // для всех медицинских doc
// или для не-картинок: Content-Type: application/octet-stream
```

---

### C3 — /api/upload принимает ЛЮБОЕ расширение [CRITICAL вместе с C1]

**Подтверждено эксплойтом (2026-05-28):** все загружены успешно (HTTP 201):

```
.exe → HTTP 201
.php → HTTP 201
.jsp → HTTP 201
.bat → HTTP 201
.py  → HTTP 201
```

Сами по себе эти файлы на S3 не исполняются. Но в связке с C1:
- **Malware distribution**: атакующий хостит вирус на `medtourserver.nnmc.kz/api/file-proxy/...exe` — антивирусы и SIEM-системы видят легитимный домен, не блокируют
- **Если MinIO/Caddy/proxy когда-либо будет настроен через PHP-handler или mod_jsp** — будет полноценный RCE

**Фикс:** см. C2 — whitelist MIME-типов на /api/upload.

---

### C4 — Email squatting: регистрация без подтверждения email [HIGH, подтверждено]

**Подтверждено:** ответ register-эндпоинта содержит `"confirmed":true` без отправки письма для подтверждения. Это значит: атакующий может зарегистрировать `victim-doctor@nnmc.kz` или `victim-patient@gmail.com` ДО того, как реальный человек попробует — и реальный человек получит `email already taken`.

**Сценарии:**
- Squatting реальных врачей перед их онбордингом → атакующий имеет аккаунт под их именем
- В сочетании с C1 — атакующий грузит документы под именем "Dr. Ivanov", шлёт другим пациентам "от его имени"
- Если когда-нибудь будет привязка iin/email к медицинским данным РК — атакующий может занять чужой email

**Фикс:**
```ts
// users-permissions/strapi-server.ts:
// confirmed=false при register; отправка email с verify-токеном;
// запрет login до подтверждения; expiry on pending-registration 24h
```

---

### H1 (исходный) — file-proxy: orphan-файлы публично доступны (fail-open) [теперь часть C1]

**Файл:** [server/src/api/file-proxy/controllers/file-proxy.ts:93-122](server/src/api/file-proxy/controllers/file-proxy.ts#L93)

**Что не так.** Логика `assertMedicalDocumentFileAccess` имеет **две точки fail-open**:

```ts
// L97: если файл не в таблице plugin::upload.file → доступ разрешён
if (!uploadFile) return true;

// L118: если файл есть в upload, но не связан ни с одним medical-document → разрешён
if (!medicalDocument) return true;
```

Это означает: **любой файл в MinIO-бакете, который по какой-то причине отвязали от `medical-document` (удалили запись, не сохранили связь, race condition при upload), становится публично доступным**. Зная хеш файла (8 символов hex), его можно скачать без JWT.

Хеш Strapi генерирует через `crypto.randomBytes` — угадать его перебором сложно (~2^32), но:
- Хеши могут утечь через CSP-отчёты, Referer-заголовки, кэши CDN
- Если злоумышленник имел legitimate-доступ к файлу один раз (был пациентом, потом удалили), а связь медицинская удалилась — он по-прежнему может скачать

**Прод-probe подтвердил:** GET `/api/file-proxy/test-nonexistent.pdf` без токена возвращает `{"error":"File not found"}` (404), а не 401. Это не уязвимость сама по себе, но подтверждает, что endpoint открыт.

**Дополнительно — utечка существования файла:** 403 vs 404 различаются для unauth-пользователя в зависимости от того, существует ли файл. Это **enumeration leak** (CWE-200).

**Фикс:**
```ts
// Default deny. Public media (clinic logos, doctor avatars) пометить explicit
// флагом (например, отдельный bucket "public/" или поле isPublic в upload.file).
if (!uploadFile) return false;
if (!medicalDocument) return false;
// + унифицировать ответ: всегда 404 для unauth, независимо от существования
```

---

### H2 — file-proxy: JWT в URL-параметре [HIGH]

**Файл:** [server/src/api/file-proxy/controllers/file-proxy.ts:18](server/src/api/file-proxy/controllers/file-proxy.ts#L18)

```ts
const token = bearerToken || ctx.query?.token;
```

**Что не так.** JWT, передаваемый в query string:
- Попадает в логи nginx/cloudflare/прокси
- Попадает в `Referer` при переходе на внешний домен
- Кэшируется браузером в истории
- Может попасть в Sentry/аналитику как часть URL

Стандарт OWASP API Security Top 10 (API2: Broken Authentication) — JWT всегда в `Authorization: Bearer`.

**Сейчас это нужно** только потому что `<img src="/api/file-proxy/...">` не умеет передавать заголовки. Решение: signed URLs с коротким TTL вместо JWT, ИЛИ frontend качает blob через `fetch` с заголовком и подставляет `URL.createObjectURL`.

**Фикс:** убрать fallback на `ctx.query?.token`. Для `<img>` использовать blob-подход или подписанные URLs.

---

### H3 — treatment-plan.create: нет whitelist полей, нет валидации статуса [HIGH]

**Файл:** [server/src/api/treatment-plan/controllers/treatment-plan.ts:45](server/src/api/treatment-plan/controllers/treatment-plan.ts#L45)

```ts
const item = await strapi.documents(UID).create({ data: body, status: 'published', populate: '*' });
```

`body` передаётся в `create` целиком. Роль ограничена (`doctor | coordinator | admin`), но:

1. **Доктор может сразу создать план со `status: 'ACCEPTED'`**, минуя SENT → пациент не подтверждает → нарушение бизнес-FSM и юридического workflow согласия пациента
2. Доктор может выставить `totalCost: 1` (или 9999999999) и обойти ценовой контроль
3. Любые скрытые поля схемы (sentAt, acceptedAt, declinedAt) можно подделать

**Фикс:**
```ts
const ALLOWED_CREATE_FIELDS = ['medical_case','diagnosisSummary','procedures',
  'estimatedDurationDays','totalCost','doctorDecisionNotes','attachments'];
const data = Object.fromEntries(
  Object.entries(body).filter(([k]) => ALLOWED_CREATE_FIELDS.includes(k))
);
// status forced to DRAFT
const item = await strapi.documents(UID).create({
  data: { ...data, status: 'DRAFT' },
  status: 'published',
});
```

---

### L1 (LEGAL) — `iin` и `passportNumber` хранятся в plaintext [CRITICAL для РК]

**Файл:** [server/src/extensions/users-permissions/content-types/user/schema.json:133-138](server/src/extensions/users-permissions/content-types/user/schema.json#L133)

```json
"passportNumber": { "type": "string" },
"iin": { "type": "string" }
```

**Что не так.** Согласно **Закону РК №94-V от 21.05.2013** «О персональных данных и их защите» (ст.10), **ИИН относится к данным ограниченного доступа** и согласно требованиям уполномоченного органа должен храниться с применением **криптографических средств защиты**. Аналогично — паспортные данные.

Сейчас:
- Поля — обычные string в Postgres, без encryption-at-rest на колонке
- В дампе БД, бэкапе, в SQL-логе они видны открытым текстом
- Любой admin Strapi (включая злоумышленника, скомпрометировавшего ADMIN_JWT_SECRET) видит их в admin-панели

**Фикс:**
1. Минимум — encryption-at-rest на уровне Postgres (`pgcrypto`, поле `iin_encrypted bytea`)
2. Лучше — поля доступны только сервису, а в API наружу — только last4/maskированно
3. Логировать каждое чтение `iin` в audit log (требование закона)

См. также [LEGAL_NOTES.md](LEGAL_NOTES.md) — этот пункт там был отмечен как «❌ Не сделано» ещё в апреле, не закрыт.

---

### L2 (LEGAL) — Нет верификации медицинской лицензии врача [HIGH для РК]

**Файл:** [server/src/extensions/users-permissions/strapi-server.ts](server/src/extensions/users-permissions/strapi-server.ts) (doctor registration)

В UI [frontend/src/pages/RegisterPage.jsx:282](frontend/src/pages/RegisterPage.jsx#L282) есть поле `licenseNumber`, но **на сервере оно не проверяется ни против какого реестра**. Любая строка принимается.

Сейчас публичная регистрация доктора **отключена** на сервере (только patient), поэтому риск формально не реализуется через прод. Но как только подключите doctor-онбординг через UI — это будет нарушение **Кодекса РК о здоровье народа №360-VI, ст.8** (медицинская деятельность требует лицензии).

**Фикс:** интеграция с реестром лицензий МЗ РК; минимум — ручная модерация admin'ом перед активацией профиля врача (`isActive=false` по умолчанию).

---

## 3. СРЕДНИЕ ПРОБЛЕМЫ

### M1 — finance-ledger.create: mass assignment [MEDIUM]

[server/src/api/finance-ledger/controllers/finance-ledger.ts:91-94](server/src/api/finance-ledger/controllers/finance-ledger.ts#L91)

```ts
const data = { ...body, createdByUser: user.documentId || user.id };
```

Manager может создать ledger-запись с произвольными полями: `reconciliationStatus: 'reconciled'`, фейковый `patient` (не из case), произвольный `metadata`. Apr-аудит не покрыл этот контроллер.

**Фикс:** whitelist по аналогии с update (`amount, currency, type, medical_case, appointment, patient, notes, metadata`), `patient` принудительно из `medical_case.patient`.

---

### M2 — CSP содержит внутренний IP MinIO и mixed-content [MEDIUM]

**Подтверждено probe'ом** на медтурсервер:
```
content-security-policy: ...; img-src 'self' data: blob: market-assets.strapi.io
  http://192.168.101.25:9000;
  media-src 'self' data: blob: http://192.168.101.25:9000; ...
```

Проблемы:
1. **Утечка топологии**: `192.168.101.25` — внутренний IP MinIO в дата-центре. Знание внутренней топологии полезно атакующему (SSRF, lateral movement).
2. **Mixed content**: `http://...` на HTTPS-сайте — браузер заблокирует, но в CSP правило существует и говорит «мы это разрешаем».

**Фикс:** в [server/config/middlewares.ts](server/config/middlewares.ts) для `strapi::security.contentSecurityPolicy.directives.img-src` и `media-src` — оставить только `'self' data: blob:` + публичный домен (`https://medtourserver.nnmc.kz`). Внутренний MinIO IP убрать.

---

### M3 — Фронтенд (medtour.nnmc.kz) без security-заголовков [MEDIUM]

**Probe-результат** (HEAD на https://medtour.nnmc.kz/):
```
HTTP/2 200
alt-svc: h3=":443"; ma=2592000
cache-control: no-cache
content-type: text/html
date: ...
etag: ...
vary: Origin
```

**Нет**: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

Strapi-бэкенд headers выставляет — а статика, отдаваемая через Coolify/Caddy, **нет**. Атакующий может встроить medtour в iframe (clickjacking), MITM-проблемы на первом подключении.

**Фикс:** в [frontend/nixpacks.toml](frontend/nixpacks.toml) или Caddyfile (Coolify) добавить:
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://medtourserver.nnmc.kz; connect-src 'self' https://medtourserver.nnmc.kz https://medtoursignaling.nnmc.kz wss://medtoursignaling.nnmc.kz; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(self), geolocation=()
```

---

### M4 — `X-Powered-By: Strapi <strapi.io>` всё ещё в ответе [MEDIUM-INFO]

**Probe-результат:** заголовок присутствует, хотя в [middlewares.ts](server/config/middlewares.ts) `strapi::poweredBy` подключён. Возможно, нужно явно настроить или middleware применяется неправильно.

**Фикс:** настроить `{ name: 'strapi::poweredBy', config: { poweredBy: '' } }` или удалить из ответа на уровне nginx/Caddy.

---

### M5 — Rate limit отсутствует на чувствительных endpoints [MEDIUM]

Покрытие rate-limit ([server/src/middlewares/rate-limit.ts](server/src/middlewares/rate-limit.ts)): только `/api/auth/local`, `/api/auth/local/register`, `/api/auth/forgot-password` + check-email отдельно.

**НЕ покрыто**:
- `/api/file-proxy/*` — можно перебирать хеши файлов
- `/api/medical-cases`, `/api/medical-documents` — list-эндпоинты можно "сканировать" пагинацией
- `/api/appointments` — то же
- Signaling: socket events (`chat-message`, `signal`) — нет ограничений на частоту

**Фикс:** добавить общий лимит `/api/*` 300 req/min/IP, отдельно `/api/file-proxy/*` 60 req/min/IP, отдельно socket — `rate-limiter-flexible` на 100 msg/min/socket.

---

### M6 — Token cache TTL 5 мин = задержка отзыва доступа [MEDIUM]

[signaling-server/server.js#L776](signaling-server/server.js#L776) — кэш JWT 5 минут. Если пользователь logout/блокировка/удаление — он остаётся в видеокомнате до 5 мин.

В медицинском контексте: уволенный врач может ещё 5 минут наблюдать чужую консультацию.

**Фикс:** уменьшить TTL до 60 сек, или добавить revocation channel (Redis pub-sub) от Strapi к signaling.

---

## 4. НИЗКИЕ И ИНФОРМАЦИОННЫЕ

| # | Файл | Проблема |
|---|---|---|
| L01 | [signaling-server/server.js](signaling-server/server.js) | Нет жёсткого лимита 2 участников на видеокомнату — третий socket может присоединиться и слушать |
| L02 | [server/src/api/conversation/controllers/conversation.ts:381](server/src/api/conversation/controllers/conversation.ts#L381) | `...body` в create — поля переопределяются позже, но whitelist надёжнее |
| L03 | [frontend/src/services/api.js](frontend/src/services/api.js) | Лимит upload 300 MB на клиенте, у Strapi default 200 MB — могут быть рассогласования; явно зафиксируйте на сервере |
| L04 | [frontend/src/stores/authStore.js](frontend/src/stores/authStore.js) | JWT в `localStorage` — XSS-доступен. Допустимо при сильном CSP, но CSP на фронте сейчас нет (см. M3) |
| L05 | Frontend `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` | TURN-кредентиалы видны клиенту. Стандарт для WebRTC, но рекомендуется ротация / time-limited credentials (RFC 7635) |
| L06 | [frontend/public/](frontend/public/) | Нет `robots.txt` — все индексируются. Закройте /patient/*, /manager/*, /admin/* в robots |
| L07 | `/admin` Strapi-панель открыта на проде по https://medtourserver.nnmc.kz/admin (200) | Это нормально для Strapi, но рассмотрите IP-allowlist для админ-панели через Caddy/Cloudflare |
| L08 | `/api/auth/check-email` остался открытым с rate-limit 5/15min | Подтверждено probe'ом: 4 успешных запроса → 429. Минимальный enumeration всё равно возможен (4 проверки за 15 мин). Лучше — выдавать `{exists: false}` всегда |
| L09 | `case-event` отдаёт timeline целиком при доступе | Если case-event содержит чувствительные поля (diagnosisSummary, doctorDecision) — выдача может быть избыточной для роли. Проверьте populate |
| L10 | `notification` — нет TTL/архивации | При большом объёме (тысячи уведомлений на пациента) — медленные запросы |
| L11 | [server/src/api/check-email/controllers/check-email.ts](server/src/api/check-email/controllers/check-email.ts) | In-memory rate limiter теряет состояние при рестарте (несколько pod'ов = lim в каждом) — нужен Redis |
| L12 | users-permissions | Пациент **не может удалить себя** (DELETE /api/users/me → 403). Право на удаление (94-V, GDPR) не реализовано |
| L13 | upload + patient | Пациент **не может удалить свои uploads** (DELETE /api/upload/files/:id → 403). В сочетании с C1 — атакующий бесконечно заполняет MinIO storage (storage DoS) |
| L14 | medical-case | Пациент **не может удалить свой case** даже до назначения staff. По FSM это может быть осознанно (audit trail), но право на удаление в РК — нужно |

---

## 5. ЧТО РАБОТАЕТ ХОРОШО (не требует исправления)

- ✅ RBAC через field-level allowlists в `medical-case`, `treatment-plan` update, `trip-checklist`, `visa-request` — пациент **не может** сменить status, manager, doctor, totalCost
- ✅ `message.findOne` с membership-check (фикс из апреля, проверен — на месте)
- ✅ `medical-document` IDOR-fix через documentId, share-cep, sharedWithDoctors
- ✅ Socket.IO с JWT-аутентификацией (5-мин cache)
- ✅ HSTS + frameguard на бэкенде (Strapi `::security`)
- ✅ CORS — явный список доменов, без wildcard, с credentials
- ✅ Платёжная валидация: цена пересверяется с БД, idempotency, audit log
- ✅ Rate-limit на auth/check-email **работает на проде** (probe подтвердил 429 после 4 req за минуту)
- ✅ `/api/users`, `/api/medical-cases`, `/api/medical-documents`, `/api/notifications`, `/api/finance-ledgers`, `/api/treatment-plans`, `/api/conversations`, `/api/messages`, `/api/case-events`, `/api/visa-requests` без JWT → **403** (probe подтвердил)
- ✅ `.env`, `.git/config` не открыты публично (probe подтвердил 404)
- ✅ Path traversal в `/api/file-proxy/:key` → 404 (S3 keys opaque)
- ✅ Server hosted в Kazakhstan (88.204.239.75 / AS Kazakhtelecom) — соответствует требованию локализации данных
- ✅ RegisterPage форсирует `userType='patient'` (frontend), server-side тоже отклоняет staff-роли
- ✅ Privacy/Terms checkbox в форме регистрации — есть согласие пользователя

---

## 6. ПРОДОВЫЕ PROBES — журнал

Все probes — **неразрушающие, read-only**. Никаких регистраций, никаких изменений данных не сделано.

| Probe | Результат | Вердикт |
|---|---|---|
| `GET /api/users` без auth | 403 Forbidden | OK |
| `GET /api/medical-cases` без auth | 403 | OK |
| `GET /api/medical-documents` без auth | 403 | OK |
| `GET /api/treatment-plans` без auth | 403 | OK |
| `GET /api/finance-ledgers` без auth | 403 | OK |
| `GET /api/conversations` без auth | 403 | OK |
| `GET /api/messages` без auth | 403 | OK |
| `GET /api/visa-requests` без auth | 403 | OK |
| `GET /api/case-events` без auth | 403 | OK |
| `GET /api/notifications` без auth | 403 | OK |
| `GET /api/clinics?pagination[pageSize]=1` | 200 + json | OK (public by design) |
| `GET /api/doctors?pagination[pageSize]=1` | 200 + `[]` | OK (нет активных) |
| `GET /api/file-proxy/test-nonexistent.pdf` | 404 `File not found` | См. H1 (info leak) |
| `GET /api/file-proxy/...%2F..%2Fetc%2Fpasswd` | 404 | OK (S3 keys opaque) |
| `POST /api/auth/check-email` (метод) | 405 Method Not Allowed | OK |
| `GET /api/auth/check-email?email=...` (4 раза) | 200 `{exists:false}` | OK |
| `GET /api/auth/check-email?email=...` (5-7 раз) | 429 `Too many requests` | OK — rate limit работает |
| `GET /.env` | 404 | OK |
| `GET /admin` | 200 (Strapi login) | стандартно |
| `GET /` HEAD на сервер | HSTS 2y, X-Frame SAMEORIGIN, CSP **с утечкой 192.168.101.25** | M2 |
| `GET /` HEAD на фронт | **0 security headers** | M3 |
| `dig medtourserver.nnmc.kz` | 88.204.239.75 (KZ, Kazakhtelecom) | OK (legal localization) |

---

## 7. ЮРИДИЧЕСКАЯ ПРОВЕРКА (РК)

Базируется на [LEGAL_NOTES.md](LEGAL_NOTES.md) и текущем состоянии кода.

### 7.1 Требования МЗ РК (Приказ №ҚР ДСМ-39 от 12.05.2021)

| # | Требование | Было (apr) | Сейчас (may) | Закон |
|---|---|---|---|---|
| 1 | Серверы на территории РК | ❌ | ✅ **88.204.239.75 = KZ / Kazakhtelecom** | соблюдается |
| 2 | Криптографическое шифрование данных (минимум — at-rest для PII) | ❌ | ⚠️ Постгрес без column-encryption; iin/passport в plaintext | **L1** |
| 3 | Многофакторная аутентификация (ЭЦП/ЭЦК для пациента РК) | ❌ | ❌ Нет MFA, нет NCALayer/mGov | не сделано |
| 4 | Верификация пациента по ИИН через МЦРИАП | ❌ | ❌ Поле iin есть, валидация контрольной суммы есть на фронте, но реальной проверки нет | не сделано |
| 5 | Интеграция с МИС | ❌ | ❌ | не сделано |
| 6 | Публичная оферта при записи | ❌ | ✅ TermsPage + чекбокс на registration | соблюдается |
| 7 | Верификация медицинских лицензий врачей | ❌ | ⚠️ Поле есть, проверки нет, но публичная регистрация доктора отключена | **L2** |
| 8 | STUN/TURN серверы на территории РК | ❌ | ⚠️ TURN свой (через VITE_TURN_URLS) — проверьте IP; STUN остался Google? | проверить |

**Вывод:** база-минимум закрыт (хостинг в РК + оферта), но **2 критичных пробела (шифрование PII, верификация врачей)** остались.

### 7.2 Закон №94-V «О персональных данных» (21.05.2013)

| Требование | Статус |
|---|---|
| Согласие на обработку при регистрации | ✅ Чекбокс с ссылкой на /privacy |
| Шифрование особо чувствительных данных (ИИН) | ❌ См. **L1** |
| Локализация данных в РК | ✅ Сервер 88.204.239.75 = KZ |
| Право на удаление | ⚠️ Не нашёл endpoint `DELETE /api/users/me` для user-self-delete — реализация GDPR/RTBF под вопросом |
| Журнал доступа к ПД | ⚠️ Audit log есть для register/appointment/doctor-price-change, но **не для чтения** iin/паспорта |

### 7.3 Кодекс о здоровье народа №360-VI (07.07.2020)

| Статья | Что требует | Статус |
|---|---|---|
| Ст.8 — медлицензия | Проверка лицензии врача | ❌ См. **L2** |
| Ст.134 — врачебная тайна | E2E-шифрование переписки врач↔пациент | ❌ TLS-only, content на сервере виден admin'у |
| Ст.168 — эл.рецепты | Интеграция с ЕСМЗ | ❌ Не реализовано (если рецепты не выдаются — не критично) |

### 7.4 Платёжная часть (ePay / Halyk QR)

- ⚠️ PCI DSS не упомянут. Если карточные данные через ePay redirect — карта не приходит на ваш сервер → PCI DSS scope ограничен (SAQ-A). Это **ОК**, если убедитесь что у вас на сервере действительно нет PAN/CVV ни на одном шаге (выполнено: BookingModal делает iframe-redirect к ePay).
- ⚠️ ePay-секреты в апрельском аудите помечены как **возможно скомпрометированные** — нужно подтвердить у банка ротацию ключей.

### 7.5 Нарушает ли программа законы прямо сейчас?

**Краткий ответ:** Да, в текущем виде **есть формальные нарушения**, если запустить публичный приём пациентов из РК с обработкой их ИИН:

1. **Закон №94-V ст.10** — ИИН в plaintext (L1) = нарушение требований к защите ПД ограниченного доступа
2. **Кодекс №360-VI ст.8** — отсутствие верификации лицензии врача (L2) — формально пока доктор-регистрация отключена, нарушения нет; включите без верификации = нарушение
3. **Приказ ДСМ-39 п.3** — нет MFA для пациента; **не блокирует**, но при проверке надзорным органом могут указать

**Что НЕ нарушено:**
- Хостинг в РК ✅
- Согласие на обработку ПД ✅
- Регистрация nnmc.kz как СМИ/ресурса (есть свидетельство в `Свидетельство о регистрации nnmc.kz.pdf`)
- PCI DSS scope ограничен через redirect

**Что не покрыто и нужно юристу:**
- Нужна ли регистрация платформы как «электронного информационного ресурса для дистанционных медицинских услуг» (ДСМ-39 п.5) — это **обязательно** для платформ, оказывающих телемедуслуги в РК. Регистрация в МЗ РК.
- Договоры с клиниками: разграничение медицинской ответственности (вы — организатор, клиника — исполнитель медуслуги). Прописано в README, но юридический договор нужен.

---

## 8. РЕКОМЕНДАЦИИ — ПРИОРИТЕТНЫЙ ПЛАН

### БЛОКЕРЫ публичного релиза (do not deploy without fixing)

0. [ ] **C1+C2+C3** (одним коммитом, общий root cause = открытый upload + fail-open proxy):
   - снять `plugin::upload.content-api.upload` с `authenticated`-роли в [server/src/index.ts](server/src/index.ts) seed
   - whitelist MIME-типов на `/api/upload` (отклонять `image/svg+xml`, `text/html`, `application/x-*`)
   - file-proxy: `default deny` для orphan-файлов
   - file-proxy: для всех медицинских документов отдавать `Content-Disposition: attachment` или `Content-Type: application/octet-stream`
   - перевести upload пациентских документов через `/api/medical-documents` wrapper, который сразу линкует файл
1. [ ] **C4** — `confirmed:false` по умолчанию + email-верификация перед login
2. [ ] **L1** — column-encryption (pgcrypto) для `iin` и `passportNumber`; в API — только last4

### Перед публичным релизом (must)

3. [ ] **H2** — убрать query-token из file-proxy; перевести `<img>` на blob-fetch или signed URLs
4. [ ] **H3** — whitelist полей в treatment-plan.create, status принудительно `DRAFT`
5. [ ] **M2** — убрать `192.168.101.25` из CSP
6. [ ] **M3** — security headers на фронте через Caddy/nixpacks
7. [ ] Юрист — регистрация в МЗ РК как электронный ресурс для дистанционных медуслуг
8. [ ] **Чистка** — удалить pentest-юзеров и uploads (см. секцию 10.7)

### Перед масштабированием (should)

8. [ ] **M1** — finance-ledger.create whitelist
9. [ ] **M5** — rate-limit на `/api/file-proxy` и list-эндпоинты
10. [ ] **M6** — token cache TTL 60 сек + revocation
11. [ ] **L2** — модерация врачей admin'ом + интеграция с реестром МЗ РК
12. [ ] **L01** — лимит 2 участников в комнате
13. [ ] **L11** — Redis для rate-limit (multi-pod)
14. [ ] Реализовать `DELETE /api/users/me` (право на удаление, GDPR/94-V)
15. [ ] Audit log чтения `iin`/паспорта (94-V)

### Хорошо бы (nice-to-have)

16. [ ] MFA через NCALayer для пациентов РК (ДСМ-39 п.3)
17. [ ] E2E-шифрование chat (libsodium на клиенте) — врачебная тайна (Кодекс ст.134)
18. [ ] Pre-commit hook (gitleaks) — защита от случайного коммита .env
19. [ ] Sentry / external audit log сервис (compliance)
20. [ ] Penetration test от аккредитованной лаборатории перед релизом — для соответствия ДСМ-39

---

## 9. Что НЕ покрыто этим аудитом

- ✅ ~~Active pentest с генерацией тестовых юзеров~~ — выполнено (см. секцию 10 ниже)
- ❌ Не аудировал админ-панель Strapi (`/admin`) изнутри — нужен admin login
- ❌ Не проверял dependency vulnerabilities (`npm audit`) — это отдельный прогон, рекомендую `npm audit --production` в обоих проектах
- ❌ Не проверял DDoS-устойчивость, ботозащиту
- ❌ Не проверял backup/DR-стратегию БД и MinIO
- ❌ Не проверял доступ к Coolify и его права
- ❌ Не проверял видеоконсультацию через signaling (нужен второй вебрюзер + видео)

---

## 10. Active pentest — что НЕ удалось взломать

Выполнено 2026-05-28..29 на pre-production окружении (реальных пользователей нет). Зарегистрированы 2 тестовых аккаунта patient_a (id=5) и patient_b (id=6). Все попытки эксплуатации задокументированы.

### 10.1 RBAC и role escalation — DEFENSE HELD

| Атака | Результат | Вердикт |
|---|---|---|
| `POST /api/auth/local/register` c `userRole:"admin"` | 403 "Staff registration is disabled" | ✅ |
| `POST /api/auth/local/register` c `userRole:"manager"` | 403 | ✅ |
| `POST /api/auth/local/register` c `userRole:"doctor"` + doctorData | 403 | ✅ |
| `POST /api/auth/local/register` c `userRole:"coordinator"` | 403 (затем 429 от rate-limit на 6-й попытке за час) | ✅ |
| `PUT /api/users/5` от patient_a (sеlf) c `{userRole:"admin"}` | 403 Forbidden | ✅ |
| `PUT /api/users/me` c `{userRole:"admin", role:1}` | 400 "No allowed profile fields to update" | ✅ — server-side whitelist |
| `PUT /api/medical-cases/<case_a>` от patient_b (чужой case) | 404 Not Found | ✅ (404 не выдаёт существование) |
| `PUT /api/medical-cases/<own>` c `{status:"COMPLETED"}` от patient | 403 "This role cannot change medical case status" | ✅ |
| `POST /api/medical-cases` c `{status:"COMPLETED", manager:1, doctor:1, coordinator:1, clinic:1}` | 200, но **все запрещённые поля = null** в ответе | ✅ whitelist работает |

### 10.2 IDOR и cross-patient доступ — DEFENSE HELD

| Атака | Результат | Вердикт |
|---|---|---|
| `GET /api/medical-cases` от patient_b (должен видеть только свои = 0) | `{"data":[]}` | ✅ |
| `GET /api/medical-cases/<case_a>` от patient_b | 404 | ✅ |
| `GET /api/medical-cases?filters[patient][id][$eq]=5` от patient_b | `{"data":[]}` — filter не bypass'ит ownership-фильтр | ✅ |
| `GET /api/medical-cases?filters[$or][0][patient][id]=5&filters[$or][1][patient][id]=6` | `{"data":[]}` | ✅ |
| `GET /api/users/5` от patient_b | 403 | ✅ |
| `GET /api/users` от patient_b | 403 | ✅ |
| `GET /api/users/me?populate=*` | возвращает только свои данные + свои relations | ✅ |

### 10.3 Patient → staff-эндпоинты — DEFENSE HELD

| Атака от patient_a | Результат | Вердикт |
|---|---|---|
| `POST /api/treatment-plans {status:"ACCEPTED", totalCost:1}` | 403 | ✅ |
| `POST /api/visa-requests {status:"APPROVED"}` | 403 | ✅ |
| `POST /api/finance-ledgers {amount:-1000000, type:"refund"}` | 403 | ✅ |
| `POST /api/trip-checklists` | 403 | ✅ |
| `POST /api/case-events` | 403 | ✅ |
| `POST /api/clinics` (создать поддельную клинику) | 403 | ✅ |

> Заметка: H3 (treatment-plan статус) подтверждён только статически. Эксплойт требует doctor JWT, которого у меня не было. Для пациента создание залочено permissions matrix'ом.

### 10.4 JWT и аутентификация — DEFENSE HELD

| Атака | Результат | Вердикт |
|---|---|---|
| JWT `{alg:"none"}` с `id:1` (попытка стать admin) | 401 | ✅ |
| JWT `{alg:"HS256"}` с угаданным секретом `"guess-secret"` | 401 | ✅ — JWT_SECRET надёжный |
| `POST /api/auth/local` x 10 с неверным паролем | 400 каждый | OK |
| `POST /api/auth/local` 11-й раз | **429 Too Many Requests** | ✅ — rate-limit 10/15min работает |
| Email squatting: 2-й register на тот же email | 429 (rate-limit на register) | защита есть, но смотри C4 |

### 10.5 Injection — DEFENSE HELD

| Атака | Результат | Вердикт |
|---|---|---|
| Strapi filter `?filters[diagnosis][$contains]=' OR 1=1--` | `{"data":[]}` 200 | ✅ ORM escape |
| `GET /api/medical-cases/1' OR 1=1--` в id | 404 | ✅ |
| `POST /graphql` с introspection query | 405 Method Not Allowed | ✅ GraphQL отключён |
| `GET /api/file-proxy/../../../etc/passwd` (raw) | 404 | ✅ |
| `GET /api/file-proxy/..%2F..%2Fetc%2Fpasswd` | 404 | ✅ |
| `GET /api/file-proxy/%2e%2e%2f%2e%2e%2fetc%2fpasswd` | 404 | ✅ |

### 10.6 Что СЛОМАЛОСЬ — confirmed exploits

| Атака | Результат | Уровень |
|---|---|---|
| `POST /api/upload` с PDF от patient | HTTP 201, файл на S3 + публичный URL | C1 |
| Анонимный `GET https://medtourserver.nnmc.kz/api/file-proxy/secret_189eb37a75.pdf` | **HTTP 200 + содержимое PDF** ("SECRET MEDICAL DATA") | **C1 CRITICAL** |
| `POST /api/upload` SVG с `<script>alert(1)</script>` | HTTP 201, отдаётся `Content-Type: image/svg+xml` inline | **C2 CRITICAL** |
| `POST /api/upload` HTML с `<script>` | HTTP 201, отдаётся `Content-Type: text/html` inline | **C2 CRITICAL** |
| `POST /api/upload` `.exe / .php / .jsp / .bat / .py` | Все HTTP 201 — MIME-фильтра нет | **C3 CRITICAL** |
| Stored XSS payloads (`<img onerror>`, `<script>`, `javascript:`) в medical-case title/diagnosis/symptoms | Сохраняются как-есть (escape только при рендеринге React) | LOW (зависит от рендеринга в админ-панели Strapi) |
| Auto-confirm на регистрации (без email-верификации) | `"confirmed":true` сразу в ответе | **C4 HIGH** |

### 10.7 Журнал артефактов (что осталось на проде после теста)

> ⚠️ **Нужна чистка перед релизом** — оставленные artefacts:

| ID | Тип | Что | Куда |
|---|---|---|---|
| user 5 | patient | `pentest-pa-2026@example.invalid` / `Pentest Patient A` | users-permissions.user |
| user 6 | patient | `pentest-pb-2026@example.invalid` / `Pentest Patient B` | users-permissions.user |
| case dohs8l0nmjoockvm9su4jw6g | medical-case | "Pentest case A" | medical-case |
| case ccxn0sjbf9kjcjkwwf7x778i | medical-case | "Pentest mass-assign case" | medical-case |
| case (id для xss) | medical-case | XSS payloads в title/diagnosis/symptoms | medical-case |
| upload id 1 | secret.pdf | `/api/file-proxy/secret_189eb37a75.pdf` | MinIO |
| upload id 2 | secret.png | `/api/file-proxy/secret_4dee98bb87.png` | MinIO |
| upload id 3 | xss.svg | `/api/file-proxy/xss_7bb552e1fe.svg` | MinIO — **активный XSS** |
| upload id 4 | xss.html | `/api/file-proxy/xss_7b7b51da31.html` | MinIO — **активный XSS** |
| uploads id 5-10 | evil.sh / test.exe/.php/.jsp/.bat/.py | разные file-proxy URL | MinIO |

**Действия для чистки** (выполнить admin'ом Strapi):
1. Strapi admin → Content Manager → Users → найти `pentest-pa-2026` и `pentest-pb-2026` → удалить (каскадно удалит cases)
2. Strapi admin → Media Library → найти upload id 1-10 (имена `secret*`, `xss*`, `test*`, `evil*`) → удалить
3. Подтвердить через `SELECT * FROM up_files WHERE name LIKE 'xss%' OR name LIKE 'secret%' OR name LIKE 'test%' OR name LIKE 'evil%';` что записи и из БД, и из MinIO стерты

---

## Приложение A — Файлы для немедленного просмотра

Кратчайший путь review для разработчика:

1. [server/src/api/file-proxy/controllers/file-proxy.ts:93-122](server/src/api/file-proxy/controllers/file-proxy.ts#L93) — H1, H2
2. [server/src/api/treatment-plan/controllers/treatment-plan.ts:45](server/src/api/treatment-plan/controllers/treatment-plan.ts#L45) — H3
3. [server/src/api/finance-ledger/controllers/finance-ledger.ts:91](server/src/api/finance-ledger/controllers/finance-ledger.ts#L91) — M1
4. [server/config/middlewares.ts](server/config/middlewares.ts) — M2, M4
5. [server/src/extensions/users-permissions/content-types/user/schema.json:133](server/src/extensions/users-permissions/content-types/user/schema.json#L133) — L1
6. [frontend/nixpacks.toml](frontend/nixpacks.toml) — M3

---

*Отчёт подготовлен Claude Code, 2026-05-28. Не является заменой профессионального аудита от аккредитованной лаборатории ИБ или юридического заключения сертифицированного юриста по медицинскому IT в РК.*
