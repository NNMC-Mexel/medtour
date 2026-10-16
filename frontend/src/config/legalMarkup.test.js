import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseInline, parseLegalMarkup, safeHref } from './legalMarkup.js'

test('consecutive # lines form one part heading; anchors become ids', () => {
  const { blocks, toc } = parseLegalMarkup('# Приложение № 1 {#appendix-1}\n# Условия работы\n## 1. Регистрация\nТекст')
  assert.deepEqual(blocks[0], { type: 'part', id: 'appendix-1', lines: ['Приложение № 1', 'Условия работы'] })
  assert.deepEqual(toc, [{ id: 'appendix-1', level: 1, text: 'Приложение № 1' }, { id: 'section-1', level: 2, text: '1. Регистрация' }])
})

test('a paragraph between # lines starts a new part', () => {
  const { blocks } = parseLegalMarkup('# Первая\nабзац\n# Вторая')
  assert.equal(blocks.filter((b) => b.type === 'part').length, 2)
})

test('lists, notes, sample marker, tables and captions', () => {
  const { blocks } = parseLegalMarkup('- a\n- b\n> ПРИМЕЧАНИЕ:\n> текст\n> ОБРАЗЕЦ\n| ФИО | Телефон |\n| 1. | |\n(подпись)\n\\# не заголовок')
  assert.deepEqual(blocks.map((b) => b.type), ['list', 'note', 'sample', 'table', 'paragraph', 'paragraph'])
  assert.deepEqual(blocks[0].items, ['a', 'b'])
  assert.deepEqual(blocks[1].lines, ['ПРИМЕЧАНИЕ:', 'текст'])
  assert.deepEqual(blocks[3].rows, [['ФИО', 'Телефон'], ['1.', '']])
  assert.equal(blocks[4].caption, true)
  assert.equal(blocks[5].text, '# не заголовок')
})

test('duplicate anchors get a suffix', () => {
  const { toc } = parseLegalMarkup('# A {#x}\nтекст\n# B {#x}')
  assert.deepEqual(toc.map((t) => t.id), ['x', 'x-2'])
})

test('inline bold and links; unsafe links render as plain text', () => {
  assert.deepEqual(parseInline('см. [прейскурант](/prices) и **важно**'), [
    { type: 'text', text: 'см. ' }, { type: 'link', text: 'прейскурант', href: '/prices' },
    { type: 'text', text: ' и ' }, { type: 'bold', text: 'важно' },
  ])
  assert.deepEqual(parseInline('[x](javascript:alert(1))'), [{ type: 'text', text: 'x' }, { type: 'text', text: ')' }])
  assert.equal(safeHref('//evil.com'), '')
  assert.equal(safeHref('data:text/html,1'), '')
  assert.equal(safeHref('/documents/consent#personal-data'), '/documents/consent#personal-data')
})

// Исходные тексты, которые сервер загружает при первом запуске.
const seeds = ['offer', 'consent'].map((slug) => JSON.parse(fs.readFileSync(new URL(`../../../server/src/api/legal-document/seed/${slug}.json`, import.meta.url), 'utf8')))

test('seed documents: same part anchors in every language', () => {
  for (const seed of seeds) {
    const anchors = Object.fromEntries(Object.entries(seed.body).map(([lang, text]) => [lang, parseLegalMarkup(text).toc.filter((t) => t.level === 1 && !t.id.startsWith('part-')).map((t) => t.id)]))
    for (const lang of ['kk', 'en', 'zh']) assert.deepEqual(anchors[lang], anchors.ru, `${seed.slug}.${lang}`)
  }
})

test('seed documents: offer has sections 1–10 in every language', () => {
  const offer = seeds.find((s) => s.slug === 'offer')
  for (const [lang, text] of Object.entries(offer.body)) {
    const numbers = parseLegalMarkup(text).toc.filter((t) => t.level === 2).map((t) => parseInt(t.text, 10)).slice(0, 10)
    assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], lang)
  }
})

test('seed documents: every link points to an existing page or anchor', () => {
  const anchors = new Map(seeds.map((s) => [s.slug, new Set(parseLegalMarkup(s.body.ru).toc.map((t) => t.id))]))
  for (const seed of seeds) {
    for (const [lang, text] of Object.entries(seed.body)) {
      for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        assert.ok(safeHref(href), `${seed.slug}.${lang}: ${href}`)
        const doc = href.match(/^\/documents\/([a-z-]+)(?:#(.+))?$/)
        if (doc) assert.ok(anchors.get(doc[1])?.has(doc[2]), `${seed.slug}.${lang}: ${href}`)
        else assert.equal(href, '/prices', `${seed.slug}.${lang}: ${href}`)
      }
    }
  }
})

test('heading broken across lines in Word: lowercase continuation is merged, caps title keeps its subtitle', () => {
  const merged = parseLegalMarkup('# Информированное согласие пациента на получение услуг {#x}\n# в условиях стационара')
  assert.deepEqual(merged.blocks[0].lines, ['Информированное согласие пациента на получение услуг в условиях стационара'])
  assert.equal(merged.toc[0].text, 'Информированное согласие пациента на получение услуг в условиях стационара')
  const subtitle = parseLegalMarkup('# ПУБЛИЧНЫЙ ДОГОВОР-ОФЕРТА\n# по предоставлению платных медицинских услуг')
  assert.deepEqual(subtitle.blocks[0].lines, ['ПУБЛИЧНЫЙ ДОГОВОР-ОФЕРТА', 'по предоставлению платных медицинских услуг'])
  assert.deepEqual(parseLegalMarkup('# 公开要约合同附件 1\n# 网络门户网站工作条件').blocks[0].lines, ['公开要约合同附件 1', '网络门户网站工作条件'])
})

test('links to other documents keep the chosen document language', async () => {
  const { withDocLang } = await import('./legalMarkup.js')
  assert.equal(withDocLang('/documents/consent#personal-data', 'zh'), '/documents/consent?docLang=zh#personal-data')
  assert.equal(withDocLang('/documents/consent#personal-data', null), '/documents/consent#personal-data')
  assert.equal(withDocLang('/prices', 'zh'), '/prices')
})
