# MedTour Phase 1 Notes

## Decision

The project remains on Strapi v5. Prisma is intentionally out of scope.

The main MedTour workflow should be built around `MedicalCase`. Existing `Appointment` records are kept for online consultations and should be linked to a case in phase 2.

## Case-First Model

MedTour is not a public doctor marketplace. The patient does not need to know which doctor is required before registration.

The first product action is:

```text
Start medical case
```

After that, the MedTour team manages:

- document collection
- manager assignment
- medical coordinator review
- clinic and doctor matching
- online consultation
- treatment decision
- treatment plan
- visa and travel support
- arrival and treatment logistics
- optional Kazakhstan tourism
- post-care follow-up

## MVP Roles

- `patient`
- `manager`
- `coordinator`
- `doctor`
- `admin`

`manager` and `coordinator` need Strapi roles, permissions, and dashboard sections in phase 2.

## Status Flow Draft

```text
NEW
DOCS_PENDING
ASSIGNED
IN_REVIEW
MATCHING
CONSULTATION_SCHEDULED
CONSULTATION_COMPLETED
NO_TREATMENT_NEEDED
PLAN_FORMING
PLAN_READY
PATIENT_DECISION
CONFIRMED
VISA_PROCESS
TRAVEL_ARRANGED
ARRIVED
IN_TREATMENT
DISCHARGED
COMPLETED
POST_CARE
CANCELLED
```

## Phase 2 Backend Content Types

- `medical-case`
- `clinic`
- `treatment-plan`
- `trip-checklist`
- `visa-request`
- `tourism-package`
- `case-event`

Existing entities to extend:

- `user`
- `doctor`
- `appointment`
- `medical-document`
- `notification`
- `conversation`
