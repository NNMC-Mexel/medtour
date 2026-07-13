import assert from 'node:assert/strict'
import {
  TREATMENT_DEPARTMENTS,
  createDefaultTreatmentDepartmentsForCms,
  doctorBelongsToTreatmentDepartment,
  localizeDepartment,
  mergeTreatmentDepartments,
} from '../src/data/treatmentDepartments.js'

assert.equal(TREATMENT_DEPARTMENTS.length, 8, 'Exactly eight treatment departments are required')
assert.equal(new Set(TREATMENT_DEPARTMENTS.map((item) => item.slug)).size, 8, 'Department slugs must be unique')

const defaults = createDefaultTreatmentDepartmentsForCms()
assert.equal(defaults.length, 8, 'CMS defaults must include every department')

for (const department of TREATMENT_DEPARTMENTS) {
  const russian = localizeDepartment(department, 'ru')
  const kazakh = localizeDepartment(department, 'kk')
  assert.notDeepEqual(kazakh.services, russian.services, `${department.slug}: Kazakh services must differ from Russian`)
  assert.ok(department.heroImage, `${department.slug}: hero image is required`)
  assert.ok(department.specialtyMatches.length, `${department.slug}: specialty matching rules are required`)
}

const partialCmsData = defaults.map((department) => department.slug === 'therapy'
  ? { ...department, content: { en: { title: 'Custom title' } } }
  : department)
const mergedTherapy = mergeTreatmentDepartments(partialCmsData).find((department) => department.slug === 'therapy')
const localizedPartial = localizeDepartment(mergedTherapy, 'en')
assert.equal(localizedPartial.displayTitle, 'Custom title', 'CMS content must override the static fallback')
assert.ok(localizedPartial.summary, 'Partial CMS content must retain the localized summary fallback')
assert.ok(localizedPartial.services.length, 'Partial CMS content must retain localized services')

const urology = TREATMENT_DEPARTMENTS.find((department) => department.slug === 'urology')
assert.equal(doctorBelongsToTreatmentDepartment({ isActive: true, specialization: { nameEn: 'Urologist' } }, urology), true)
assert.equal(doctorBelongsToTreatmentDepartment({ isActive: false, specialization: { nameEn: 'Urologist' } }, urology), false)
assert.equal(doctorBelongsToTreatmentDepartment({ isActive: true, treatmentDepartments: ['therapy'], specialization: { nameEn: 'Urologist' } }, urology), false)
assert.equal(doctorBelongsToTreatmentDepartment({ isActive: true, treatmentDepartments: ['urology'] }, urology), true)

console.log('Treatment data, CMS fallback and doctor matching checks passed.')
