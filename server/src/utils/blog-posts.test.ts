import test from 'node:test';
import assert from 'node:assert/strict';
import { pickText, slugify, validateBlogPost } from './blog-posts';

test('slug transliterates Russian and Kazakh titles', () => {
  assert.equal(slugify('Первый день в столице: мягкий маршрут'), 'pervyy-den-v-stolitse-myagkiy-marshrut');
  assert.equal(slugify('Қазақстанға саяхат'), 'kazakstanga-sayahat');
  assert.equal(slugify('  Burabay — 1 day!  '), 'burabay-1-day');
  assert.equal(slugify('???'), '');
});

test('text falls back to Russian, then to any language', () => {
  assert.equal(pickText({ ru: 'Привет', en: 'Hello' }, 'en'), 'Hello');
  assert.equal(pickText({ ru: 'Привет', en: '  ' }, 'en'), 'Привет');
  assert.equal(pickText({ kk: 'Сәлем' }, 'en'), 'Сәлем');
  assert.equal(pickText(null, 'ru'), '');
});

test('create keeps only known fields and trims texts', () => {
  const { data } = validateBlogPost({
    title: { ru: ' Статья ', en: '' }, excerpt: { ru: 'Кратко' }, category: 'routes', readTime: '7',
    isActive: 1, coverUrl: '/tourism/astana.jpg', cover: 12, id: 5, documentId: 'x',
  });
  assert.deepEqual(data, {
    title: { ru: 'Статья' }, excerpt: { ru: 'Кратко' }, category: 'routes', readTime: 7,
    isActive: true, coverUrl: '/tourism/astana.jpg', cover: 12,
  });
});

test('create requires a title; a partial update does not', () => {
  assert.match(validateBlogPost({ title: { ru: '  ' } }).error, /title is required/);
  assert.match(validateBlogPost({}).error, /title is required/);
  assert.deepEqual(validateBlogPost({ isActive: false }, { partial: true }).data, { isActive: false });
});

test('rejects unsafe or malformed values', () => {
  assert.match(validateBlogPost({ title: { ru: 'a' }, title2: 1, content: { fr: 'x' } }).error, /unsupported language/);
  assert.match(validateBlogPost({ title: { ru: 'a' }, slug: 'Мой slug' }).error, /slug/);
  assert.match(validateBlogPost({ title: { ru: 'a' }, category: 'news' }).error, /category/);
  assert.match(validateBlogPost({ title: { ru: 'a' }, coverUrl: 'javascript:alert(1)' }).error, /coverUrl/);
  assert.match(validateBlogPost({ title: { ru: 'a' }, coverUrl: '//evil.example/x.png' }).error, /coverUrl/);
  assert.match(validateBlogPost({ title: { ru: 'a' }, readTime: 2.5 }).error, /readTime/);
  assert.match(validateBlogPost({ title: { ru: 'a' }, cover: 'abc' }).error, /cover/);
});

test('empty optional values clear the field', () => {
  const { data } = validateBlogPost({ title: { ru: 'a' }, slug: '', coverUrl: ' ', cover: null, readTime: '' });
  assert.deepEqual(data, { title: { ru: 'a' }, slug: '', coverUrl: null, cover: null, readTime: null });
});
