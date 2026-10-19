'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { planImport, sourceClinicType, pickI18n, mergeMissingI18n } = require('../scripts/import-medconnect-doctors.js');

const clinics = [
  { documentId: 'clinic-nnmc', name: 'NNMC', clinicType: 'nnmc' },
  { documentId: 'clinic-umit', name: 'UMIT Tomotherapy', clinicType: 'umit' },
];
const cardiologist = { id: 7, name: 'Кардиолог', nameEn: 'Cardiologist' };

async function departmentHelpers() {
  const file = path.resolve(__dirname, '../../frontend/src/data/treatmentDepartments.js');
  const { TREATMENT_DEPARTMENTS, doctorBelongsToTreatmentDepartment } = await import(pathToFileURL(file).href);
  return { departments: TREATMENT_DEPARTMENTS, belongsToDepartment: doctorBelongsToTreatmentDepartment };
}

function source(overrides = {}) {
  return {
    documentId: 'mc-1',
    fullName: 'Иванова Анна Петровна',
    specialization: cardiologist,
    specializations: [cardiologist],
    experience: 12,
    bio: 'Описание',
    education: 'КазНМУ',
    licenseNumber: 'L-1',
    position: 'Врач высшей категории',
    workplace: 'ННМЦ',
    clinic: 'nnmc',
    languages: ['ru', 'kk'],
    i18n: { en: { fullName: 'Anna Ivanova', bio: ' ', extra: 'x' } },
    price: 21500,
    rating: 5,
    reviewsCount: 6,
    userId: 99,
    users_permissions_user: { id: 99 },
    workingHours: { mon: '9-18' },
    photo: { url: '/api/file-proxy/photo.jpg' },
    isActive: true,
    ...overrides,
  };
}

test('new doctor: profile fields only, visible, NNMC clinic, departments by specialization', async () => {
  const helpers = await departmentHelpers();
  const plan = planImport({ sourceDoctors: [source()], targetDoctors: [], targetSpecializations: [cardiologist], clinics, ...helpers });

  assert.equal(plan.create.length, 1);
  const { data } = plan.create[0];
  for (const field of ['price', 'rating', 'reviewsCount', 'userId', 'users_permissions_user', 'workingHours', 'certificates']) {
    assert.equal(field in data, false, `${field} must not be transferred`);
  }
  assert.equal(data.isActive, true);
  assert.equal(data.clinic, 'clinic-nnmc');
  // Админка MedTour узнаёт клинику по названию в workplace.
  assert.equal(data.workplace, 'NNMC');
  assert.deepEqual(data.i18n, { en: { fullName: 'Anna Ivanova' } });
  assert.deepEqual(data.treatmentDepartments, ['interventional-cardiology', 'arrhythmology', 'cardiac-surgery', 'heart-institute']);
  assert.deepEqual(plan.create[0].specializationKeys, ['кардиолог']);
  assert.equal(plan.newSpecializations.length, 0);
});

test('existing doctor: only blank fields are filled, nothing else is touched', async () => {
  const helpers = await departmentHelpers();
  const target = {
    documentId: 'mt-1',
    fullName: 'ИВАНОВА  Анна Петровна',
    bio: 'Своё описание из MedTour',
    education: '',
    experience: 0,
    languages: [],
    i18n: { en: { fullName: 'Anna I.' } },
    clinic: null,
    workplace: '',
    specializations: [{ id: 3, name: 'Терапевт' }],
    photo: { id: 5 },
  };
  const plan = planImport({ sourceDoctors: [source()], targetDoctors: [target], targetSpecializations: [cardiologist], clinics, ...helpers });

  assert.equal(plan.create.length, 0);
  assert.equal(plan.fill.length, 1);
  const { data, fields, specializationKeys, photo } = plan.fill[0];
  assert.equal(data.bio, undefined);
  assert.equal(data.education, 'КазНМУ');
  assert.equal(data.experience, 12);
  assert.deepEqual(data.languages, ['ru', 'kk']);
  assert.equal(data.i18n, undefined, 'existing translation kept');
  assert.equal(data.clinic, 'clinic-nnmc');
  assert.equal(data.workplace, 'NNMC');
  assert.deepEqual(specializationKeys, [], 'existing specializations kept');
  assert.equal(photo, null, 'existing photo kept');
  for (const field of ['isActive', 'price', 'treatmentDepartments', 'fullName']) assert.equal(field in data, false);
  assert.ok(!fields.includes('photo'));
});

