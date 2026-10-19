import test from 'node:test'
import assert from 'node:assert/strict'
import { TREATMENT_DEPARTMENTS, doctorBelongsToTreatmentDepartment } from './treatmentDepartments.js'

const departmentsOf = (...specializations) => TREATMENT_DEPARTMENTS
  .filter((department) => doctorBelongsToTreatmentDepartment({ specializations }, department))
  .map((department) => department.slug)

test('a neurologist is not a urologist: "neurologist" contains "urologist"', () => {
  assert.deepEqual(departmentsOf({ name: 'Невролог', nameEn: 'Neurologist' }), ['neurosurgery'])
  assert.deepEqual(departmentsOf({ name: 'Уролог', nameEn: 'Urologist' }), ['urology'])
})

test('a neurosurgeon is not a general surgeon: "нейрохирург" contains "хирург"', () => {
  assert.deepEqual(departmentsOf({ name: 'Нейрохирург', nameEn: 'Neurosurgeon' }), ['neurosurgery'])
  assert.deepEqual(departmentsOf({ name: 'Хирург' }), ['general-thoracic-surgery'])
  assert.deepEqual(departmentsOf({ name: 'Кардиохирург' }), ['cardiac-surgery', 'heart-institute'])
})

test('specializations match whole names in any language, ignoring case, ё and spacing', () => {
  assert.deepEqual(departmentsOf({ name: 'Врач', nameEn: 'Obstetrician-Gynecologist' }), ['gynecology'])
  assert.deepEqual(departmentsOf({ name: '  акушер–гинеколог ' }), ['gynecology'])
  assert.deepEqual(departmentsOf({ name: 'Торакальный  хирург' }), ['general-thoracic-surgery'])
  assert.deepEqual(departmentsOf({ name: 'Врач физической медицины и реабилитации' }), [])
  assert.deepEqual(departmentsOf({ name: 'Дерматолог' }, { name: 'Кардиолог' }), [
    'interventional-cardiology', 'arrhythmology', 'cardiac-surgery', 'heart-institute',
  ])
})

test('explicit assignments win and hidden doctors are never listed', () => {
  const [urology, neurosurgery] = ['urology', 'neurosurgery'].map((slug) => TREATMENT_DEPARTMENTS.find((d) => d.slug === slug))
  const doctor = { treatmentDepartments: ['urology'], specializations: [{ name: 'Невролог' }] }
  assert.equal(doctorBelongsToTreatmentDepartment(doctor, urology), true)
  assert.equal(doctorBelongsToTreatmentDepartment(doctor, neurosurgery), false)
  assert.equal(doctorBelongsToTreatmentDepartment({ isActive: false, specializations: [{ name: 'Уролог' }] }, urology), false)
})

test('CMS departments match their own specialization list', () => {
  const ent = { slug: 'ent', specialtyMatches: ['ЛОР', 'Оториноларинголог'] }
  assert.equal(doctorBelongsToTreatmentDepartment({ specializations: [{ name: 'лор' }] }, ent), true)
  assert.equal(doctorBelongsToTreatmentDepartment({ specializations: [{ name: 'Детский лор' }] }, ent), false)
})
