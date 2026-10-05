# MedTour — Global QA Audit

Дата: 2026-07-29
Объём: `frontend` + `server` + `signaling-server`, ветка `main`
Роли: patient, doctor, manager, coordinator, admin

## Метод и ограничения

- Живой Strapi поднят на `:1344`, Vite на `:1342` (порты 1340/5173 заняты другим проектом — см. `dev-environment-ports-and-limits`).
- Реальные логины под 4 ролями, ~90 API-проб (авторизационная матрица, IDOR, privilege escalation, persistence).
- Статический аудит фронтенда по ролям + `eslint`, `i18n:check`, `vite build`.
- **Ограничение:** browser automation в этой среде недоступен, поэтому визуальный проход не выполнялся. Видеозвонок с двумя живыми пирами не воспроизводился — диагностика call-flow сделана по коду + API.
- Coordinator проверен по коду и по таблице прав в БД (отдельный UI-логин не заводился).

## Автоматические проверки

| Проверка | Результат | Комментарий |
|---|---|---|
| `npx eslint src` | PASS | 0 errors, 29 warnings. 3 ошибки из аудита 2026-07-08 исправлены. |
| `npm run i18n:check` | PASS | ru / en / kk синхронизированы. |
| `npm run build` | PASS | main chunk 472 KB (gzip 125 KB). |
| `server npx tsc --noEmit` | не запускался | — |

---

# Заявленные баги

## BUG-1 — Кнопку выхода из консультации нужно нажимать несколько раз — ИСПРАВЛЕНО

**Где:** `frontend/src/pages/VideoConsultation.jsx`, `confirmEndCall()`

**Причина.** Весь teardown звонка был внутри `try`, а `catch` только логировал:

```js
try {
  await saveChatLog(messages)
  if (action === 'complete') {
    await appointmentsAPI.update(appointment.documentId, { status: 'completed' })
    socketRef.current?.emit('force-end-call')
  }
  cleanupCall()                 // ← не выполняется при любой ошибке выше
  setPendingEndAction(null)     // ← модалка остаётся открытой
  closeConsultation(...)        // ← пользователь остаётся в звонке
} catch (err) {
  console.error(...)            // ← никакого сообщения пользователю
  isEndingCallRef.current = false
}
```

Любая 4xx от `PUT /api/appointments/:id` (не тот врач → 403, невалидный статус → 400, сеть) приводила к тому, что:
модалка подтверждения остаётся открытой, спиннер гаснет, ничего не происходит, сообщения об ошибке нет.
Пользователь жмёт «Завершить» ещё раз → тот же провал. В итоге он жмёт обычную красную трубку
(`action='leave'`, которая вообще не ходит в API) — и она срабатывает. Это ровно
описанный симптом «нажимать несколько раз, чтобы сработало как надо».

**Второй триггер.** `if (action === 'complete' && !appointment?.documentId) return` — молчаливый no-op,
плюс кнопка подтверждения была `disabled` в этом состоянии. Если `GET /api/appointments?filters[roomId]`
не отработал (запрашивается ровно один раз, без ретрая), сценарий «Завершить консультацию»
упирается в неактивную кнопку без объяснений.

**Исправление.**
- Teardown звонка вынесен из `try` и выполняется всегда — провал записи статуса больше не запирает участника в звонке.
- Ошибка API показывается тостом (новый ключ `video.complete_error` в ru/en/kk) с текстом сервера.
- `complete` без загруженного appointment деградирует в `leave` вместо тихого `return`; `disabled` с кнопки подтверждения снят.
- `cleanupCall()` теперь обнуляет `localStreamRef` / `peerConnectionRef` / `socketRef` / `activeSocketRef` и гасит `reconnectTimerRef`, чтобы завершённый звонок не мог «ожить» через reconnect-таймер.

## BUG-2 — Логотип в кабинете не ведёт на лендинг — ИСПРАВЛЕНО

**Где:** `frontend/src/components/layout/Sidebar.jsx`

`getHomePath()` возвращал дашборд роли (`/patient`, `/doctor`, `/admin`), а `/` — только для manager/coordinator.
Поэтому на `/patient/profile` клик по логотипу вёл на `/patient`, а не на лендинг; поведение вдобавок
различалось между ролями.

**Исправление.** Логотип ведёт на `/` для всех ролей — как в публичном хедере (`PublicLayout.jsx:203`).
Дашборд остаётся доступен первым пунктом навигации.

---

# P0 / High