test('re-run is a no-op once the doctor is complete', async () => {
  const helpers = await departmentHelpers();
  const target = {
    documentId: 'mt-1', fullName: 'Иванова Анна Петровна', bio: 'x', education: 'x', licenseNumber: 'x', position: 'x',
    experience: 3, languages: ['ru'], i18n: { en: { fullName: 'Anna' } }, clinic: { id: 1 }, workplace: 'NNMC',
    specialization: cardiologist, specializations: [cardiologist], photo: { id: 1 },
  };
  const plan = planImport({ sourceDoctors: [source()], targetDoctors: [target], targetSpecializations: [cardiologist], clinics, ...helpers });
  assert.equal(plan.fill.length, 0);
  assert.equal(plan.unchanged.length, 1);
});

test('missing specializations are created once and only when used', async () => {
  const helpers = await departmentHelpers();
  const urologist = { name: 'Уролог', nameEn: 'Urologist', image: { id: 1 } };
  const plan = planImport({
    sourceDoctors: [
      source({ documentId: 'a', fullName: 'Доктор А', specialization: urologist, specializations: [urologist] }),
      source({ documentId: 'b', fullName: 'Доктор Б', specialization: urologist, specializations: [urologist] }),
    ],
    targetDoctors: [],
    targetSpecializations: [],
    clinics,
    ...helpers,
  });
  assert.equal(plan.newSpecializations.length, 1);
  assert.equal(plan.newSpecializations[0].data.name, 'Уролог');
  assert.equal('image' in plan.newSpecializations[0].data, false);
  assert.deepEqual(plan.create[0].data.treatmentDepartments, ['urology']);
});

test('ambiguous names are skipped, doctors hidden in MedConnect stay hidden', async () => {
  const helpers = await departmentHelpers();
  const plan = planImport({
    sourceDoctors: [
      source({ fullName: 'Дубль' }),
      source({ fullName: 'Дубль', documentId: 'mc-2' }),
      source({ fullName: 'Двойник в MedTour' }),
      source({ fullName: 'Скрытый', isActive: false, clinic: null, workplace: 'УМИТ' }),
    ],
    targetDoctors: [{ fullName: 'Двойник в MedTour', documentId: 'x' }, { fullName: 'двойник в medtour', documentId: 'y' }],
    targetSpecializations: [cardiologist],
    clinics,
    ...helpers,
  });
  assert.deepEqual(plan.create.map((item) => item.fullName), ['Дубль', 'Скрытый']);
  assert.equal(plan.skipped.length, 2);
  const hidden = plan.create[1];
  assert.equal(hidden.data.isActive, false);
  assert.equal(hidden.data.clinic, 'clinic-umit');
  assert.ok(hidden.notes.includes('СКРЫТ: скрыт в MedConnect'));
  // Отделения заполнены заранее — пригодятся, когда врача включат.
  assert.deepEqual(hidden.data.treatmentDepartments, ['interventional-cardiology', 'arrhythmology', 'cardiac-surgery', 'heart-institute']);
  assert.equal(plan.create[0].data.isActive, true);
});

test('doctor without a licence is created hidden: MedTour rejects active doctors without one', async () => {
  const helpers = await departmentHelpers();
  const plan = planImport({ sourceDoctors: [source({ licenseNumber: '  ' })], targetDoctors: [], targetSpecializations: [cardiologist], clinics, ...helpers });
  assert.equal(plan.create[0].data.isActive, false);
  assert.ok(plan.create[0].notes.some((note) => note.startsWith('СКРЫТ')));
});

test('departments use the site rule: whole specialization names, not substrings', async () => {
  const helpers = await departmentHelpers();
  const departmentsOf = (specialization) => planImport({
    sourceDoctors: [source({ specialization, specializations: [specialization] })],
    targetDoctors: [], targetSpecializations: [], clinics, ...helpers,
  }).create[0].data.treatmentDepartments;
  assert.deepEqual(departmentsOf({ name: 'Невролог', nameEn: 'Neurologist' }), ['neurosurgery']);
  assert.deepEqual(departmentsOf({ name: 'Нейрохирург' }), ['neurosurgery']);
  assert.deepEqual(departmentsOf({ name: 'Хирург' }), ['general-thoracic-surgery']);
  assert.deepEqual(departmentsOf({ name: 'Врач физической медицины и реабилитации' }), []);
});

test('helpers', () => {
  assert.equal(sourceClinicType({ clinic: null, workplace: 'Международный онкологический центр томотерапии UMIT' }), 'umit');
  assert.equal(sourceClinicType({ workplace: 'Другая клиника' }), null);
  assert.deepEqual(pickI18n({ kk: { bio: ' мәтін ', price: 1 }, en: null }), { kk: { bio: 'мәтін' } });
  assert.deepEqual(mergeMissingI18n({ en: { fullName: 'A' } }, { en: { fullName: 'B', bio: 'C' } }), { en: { fullName: 'A', bio: 'C' } });
  assert.equal(mergeMissingI18n({ en: { fullName: 'A' } }, { en: { fullName: 'B' } }), null);
});
