import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SCHEDULE_TIME_MODES,
  SCHEDULE_TYPES,
  generateSlotsFromIntervals,
  getDoctorIntervalsForDate,
  getDoctorVacationForDate,
  isDoctorWorkingOnDate,
  normalizeScheduleConfig,
  normalizeVacations,
  scheduleConfigToLegacyFields,
  validateScheduleConfig,
} from './schedule.js'

test('legacy schedules remain available on configured weekdays', () => {
  const doctor = {
    workingDays: '1,3,5',
    workingIntervals: [{ start: '08:00', end: '12:00' }],
  }

  assert.deepEqual(getDoctorIntervalsForDate(doctor, '2026-08-17'), [
    { start: '08:00', end: '12:00' },
  ])
  assert.deepEqual(getDoctorIntervalsForDate(doctor, '2026-08-18'), [])
})

test('recurring schedules resolve different intervals for each weekday', () => {
  const doctor = {
    scheduleConfig: {
      version: 1,
      type: SCHEDULE_TYPES.RECURRING,
      timeMode: SCHEDULE_TIME_MODES.INDIVIDUAL,
      week: {
        1: [{ start: '08:00', end: '12:00' }],
        2: [{ start: '14:00', end: '18:00' }],
      },
      dates: [],
    },
  }

  assert.deepEqual(getDoctorIntervalsForDate(doctor, '2026-08-17'), [
    { start: '08:00', end: '12:00' },
  ])
  assert.deepEqual(getDoctorIntervalsForDate(doctor, '2026-08-18'), [
    { start: '14:00', end: '18:00' },
  ])
  assert.equal(isDoctorWorkingOnDate(doctor, '2026-08-19'), false)
})

test('one-time schedules are available only on explicit dates', () => {
  const doctor = {
    workingDays: '1,2,3,4,5,6,7',
    scheduleConfig: {
      version: 1,
      type: SCHEDULE_TYPES.ONE_TIME,
      dates: [
        { date: '2026-08-20', intervals: [{ start: '10:00', end: '13:00' }] },
      ],
      week: {},
    },
  }

  assert.equal(isDoctorWorkingOnDate(doctor, '2026-08-19'), false)
  assert.deepEqual(getDoctorIntervalsForDate(doctor, '2026-08-20'), [
    { start: '10:00', end: '13:00' },
  ])
})

test('schedule validation rejects duplicate dates and overlapping intervals', () => {
  const duplicateDates = validateScheduleConfig({
    type: SCHEDULE_TYPES.ONE_TIME,
    week: {},
    dates: [
      { date: '2026-08-20', intervals: [{ start: '10:00', end: '13:00' }] },
      { date: '2026-08-20', intervals: [{ start: '14:00', end: '18:00' }] },
    ],
  })
  assert.equal(duplicateDates.error, 'duplicate_date')

  const overlap = validateScheduleConfig({
    type: SCHEDULE_TYPES.RECURRING,
    week: {
      1: [
        { start: '09:00', end: '12:00' },
        { start: '11:30', end: '14:00' },
      ],
    },
    dates: [],
  })
  assert.equal(overlap.error, 'overlap')
})

test('advanced schedules still produce legacy compatibility fields', () => {
  const fields = scheduleConfigToLegacyFields({
    type: SCHEDULE_TYPES.RECURRING,
    week: {
      2: [{ start: '14:00', end: '18:00' }],
      4: [{ start: '09:00', end: '12:00' }],
    },
    dates: [],
  })

  assert.equal(fields.workingDays, '2,4')
  assert.deepEqual(fields.workingIntervals, [{ start: '14:00', end: '18:00' }])
})

test('Sunday remains ISO day 7 in recurring and legacy schedules', () => {
  const recurringDoctor = {
    scheduleConfig: {
      type: SCHEDULE_TYPES.RECURRING,
      week: { 7: [{ start: '10:00', end: '12:00' }] },
      dates: [],
    },
  }
  const legacyDoctor = {
    workingDays: '7',
    workingIntervals: [{ start: '11:00', end: '13:00' }],
  }

  assert.equal(isDoctorWorkingOnDate(recurringDoctor, '2026-08-16'), true)
  assert.equal(isDoctorWorkingOnDate(recurringDoctor, '2026-08-17'), false)
  assert.deepEqual(getDoctorIntervalsForDate(legacyDoctor, '2026-08-16'), [
    { start: '11:00', end: '13:00' },
  ])
})

test('slot generation never creates a consultation beyond an interval end', () => {
  assert.deepEqual(
    generateSlotsFromIntervals([{ start: '09:00', end: '10:10' }], 30),
    ['09:00', '09:30'],
  )
  assert.deepEqual(
    generateSlotsFromIntervals([
      { start: '09:00', end: '10:00' },
      { start: '14:00', end: '14:30' },
    ], 30),
    ['09:00', '09:30', '14:00'],
  )
})