## H-1 — Админ: смена статуса и статуса оплаты записи молча не сохраняется — ИСПРАВЛЕНО

**Где:** `frontend/src/pages/admin/AdminAppointments.jsx:387, 406`

Использовался числовой `appointment.id` вместо `documentId`. Strapi v5 адресует документы по `documentId`,
числовой id резолвится в ничто. Доказано на живом API:

```
PUT /api/appointments/238   {"data":{"statuse":"cancelled"}}  → HTTP 200  {"data":null}
GET /api/appointments/omx0bpluqm8pygml0alxdvwj                → statuse = "confirmed"   (не изменилось)
PUT /api/appointments/omx0bpluqm8pygml0alxdvwj                → HTTP 200, значение записано
```

UI при этом показывает `toast.success` и оптимистично обновляет локальный стейт — админ уверен,
что изменение прошло. После перезагрузки страницы всё откатывается. Затрагивает и статус записи,
и статус оплаты (то есть финансовую отчётность в карточке «Выручка»).

**Исправление:** оба вызова переведены на `documentId || id`.

## H-2 — Coordinator: страница «Врачи» открывается пустой

**Где:** `frontend/src/pages/admin/AdminDoctors.jsx:235`

```js
const usersRes = await api.get('/api/users?populate[role]...')   // без .catch()
```

В БД право `plugin::users-permissions.user.find` выдано **только роли Admin** (проверено запросом к
`up_permissions`). Coordinator получает 403 → исключение валит весь `loadData()` → `setDoctors`,
`setSpecializations`, `setClinics` не вызываются, `catch` только пишет в консоль.
Итог: `/coordinator/doctors` — пустой список без объяснения.

**Рекомендация:** `.catch(() => ({ data: [] }))` на этом вызове (как уже сделано для `contentAPI.getGlobal()`),
и показывать тост при полном отказе загрузки.

## H-3 — «Показать все» в уведомлениях ломается для admin / manager / coordinator

**Где:** `frontend/src/components/layout/Header.jsx:54-58`

```js
if (pathname.startsWith('/doctor')) return '/doctor/notifications'
if (pathname.startsWith('/admin'))  return '/admin/notifications'
return '/patient/notifications'
```

Маршруты `notifications` объявлены только внутри `/patient` и `/doctor` (`App.jsx:228, 249`).

- **admin** → `/admin/notifications` не матчится ни одним дочерним маршрутом → срабатывает `path="*"` → `Navigate to="/"` → **админа выбрасывает на публичный лендинг**.
- **manager / coordinator** → `/patient/notifications` → `ProtectedRoute allowedRoles={['patient']}` → редирект обратно на их дашборд.

**Рекомендация:** добавить маршрут `notifications` в admin/manager/coordinator секции и построить путь от `user.userRole`, а не от `location.pathname`.

---

# Medium

## M-1 — Аватар в сайдбаре и профиле пациента не грузится в проде

`Sidebar.jsx:123` и `PatientProfile.jsx:147` используют сырой `user?.avatar?.url`.
Все остальные 10 мест используют `getMediaUrl()`. В проде фронт и Strapi на разных origin
(`medtourserver.nnmc.kz`), поэтому относительный `/uploads/...` резолвится против домена фронта → битая картинка.

## M-2 — Публичный хедер перекрывает `/privacy` и `/terms`

Хедер — `fixed` высотой `h-20` (80px). У этих двух страниц только `py-12` (48px),
у остальных публичных — `pt-20` / `pt-28` / `pt-36`. ~32px контента (включая ссылку «назад») уходит под хедер.

## M-3 — Чат-лог пациента молча теряется

`saveChatLog()` шлёт `chatLog`, но в allowlist пациента (`server/src/api/appointment/controllers/appointment.ts:991-1017`)
разрешены только `statuse`, `rating`, `review` → 400 «No allowed fields to update», ошибка проглатывается.
Транскрипт консультации сохраняется, только если звонок завершил врач.

## M-4 — Заголовки страниц отсутствуют для 6 маршрутов

В `dashboard.page_titles` нет ключей: `/admin/chat`, `/admin/prices`, `/patient/plan-trip`,
`/patient/notifications`, `/doctor/notifications`, `/coordinator/chat` → показывается generic-заголовок.
`i18n:check` это не ловит (он проверяет только паритет между языками).

## M-5 — Три разные реализации «домашнего пути роли»

