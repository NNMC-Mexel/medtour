import { TREATMENT_DEPARTMENTS, localizeDepartment } from '../src/data/treatmentDepartments.js'

const displayedFields = [
  'displayTitle',
  'displayShort',
  'summary',
  'services',
  'programs',
  'conditions',
  'technology',
  'journey',
  'benefits',
]

const errors = []

for (const department of TREATMENT_DEPARTMENTS) {
  const english = localizeDepartment(department, 'en')
  const russian = localizeDepartment(department, 'ru')
  const kazakh = localizeDepartment(department, 'kk')

  for (const field of displayedFields) {
    const serialized = JSON.stringify(english[field])
    if (!serialized || serialized === 'null') {
      errors.push(`${department.slug}.${field}: missing English content`)
      continue
    }
    if (/[А-Яа-яЁё]/.test(serialized)) {
      errors.push(`${department.slug}.${field}: contains Cyrillic characters`)
    }

    const kazakhSerialized = JSON.stringify(kazakh[field])
    if (!kazakhSerialized || kazakhSerialized === 'null') {
      errors.push(`${department.slug}.${field}: missing Kazakh content`)
    }
    if (!['displayTitle', 'displayShort'].includes(field) && kazakhSerialized === JSON.stringify(russian[field])) {
      errors.push(`${department.slug}.${field}: Kazakh content is identical to Russian`)
    }
  }

  const fullKazakhContent = displayedFields.map((field) => JSON.stringify(kazakh[field])).join(' ')
  if (!/[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(fullKazakhContent)) {
    errors.push(`${department.slug}: Kazakh-specific characters are missing`)
  }
}

if (errors.length > 0) {
  console.error(`Treatment locale check failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
  process.exit(1)
}

console.log(`Treatment locale check passed for ${TREATMENT_DEPARTMENTS.length} departments.`)
