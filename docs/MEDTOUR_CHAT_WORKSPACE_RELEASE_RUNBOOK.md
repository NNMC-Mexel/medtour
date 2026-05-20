# MedTour Chat and Manager Workspace Release Runbook

This runbook covers the 10 hardening steps after the case-first chat/workspace MVP.

## 1. Manual Smoke Test

Use two browsers or one browser plus incognito.

1. Login as patient.
2. Open `/patient` and verify the fixed bottom-right chat widget is visible.
3. Open the widget and send a text message.
4. Upload an image and a PDF/DOC file.
5. Login as manager in the second browser.
6. Open `/manager` and verify:
   - shared chat inbox shows the case chat;
   - unread counter is greater than 0;
   - SLA badges render on cards;
   - patient pipeline lists the case.
7. Open chat from workspace and click `Take over`.
8. Send a manager reply.
9. Verify patient receives realtime message, typing state and read receipt.
10. Open `/patient/chat` and confirm persistent message history.

## 2. Permissions Check

Run after Strapi bootstrap or after changing roles in Admin UI:

```bash
cd server
npm run check:chat-permissions
```

Expected result: every role prints `[OK]`.

## 3. Production Env Check

Run in each service shell before deploy:

```bash
cd server
npm run check:env
```

```bash
cd frontend
npm run check:env
```

```bash
cd signaling-server
npm run check:env
```

Production must have `NODE_ENV=production`, live secrets, Postgres, private S3/MinIO and signaling CORS set to production frontend origins.

## 4. Backfill Existing Case Chats

Run dry-run first:

```bash
cd server
npm run migrate:case-chats:dry
```

Then execute:

```bash
npm run migrate:case-chats
```

This creates or normalizes one `Conversation` per `MedicalCase`, links existing participants, and writes a `case-event`.

## 5. RBAC/API Smoke

Run on staging with real JWTs:

```bash
cd server
API_URL=https://medtourserver.nnmc.kz \
CASE_ID=<medical-case-documentId> \
PATIENT_JWT=<jwt> \
MANAGER_JWT=<jwt> \
ADMIN_JWT=<jwt> \
DOCTOR_JWT=<jwt> \
OTHER_PATIENT_JWT=<jwt> \
npm run smoke:chat-workspace
```

Expected checks:

- patient opens only own case chat;
- manager reads shared/assigned chat;
- manager takeover works;
- admin can read all chats;
- unrelated patient is denied;
- doctor access is explicit via `doctorChatEnabled`.

## 6. Redis Adapter for Socket.IO

Required for more than one signaling instance.

Signaling env:

```env
REDIS_URL=redis://redis:6379
```

Startup log must include:

```text
[Socket.IO] Redis adapter enabled
```

If `REDIS_URL` is absent, startup logs single-instance mode. That is acceptable only for one signaling container.

## 7. Notifications and SLA

Implemented baseline:

- Strapi notifications on chat messages;
- browser notification for unread realtime message when permission is granted;
- cron-generated `SLA_OVERDUE` case events and notifications;
- due reminder notifications from `REMINDER_CREATED` case events.

Cron is controlled by:

```env
CRON_ENABLED=true
```

## 8. Automated Verification

Minimum local verification:

```bash
cd frontend
npm run build
npm run i18n:check
```

```bash
cd server
npm run build
```

```bash
cd signaling-server
node --check server.js
```

Staging verification:

```bash
cd server
npm run check:chat-permissions
npm run smoke:chat-workspace
```

## 9. Manager Workspace UX Acceptance

Validate on `/manager`:

- CRM board grouped by MedicalCase status;
- filters by status, country, urgency, manager, doctor, unread, SLA overdue;
- quick actions: claim, assign doctor, change status, open chat, request documents;
- shared chat inbox;
- internal notes;
- reminders;
- patient timeline.

## 10. Release Sequence

1. Backup production DB.
2. Deploy Strapi.
3. Run `npm run migrate:case-chats:dry`.
4. Run `npm run migrate:case-chats`.
5. Run `npm run check:chat-permissions`.
6. Deploy signaling with `REDIS_URL` if multi-instance.
7. Deploy frontend.
8. Run API smoke with role JWTs.
9. Run manual smoke in two browsers.
10. Monitor Strapi logs, signaling logs and notification creation for 30 minutes.

## Blocked Without Environment Access

The following cannot be fully executed locally without staging/production credentials:

- real login smoke for patient/manager/admin/doctor;
- API smoke using role JWTs;
- Redis adapter validation against managed Redis;
- production deploy;
- production DB backup;
- CORS and WebSocket validation on public domains.