test('one-time dates are normalized, sorted, and converted to ISO weekdays', () => {
  const config = normalizeScheduleConfig({
    type: SCHEDULE_TYPES.ONE_TIME,
    week: {},
    dates: [
      { date: '2026-08-23', intervals: [{ start: '14:00', end: '18:00' }] },
      { date: '2026-08-20', intervals: [{ start: '09:00', end: '12:00' }] },
    ],
  })

  assert.deepEqual(config.dates.map((entry) => entry.date), ['2026-08-20', '2026-08-23'])
  assert.equal(scheduleConfigToLegacyFields(config).workingDays, '4,7')
})

test('schedule validation requires active recurring days and one-time dates', () => {
  assert.equal(validateScheduleConfig({
    type: SCHEDULE_TYPES.RECURRING,
    week: {},
    dates: [],
  }).error, 'no_days')
  assert.equal(validateScheduleConfig({
    type: SCHEDULE_TYPES.ONE_TIME,
    week: {},
    dates: [],
  }).error, 'no_dates')
  assert.equal(validateScheduleConfig({
    type: SCHEDULE_TYPES.ONE_TIME,
    week: {},
    dates: [{ date: '', intervals: [{ start: '09:00', end: '10:00' }] }],
  }).error, 'invalid_date')
})

test('vacation closes every day of the period, both ends included', () => {
  const doctor = {
    scheduleConfig: {
      type: SCHEDULE_TYPES.RECURRING,
      week: { 1: [{ start: '09:00', end: '12:00' }], 2: [{ start: '09:00', end: '12:00' }] },
      vacations: [{ from: '2030-01-07', to: '2030-01-14' }],
    },
  }

  // 2030-01-07 и 2030-01-14 — понедельники.
  assert.equal(isDoctorWorkingOnDate(doctor, '2030-01-06'), false)
  assert.equal(isDoctorWorkingOnDate(doctor, '2030-01-07'), false)
  assert.equal(isDoctorWorkingOnDate(doctor, '2030-01-08'), false)
  assert.equal(isDoctorWorkingOnDate(doctor, '2030-01-14'), false)
  assert.equal(isDoctorWorkingOnDate(doctor, '2030-01-15'), true)
  assert.deepEqual(getDoctorVacationForDate(doctor, '2030-01-10'), { from: '2030-01-07', to: '2030-01-14' })
  assert.equal(getDoctorVacationForDate(doctor, '2030-01-15'), null)
})

test('vacation also overrides one-time dates', () => {
  const doctor = {
    scheduleConfig: {
      type: SCHEDULE_TYPES.ONE_TIME,
      dates: [
        { date: '2030-03-01', intervals: [{ start: '09:00', end: '10:00' }] },
        { date: '2030-03-05', intervals: [{ start: '09:00', end: '10:00' }] },
      ],
      vacations: [{ from: '2030-03-04', to: '2030-03-06' }],
    },
  }

  assert.equal(isDoctorWorkingOnDate(doctor, '2030-03-01'), true)
  assert.equal(isDoctorWorkingOnDate(doctor, '2030-03-05'), false)
})

test('vacations are normalized: swapped ends fixed, past and duplicate periods dropped', () => {
  assert.deepEqual(normalizeVacations([
    { from: '2030-05-10', to: '2030-05-01' },
    { from: '2030-05-01', to: '2030-05-10' },
    { from: '2020-01-01', to: '2020-01-10' },
    { from: '2029-12-01', to: '2029-12-03' },
    { from: '', to: '2030-01-01' },
  ], '2026-09-28'), [
    { from: '2029-12-01', to: '2029-12-03' },
    { from: '2030-05-01', to: '2030-05-10' },
  ])

  const config = normalizeScheduleConfig({
    type: SCHEDULE_TYPES.RECURRING,
    week: { 1: [{ start: '09:00', end: '12:00' }] },
  })
  assert.deepEqual(config.vacations, [])
})

test('overlapping and back-to-back vacations are merged into one period', () => {
  assert.deepEqual(normalizeVacations([
    { from: '2030-01-01', to: '2030-01-10' },
    { from: '2030-01-05', to: '2030-01-07' },
    { from: '2030-01-11', to: '2030-01-15' },
    { from: '2030-01-17', to: '2030-01-20' },
  ], '2026-09-28'), [
    { from: '2030-01-01', to: '2030-01-15' },
    { from: '2030-01-17', to: '2030-01-20' },
  ])
})

test('schedule validation rejects a vacation without dates', () => {
  assert.equal(validateScheduleConfig({
    type: SCHEDULE_TYPES.RECURRING,
    week: { 1: [{ start: '09:00', end: '12:00' }] },
    vacations: [{ from: '2030-01-01', to: '' }],
  }).error, 'invalid_vacation')
})
