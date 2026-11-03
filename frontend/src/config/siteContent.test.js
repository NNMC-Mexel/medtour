import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_CONTACTS,
  compactSiteContent,
  contactHref,
  contactKind,
  messengersOnNumber,
  readSiteContent,
} from './siteContent.js'

// --- Контакты: значения по умолчанию и миграция v2 → v3 -----------------------

test('no stored config shows NNMC call center and coordinator numbers', () => {
  const { contacts } = readSiteContent(null)
  assert.equal(contacts.phone, DEFAULT_CONTACTS.phone)
  assert.equal(contacts.coordinatorMobile, DEFAULT_CONTACTS.coordinatorMobile)
  assert.equal(contacts.coordinatorPhone, DEFAULT_CONTACTS.coordinatorPhone)
})

test('v2 config with empty phone and messengers falls back to defaults', () => {
  // Так выглядит конфиг на проде: админка сохраняла пустые строки.
  const { contacts } = readSiteContent({
    version: 2,
    contacts: { phone: '', email: 'support@nnmc.kz', website: '', whatsapp: '', telegram: '', instagram: '' },
  })
  assert.equal(contacts.phone, DEFAULT_CONTACTS.phone)
  assert.equal(contacts.whatsapp, DEFAULT_CONTACTS.whatsapp)
  assert.equal(contacts.telegram, DEFAULT_CONTACTS.telegram)
  // У сайта и раньше было значение по умолчанию — пустое значит «скрыть».
  assert.equal(contacts.website, '')
  assert.equal(contacts.instagram, '')
})

test('v2 config keeps phone numbers the admin entered', () => {
  const { contacts } = readSiteContent({ version: 2, contacts: { phone: '+7 (7172) 11-22-33' } })
  assert.equal(contacts.phone, '+7 (7172) 11-22-33')
})

test('after saving, an empty phone stays hidden', () => {
  const saved = compactSiteContent({ ...readSiteContent(null), contacts: { ...DEFAULT_CONTACTS, phone: '  ', coordinatorPhone: '' } })
  assert.equal(saved.version, 4)
  const { contacts } = readSiteContent(saved)
  assert.equal(contacts.phone, '')
  assert.equal(contacts.coordinatorPhone, '')
  assert.equal(contacts.coordinatorMobile, DEFAULT_CONTACTS.coordinatorMobile)
})

test('v2/v3 config with untouched old defaults shows the new MedTour contacts', () => {
  // Так выглядит конфиг на проде: email и сайт сохранены со старыми значениями по умолчанию.
  const { contacts } = readSiteContent({
    version: 2,
    contacts: { phone: '', email: 'support@nnmc.kz', website: 'https://www.nnmc.kz/' },
  })
  assert.equal(contacts.phone, '+7 (7172) 57-74-40')
  assert.equal(contacts.coordinatorMobile, '+7 (700) 085-31-44')
  assert.equal(contacts.coordinatorPhone, '')
  assert.equal(contacts.email, 'medtour@nnmc.kz')
  assert.equal(contacts.website, 'https://nnmc.kz/')
  assert.equal(contacts.partnerWebsite, 'https://www.tomo.kz/')
  assert.equal(contacts.partnerEmail, 'info@tomo.kz')

  const v3 = readSiteContent({ version: 3, contacts: { phone: '+7 (7172) 57-20-09', coordinatorPhone: '+7 (7172) 57-74-40', email: 'team@nnmc.kz' } }).contacts
  assert.equal(v3.phone, '+7 (7172) 57-74-40')
  assert.equal(v3.coordinatorPhone, '')
  assert.equal(v3.email, 'team@nnmc.kz')
})

test('v4 config keeps whatever the admin saved, including old numbers', () => {
  const { contacts } = readSiteContent({ version: 4, contacts: { phone: '+7 (7172) 57-20-09', email: 'support@nnmc.kz', partnerEmail: '' } })
  assert.equal(contacts.phone, '+7 (7172) 57-20-09')
  assert.equal(contacts.email, 'support@nnmc.kz')
  assert.equal(contacts.partnerEmail, '')
})

test('partner name is stored per language', () => {
  const saved = compactSiteContent({ ...readSiteContent(null), contacts: { ...DEFAULT_CONTACTS, partnerName: { ru: 'Онкоцентр «Umit»', en: '' } } })
  assert.deepEqual(saved.contacts.partnerName, { ru: 'Онкоцентр «Umit»' })
  assert.deepEqual(readSiteContent(saved).contacts.partnerName, { ru: 'Онкоцентр «Umit»' })
})

// --- Ссылки и мессенджеры ----------------------------------------------------

test('all phone fields link as tel:', () => {
  assert.equal(contactKind('coordinatorMobile'), 'phone')
  assert.equal(contactKind('coordinatorPhone'), 'phone')
  assert.equal(contactKind('telegram'), 'telegram')
  assert.equal(contactKind('partnerWebsite'), 'website')
  assert.equal(contactKind('partnerEmail'), 'email')
})

test('messengers on the same number are matched regardless of formatting', () => {
  const kinds = messengersOnNumber(DEFAULT_CONTACTS, DEFAULT_CONTACTS.coordinatorMobile).map(({ kind }) => kind)
  assert.deepEqual(kinds, ['whatsapp', 'telegram'])
  assert.deepEqual(messengersOnNumber(DEFAULT_CONTACTS, DEFAULT_CONTACTS.phone), [])
})

test('a messenger on another number is not attached to the phone', () => {
  const contacts = { ...DEFAULT_CONTACTS, telegram: '@nnmc_medtour' }
  const kinds = messengersOnNumber(contacts, contacts.coordinatorMobile).map(({ kind }) => kind)
  assert.deepEqual(kinds, ['whatsapp'])
})

test('a phone without digits is not a link', () => {
  assert.equal(contactHref('phone', 'звоните нам'), '')
  assert.equal(contactHref('whatsapp', 'n/a'), '')
  assert.equal(contactHref('phone', '103'), 'tel:103')
  assert.equal(contactHref('phone', '+7 (7172) 57-20-09'), 'tel:+77172572009')
})