- `App.jsx:77` `getRoleHomePath()` — читает `user.userRole` (корректно).
- `ActiveConsultation.jsx:8` — дубликат того же.
- `PublicLayout.jsx:61` `getDashboardLink()` — читает `user?.role?.type` первым. Это Strapi-роль
  (`"authenticated"`), поэтому всегда возвращает `/patient`; врача/админа спасает только
  редирект-«отскок» в `ProtectedRoute`.

## M-6 — AdminDoctors может стереть workplace (в незакоммиченных правках)

`resolveDoctorWorkplace()` возвращает `''`, если клиника не сматчилась ни по связи, ни по имени.
`toPayload()` тогда пишет `workplace: ''` и `clinic: null`. Открыть карточку врача с нестандартным
местом работы и просто нажать «Сохранить» → поле затирается.

## M-7 — Системно: 17 файлов обрабатывают ошибки только через `console.error`

Без тоста и без inline-сообщения. Пользователь видит «ничего не произошло» — тот же класс проблемы,
что и BUG-1. Файлы: `LandingPage`, `TreatmentDepartmentPage`, `DoctorPatients`, `AppointmentDetail` (×5),
`PatientHistory`, `AdminDashboard`, `RegisterPage`, `DoctorProfilePage`, `DoctorDashboard`, `DoctorProfile` (×3),
`PatientDocuments`, `PatientAppointments`, `PatientDashboard`, `ImageCropModal`, `ChatComponent` (×4),
`DashboardLayout`, `PriceListSection`.

## M-8 — Рассинхрон состояния fullscreen

`toggleFullscreen()` (`VideoConsultation.jsx:817`) выставляет `isFullscreen` вручную и не слушает
событие `fullscreenchange`. Выход по Esc оставляет иконку в неверном состоянии.

---

# Что проверено и работает

## Авторизация бэкенда — сильная

| Проба | Результат |
|---|---|
| Пациент читает чужой case | 404 |
| Врач читает не свой case | 404 |
| Менеджер читает не свой case | 404 |
| Пациент меняет статус чужого case | 404 |
| Пациент меняет статус своего case | 403 (роль не может менять статус) |
| Пациент удаляет свой case | 403 |
| Пациент читает чужой medical-document | 403 |
| Пациент читает чужой conversation | 403 |
| Пациент читает сообщения чужого conversation | 200, 0 строк (корректно отфильтровано) |
| `finance-ledgers` под пациентом | только свои (14 записей, все patient id 46) |
| `/api/users` под patient/doctor/manager | 403 |
| Self-promote через `PUT /api/users/me {userRole:"admin"}` | игнорируется, роль остаётся `patient` |
| `PUT /api/users/47` чужим пациентом | 403 |
| Регистрация с `userRole=admin` | 403 |
| `GET /api/upload/files` анонимно / пациентом | 403 |

## Регрессии предыдущего аудита закрыты

- **P0 #1 (врач видит PII пациента)** — исправлено. `redactCaseForRole()` для doctor теперь отдаёт
  allowlist полей, а `patient` урезан до `id / documentId / fullName`. Email, phone, budgetRange,
  leadSource, visa/tourism, internalNotes, finance больше не уходят врачу.
- **3 eslint-ошибки** — исправлены.

## Наблюдение (не баг)

Поле статуса записи в схеме называется `statuse` (опечатка, зафиксированная в контракте).
Фронтенд везде читает `statuse || status`, а `appointmentsAPI.update()` (`services/api.js:656-663`)
маппит `status → statuse`. Работает, но любой новый прямой вызов `api.put('/api/appointments/...')`
с полем `status` молча ничего не сделает — контроллер читает только `body.statuse`. Стоит
переименовать поле или добавить приём обоих вариантов на бэкенде.

---

# Приоритеты

| # | Проблема | Severity | Статус |
|---|---|---|---|
| BUG-1 | Кнопка завершения консультации | High | исправлено |
| H-1 | Админ: изменения записей не сохраняются | High | исправлено |
| BUG-2 | Логотип не ведёт на лендинг | Medium | исправлено |
| H-2 | Coordinator: пустая страница «Врачи» | High | к исправлению |
| H-3 | Уведомления выбрасывают админа на лендинг | High | к исправлению |
| M-1 | Битый аватар в проде | Medium | к исправлению |
| M-3 | Чат-лог пациента теряется | Medium | к исправлению |
| M-6 | Затирание workplace | Medium | к исправлению |
| M-2, M-4, M-5, M-8 | UI/консистентность | Low-Medium | к исправлению |
| M-7 | Системный silent-catch | Medium | требует отдельной задачи |
