import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryLabel, localizePost, pickFeatured, readTimeLabel } from './blog.js'

test('read time uses Russian plural forms', () => {
  assert.equal(readTimeLabel(1, 'ru'), '1 минута')
  assert.equal(readTimeLabel(3, 'ru'), '3 минуты')
  assert.equal(readTimeLabel(6, 'ru'), '6 минут')
  assert.equal(readTimeLabel(21, 'ru'), '21 минута')
  assert.equal(readTimeLabel(6, 'en'), '6 min')
  assert.equal(readTimeLabel(6, 'kk'), '6 минут')
  assert.equal(readTimeLabel(null, 'ru'), '')
})

test('post falls back to Russian text and prefers the uploaded cover', () => {
  const post = {
    title: { ru: 'Статья', en: 'Article' }, excerpt: { ru: 'Кратко' }, content: {},
    category: 'routes', readTime: 8, cover: { url: '/uploads/a.jpg' }, coverUrl: '/tourism/astana.jpg',
  }
  const view = localizePost(post, 'en', (media) => `https://api.test${media.url}`)
  assert.equal(view.title, 'Article')
  assert.equal(view.excerpt, 'Кратко')
  assert.equal(view.content, '')
  assert.equal(view.image, 'https://api.test/uploads/a.jpg')
  assert.equal(view.categoryLabel, 'Routes')
  assert.equal(view.read, '8 min')
  assert.equal(localizePost({ ...post, cover: null }, 'ru').image, '/tourism/astana.jpg')
})

test('unknown category has no label; featured falls back to the first post', () => {
  assert.equal(categoryLabel('news', 'ru'), '')
  assert.equal(pickFeatured([{ id: 1 }, { id: 2, isFeatured: true }]).id, 2)
  assert.equal(pickFeatured([{ id: 1 }, { id: 2 }]).id, 1)
  assert.equal(pickFeatured([]), null)
})
