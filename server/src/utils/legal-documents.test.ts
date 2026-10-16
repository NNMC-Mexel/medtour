import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGAL_LIMITS,
  availableLanguages,
  mergeLocalized,
  resolveLanguage,
  validateLegalUpdate,
} from './legal-documents';

test('available languages ignore empty and non-string texts', () => {
  assert.deepEqual(availableLanguages({ ru: 'текст', kk: '  ', en: 5, zh: '文本' }), ['ru', 'zh']);
  assert.deepEqual(availableLanguages(null), []);
});

test('language falls back to Russian, then to the first available', () => {
  assert.equal(resolveLanguage({ ru: 'a', zh: 'b' }, 'zh'), 'zh');
  assert.equal(resolveLanguage({ ru: 'a', zh: 'b' }, 'en'), 'ru');
  assert.equal(resolveLanguage({ kk: 'a', zh: 'b' }, 'fr'), 'kk');
  assert.equal(resolveLanguage({}, 'ru'), null);
});

test('update keeps only known fields and languages', () => {
  const { data } = validateLegalUpdate({ title: { ru: 'Оферта' }, body: { zh: '文本' }, revisionDate: '2026-09-24', slug: 'hack', id: 1 });
  assert.deepEqual(data, { title: { ru: 'Оферта' }, body: { zh: '文本' }, revisionDate: '2026-09-24' });
});

test('update rejects unknown languages, wrong types and oversized texts', () => {
  assert.match(validateLegalUpdate({ body: { fr: 'x' } }).error, /unsupported language/);
  assert.match(validateLegalUpdate({ body: { ru: 1 } }).error, /must be a string/);
  assert.match(validateLegalUpdate({ body: ['x'] }).error, /object keyed by language/);
  assert.match(validateLegalUpdate({ title: { ru: 'x'.repeat(LEGAL_LIMITS.title + 1) } }).error, /longer than/);
  assert.match(validateLegalUpdate({ body: { ru: 'x'.repeat(LEGAL_LIMITS.body + 1) } }).error, /longer than/);
  assert.match(validateLegalUpdate({}).error, /Nothing to update/);
  assert.match(validateLegalUpdate('x').error, /must be an object/);
});

test('revision date must be a real calendar date or empty', () => {
  assert.equal(validateLegalUpdate({ revisionDate: '' }).data.revisionDate, null);
  assert.equal(validateLegalUpdate({ revisionDate: null }).data.revisionDate, null);
  assert.match(validateLegalUpdate({ revisionDate: '24.09.2026' }).error, /YYYY-MM-DD/);
  assert.match(validateLegalUpdate({ revisionDate: '2026-13-40' }).error, /YYYY-MM-DD/);
});

test('merge replaces sent languages, keeps the rest, empty string removes a language', () => {
  assert.deepEqual(
    mergeLocalized({ ru: 'старый', kk: 'ескі', zh: '旧' }, { ru: 'новый', zh: '' }),
    { ru: 'новый', kk: 'ескі' },
  );
  assert.deepEqual(mergeLocalized(null, { en: 'new' }), { en: 'new' });
});
