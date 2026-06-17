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

If running as a Node service instead of static hosting:

- Port: `1342`
- Start command: `npx vite preview --host 0.0.0.0 --port 1342`
- `frontend/nixpacks.toml` is included for this mode.

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

Frontend env:

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

- `https://medtour.nnmc.kz` loads without console CORS/mixed-content errors.
- `https://medtourserver.nnmc.kz/admin` opens.
- `https://medtourserver.nnmc.kz/api/clinics` returns data.
- `https://medtourrtc.nnmc.kz/health` returns OK.
- Patient can create a medical case and upload a document.
- Unauthenticated request to a medical document `/api/file-proxy/:key` returns 403.
- Admin can assign manager/coordinator/clinic/doctor.
- Doctor decision updates case status.
- Patient sees read-only treatment plan.
