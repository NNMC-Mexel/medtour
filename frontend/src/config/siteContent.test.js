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
  assert.equal(saved.version, 3)
  const { contacts } = readSiteContent(saved)
  assert.equal(contacts.phone, '')
  assert.equal(contacts.coordinatorPhone, '')
  assert.equal(contacts.coordinatorMobile, DEFAULT_CONTACTS.coordinatorMobile)
})

// --- Ссылки и мессенджеры ----------------------------------------------------

test('all phone fields link as tel:', () => {
  assert.equal(contactKind('coordinatorMobile'), 'phone')
  assert.equal(contactKind('coordinatorPhone'), 'phone')
  assert.equal(contactKind('telegram'), 'telegram')
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
