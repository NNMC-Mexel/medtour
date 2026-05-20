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

PAYMENTS_LIVE=true
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
VITE_PAYMENTS_LIVE=true
VITE_EPAY_TEST=false
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
PAYMENTS_LIVE=true
EPAY_TEST=false
EPAY_CLIENT_ID=...
EPAY_CLIENT_SECRET=...
EPAY_TERMINAL_ID=...
EPAY_QR_CLIENT_ID=...
EPAY_QR_CLIENT_SECRET=...
EPAY_QR_TERMINAL_ID=...
STRAPI_API_URL=https://medtourserver.nnmc.kz
STRAPI_API_TOKEN=...
```

Health check:

```bash
curl https://medtourrtc.nnmc.kz/health
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
