# MedTour

Global medical tourism platform based on the previous MedConnect codebase.

MedTour helps international patients receive medical treatment in Kazakhstan end to end: initial request, document upload, personal manager assignment, clinic and doctor matching, online consultation, treatment plan, visa/travel support, arrival logistics, treatment support, optional tourism, and post-care.

## Current Architecture

The project stays on the existing Strapi stack. Prisma is not used.

```text
medtourReload/
├── frontend/          # React + Vite portal and landing
├── server/            # Strapi v5 backend
├── signaling-server/  # Socket.io/WebRTC signaling for video consultations
└── MedTour_BusinessLogic.docx
```

## Stack

Frontend:
- React + Vite
- Tailwind CSS
- Zustand
- i18next
- Socket.io client

Backend:
- Strapi v5
- SQLite locally
- PostgreSQL in deployment
- MinIO/S3-compatible file storage

Realtime:
- Socket.io signaling server for existing video consultation flow

Deployment:
- Coolify
- PostgreSQL
- MinIO

## Product Model

MedConnect was consultation-first: a patient selected a doctor and booked an appointment.

MedTour is case-first: a patient creates a medical case, then the MedTour team manages the process.

Main business object for the next development phase:

```text
MedicalCase
```

`Appointment` should remain a consultation event inside a medical case. It should not become the main business workflow.

## MVP Flow

1. Patient lands on the MedTour website.
2. Patient registers and starts a medical case.
3. Patient uploads medical documents.
4. Manager is assigned to the case.
5. Medical coordinator reviews documents and chooses clinic/doctor.
6. Doctor joins the online consultation and makes a treatment decision.
7. Treatment plan is prepared and sent to the patient.
8. Patient confirms the plan.
9. Trip checklist is created for visa, tickets, hotel, transfer, treatment and post-care.
10. Patient tracks status, documents, chat and treatment plan in the portal.

## Roles

Planned MVP roles:

- `patient` - international patient.
- `manager` - personal MedTour manager responsible for case handling and logistics.
- `coordinator` - medical coordinator responsible for clinic/doctor matching and treatment plan workflow.
- `doctor` - partner clinic doctor with access only to assigned cases and consultations.
- `admin` - full system access.

Current code already supports `patient`, `doctor`, and `admin`. `manager` and `coordinator` are part of the MedTour adaptation.

## Partner Clinics

Initial clinic network:

- NNMC: https://www.nnmc.kz/
- MexelHealth: https://www.nnmc.kz/ru/mexelhealth
- UMIT / Tomotherapy: https://tomo.kz/

MedTour is an organizer and service platform. Medical responsibility belongs to the clinic providing care.

## Local Development

Backend:

```bash
cd server
npm install
npm run develop
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Signaling server:

```bash
cd signaling-server
npm install
npm start
```

Default local URLs:

- Frontend: http://localhost:5173
- Strapi: http://localhost:1340/admin
- Signaling: http://localhost:3001

## Phase 1 Scope

This phase adapts the codebase identity and product direction:

- Use MedTour naming in public UI and docs.
- Keep Strapi as the backend architecture.
- Position the landing around a managed medical case, not doctor self-selection.
- Keep existing consultation, chat, document and video modules as reusable building blocks.
- Prepare the codebase for `MedicalCase` as the main entity in phase 2.

## Next Phase

Phase 2 should add the backend content types and permissions:

- `medical-case`
- `clinic`
- `treatment-plan`
- `trip-checklist`
- `visa-request`
- `tourism-package`
- `case-event`

Existing `appointment` and `medical-document` should be linked to `medical-case`.
