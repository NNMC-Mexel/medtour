# MedTour Capacitor MVP

Mobile shell for the existing React + Vite frontend. Backend remains Strapi v5, realtime remains the Socket.IO signaling server.

## App Identity

- App name: `MedTour`
- Bundle/application id: `kz.nnmc.medtour`
- Web build directory: `frontend/dist`

## Requirements

- Node.js/npm matching the frontend project.
- Android Studio with Android SDK and a Java Runtime for Android sync/build.
- Xcode and CocoaPods for iOS.
- iOS push requires an Apple Developer account with APNs capability.
- Android push requires a Firebase project.

## Commands

```bash
cd frontend
npm install
npm run build
npm run cap:sync
```

Open native projects:

```bash
npm run cap:open:android
npm run cap:open:ios
```

Run on a device/emulator:

```bash
npm run cap:run:android
npm run cap:run:ios
```

When frontend code changes:

```bash
npm run build
npm run cap:copy
```

When native plugins/config change:

```bash
npm run build
npm run cap:sync
```

## Backend URLs

The mobile bundle uses the same Vite runtime selection as the web app:

- `VITE_API_URL` for development.
- `VITE_SIGNALING_SERVER` for development.
- `VITE_PRODUCTION_API_URL` for production.
- `VITE_PRODUCTION_SIGNALING_URL` for production.

For real device testing, do not point to `localhost` unless the API is running on the device. Use a LAN/staging URL.

## Push Notifications

Implemented foundation:

- Capacitor `@capacitor/push-notifications` is installed.
- The app requests native push permission only on iOS/Android.
- Device tokens are registered with Strapi through `POST /api/device-tokens/register`.
- Tokens are scoped to the authenticated user on the backend.

Android Firebase setup:

1. Create a Firebase Android app with package id `kz.nnmc.medtour`.
2. Download `google-services.json`.
3. Place it at `frontend/android/app/google-services.json`.
4. Configure Firebase Cloud Messaging in the backend notification worker before sending real pushes.

iOS Firebase/APNs setup:

1. Create an iOS app in Apple Developer with bundle id `kz.nnmc.medtour`.
2. Enable Push Notifications and Background Modes as needed in Xcode.
3. If using Firebase, download `GoogleService-Info.plist`.
4. Add it to the Xcode project under `frontend/ios/App/App/`.
5. Configure APNs key/certificate in Firebase or your push provider.

Do not commit Firebase service account JSON, APNs private keys, certificates, or provider secrets. Store backend push credentials in production secret management.

Backend sending TODO:

- Add Firebase Admin/APNs provider configuration on the Strapi side.
- Read active `device-token` rows for the target user.
- Send notification payloads with a relative `link` value, for example `/patient/chat`.
- Disable/delete invalid tokens after provider errors.

Suggested server env names for a future sender:

```env
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=
APNS_TEAM_ID=
APNS_KEY_ID=
APNS_BUNDLE_ID=kz.nnmc.medtour
```

## Native Permissions

Android manifest includes:

- `INTERNET`
- `CAMERA`
- `RECORD_AUDIO`
- `POST_NOTIFICATIONS`
- `READ_MEDIA_IMAGES`
- `READ_MEDIA_VIDEO`
- `READ_EXTERNAL_STORAGE` up to SDK 32

iOS `Info.plist` includes usage descriptions for:

- Camera
- Microphone
- Photo Library

Video consultation uses the existing WebRTC/Socket.IO flow at `/consultation/:roomId`. Camera/microphone permission is requested by `getUserMedia`; the native manifest/plist entries make this valid inside the Capacitor shell.

## Security Notes

- Do not pass JWTs in query strings for `/api/file-proxy`.
- Medical documents must be opened through authenticated blob fetch with the `Authorization` header.
- Private MinIO/S3 objects must not be opened directly.
- Public registration remains patient-only; staff and doctors are admin-created.
- Device token registration binds to `ctx.state.user`; clients cannot register tokens for another user.

## Mobile QA Checklist

- Login with an existing patient and confirm the first authenticated screen is the patient dashboard.
- Register a patient and confirm the email confirmation screen appears without local auto-login.
- Choose country, preferred language and timezone during registration.
- Open bottom navigation on iPhone SE width: Case, Chat, Documents, Plan, Profile fit without overlap.
- Create/open a medical case from the Case tab.
- Upload a PDF/JPEG/PNG medical document from camera/gallery/files.
- Preview/download a document and confirm no `?token=` appears in the request URL.
- Open Chat and confirm manager online/offline state renders.
- Open Plan/Trip and confirm treatment plan/trip checklist read-only view renders.
- Open Notifications center from the header.
- Login as manager/coordinator and confirm assigned cases, filters/badges, case detail and chat routes remain reachable on mobile.
- Open `/consultation/:roomId` on a device and grant camera/microphone permission.
- Simulate weak network: retry clears the error state; chat fallback opens.
- Run `npm run build`, `npm run i18n:check`, and `npm run cap:sync`.
