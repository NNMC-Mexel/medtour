# MedTour Product Backlog and Operating Spec

## Product Principle

Medical case is the primary object. Appointments, documents, treatment plans, chats, payments, travel tasks and notifications must be created in the context of a case whenever a case exists.

## P0 Implemented Baseline

1. Medical case state machine
   - Source of truth: `server/src/utils/medical-case-workflow.ts`.
   - Frontend mirror: `frontend/src/utils/medicalCaseWorkflow.js`.
   - Server rejects invalid role/status transitions in `medical-case.update`.
   - Every status or assignment change writes a `case-event`.

2. Role permission matrix
   - Documented in `ROLE_PERMISSION_MATRIX` in `server/src/utils/medical-case-workflow.ts`.
   - Enforced partly by Strapi permissions and partly by controller allowlists.
   - Patient updates are restricted to patient-owned case fields.
   - Doctor, manager and coordinator updates are restricted by role-specific case fields.

3. Manager/coordinator dashboards
   - `frontend/src/pages/staff/StaffDashboard.jsx`.
   - Shows SLA overdue cases, assignment queue, medical review queue and travel-stage queue.
   - `/manager` and `/coordinator` now land on a dashboard, not a raw case table.

4. Payment/refund ledger
   - New Strapi content type: `finance-ledger`.
   - Appointment lifecycle writes ledger entries for captured, authorized, failed and settled-refund states.
   - Case detail shows ledger entries for staff.

5. Treatment plan approval
   - Doctors/coordinators/admins must fill required clinical/commercial fields before sending a plan.
   - Patients can accept or decline a sent treatment plan.
   - Accepted plans move the case to `CONFIRMED`.

6. Case-first booking
   - Booking flow attaches a consultation appointment to the patient's active medical case when one exists.
   - Payment success and signaling payment confirmation preserve the case relation.

7. Localization completeness
   - `frontend/scripts/check-i18n.mjs` checks locale key parity.
   - `npm run i18n:check` is available for CI.

## P1 Next

1. Replace remaining hardcoded MedTour case text in case/detail/dashboard screens with i18n keys.
2. Add SLA notification jobs for overdue case statuses.
3. Add explicit document translation workflow with owner, language, due date and completion status.
4. Add finance reconciliation import/export for provider statements.
5. Convert the current frontend mirrored workflow constants into generated output from the server workflow spec.

## P2 Next

1. Analytics dashboard by source, country, treatment category, revenue and conversion stage.
2. Patient satisfaction/NPS after treatment and post-care.
3. CRM lead source tracking and campaign attribution.
