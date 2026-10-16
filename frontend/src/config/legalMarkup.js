// Разметка правовых документов (оферта, согласия) — её правит админ в
// Admin > Правовые документы. Сервер хранит текст как есть, страница
// /documents/:slug разбирает его здесь.
//
//   # Заголовок части {#id}    подряд идущие «#» — один заголовок с подзаголовком;
//                              {#id} — якорь для ссылок вида /documents/consent#id
//   ## Раздел {#id}
//   ### Подзаголовок
//   - пункт списка
//   > примечание               «> ОБРАЗЕЦ» — пометка образца формы
//   | ячейка | ячейка |        строка таблицы
//   **жирный**, [текст](/ссылка)
//   \# …                       строка, которая начинается с символа разметки
//
// Остальные строки — абзацы. Пустые строки ничего не значат.

export const LEGAL_LANGS = ['ru', 'kk', 'en', 'zh']

// Язык текста документа — свой параметр адреса: ?lang= уже занят языком интерфейса
// (его читает i18next и запоминает), а китайского интерфейса у сайта нет.
export const DOC_LANG_PARAM = 'docLang'

/** Ссылка на другой документ сохраняет выбранный язык текста. */
export function withDocLang(href, docLang) {
  if (!docLang || !href.startsWith('/documents/')) return href
  const url = new URL(href, 'https://medtour.local')
  url.searchParams.set(DOC_LANG_PARAM, docLang)
  return `${url.pathname}${url.search}${url.hash}`
}
// Названия языков — на самих языках: посетитель ищет свой.
export const LEGAL_LANG_NAMES = { ru: 'Русский', kk: 'Қазақша', en: 'English', zh: '中文' }

/** «2026-09-24» → «24 сентября 2026 г.» на языке интерфейса. */
export function formatRevisionDate(date, lang) {
  if (!date) return ''
  const locale = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-GB' }[lang] || 'ru-RU'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export const SAMPLE_WORDS = new Set(['ОБРАЗЕЦ', 'ҮЛГІ', 'SAMPLE', 'TEMPLATE', '样本', '样例', '范本', '模板'])

const startsLowercase = (text) => { const ch = text.charAt(0); return ch !== ch.toUpperCase() && ch === ch.toLowerCase() }
const isUppercase = (text) => /\p{L}/u.test(text) && text === text.toUpperCase()

const ANCHOR = /\s*\{#([a-z0-9][a-z0-9-]*)\}\s*$/i

function splitAnchor(text) {
  const match = text.match(ANCHOR)
  return match ? { text: text.slice(0, match.index).trim(), id: match[1].toLowerCase() } : { text: text.trim(), id: null }
}

/** Текст → блоки страницы и оглавление (части и разделы). */
export function parseLegalMarkup(source) {
  const blocks = []
  const toc = []
  const usedIds = new Set()
  let partIndex = 0
  let sectionIndex = 0

  const uniqueId = (wanted, fallback) => {
    let id = wanted || fallback
    for (let n = 2; usedIds.has(id); n += 1) id = `${wanted || fallback}-${n}`
    usedIds.add(id)
    return id
  }
  const last = () => blocks[blocks.length - 1]

  for (const rawLine of String(source || '').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('# ')) {
      const { text, id } = splitAnchor(line.slice(2))
      if (last()?.type === 'part' && !last().closed) {
        const lines = last().lines
        // В Word длинный заголовок часто разорван на строки: продолжение со строчной
        // буквы приклеиваем к предыдущей. После строки ЗАГЛАВНЫМИ это подзаголовок.
        if (startsLowercase(text) && !isUppercase(lines[lines.length - 1])) {
          lines[lines.length - 1] = `${lines[lines.length - 1]} ${text}`
          if (lines.length === 1) toc[toc.length - 1].text = lines[0]
        } else {
          lines.push(text)
        }
      } else {
        partIndex += 1
        const block = { type: 'part', id: uniqueId(id, `part-${partIndex}`), lines: [text] }
        blocks.push(block)
        toc.push({ id: block.id, level: 1, text })
      }
      continue
    }
    if (last()?.type === 'part') last().closed = true

    if (line.startsWith('## ')) {
      const { text, id } = splitAnchor(line.slice(3))
      sectionIndex += 1
      const block = { type: 'section', id: uniqueId(id, `section-${sectionIndex}`), text }
      blocks.push(block)
      toc.push({ id: block.id, level: 2, text })
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'subheading', text: line.slice(4).trim() })
    } else if (line.startsWith('- ')) {
      if (last()?.type === 'list') last().items.push(line.slice(2).trim())
      else blocks.push({ type: 'list', items: [line.slice(2).trim()] })
    } else if (line.startsWith('>')) {
      const text = line.replace(/^>\s?/, '').trim()
      if (SAMPLE_WORDS.has(text.replace(/[\s:.]+$/, '').toUpperCase())) blocks.push({ type: 'sample', text })
      else if (last()?.type === 'note') last().lines.push(text)
      else blocks.push({ type: 'note', lines: [text] })
    } else if (line.startsWith('|')) {
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
      if (last()?.type === 'table') last().rows.push(cells)
      else blocks.push({ type: 'table', rows: [cells] })
    } else {
      const text = line.replace(/^\\(?=[#>|-])/, '')
      blocks.push({ type: 'paragraph', text, caption: /^[(（].*[)）]$/.test(text) })
    }
  }

  for (const block of blocks) delete block.closed
  return { blocks, toc }
}

const SAFE_HREF = /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i

/** Ссылка из разметки: только относительные, якоря, http(s), mailto и tel. */
export function safeHref(href) {
  const value = String(href || '').trim()
  return SAFE_HREF.test(value) ? value : ''
}

/** Строка → куски для вывода: текст, **жирный** и [ссылки](...). */
export function parseInline(text) {
  const parts = []
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*/g
  let cursor = 0
  for (const match of String(text || '').matchAll(pattern)) {
    if (match.index > cursor) parts.push({ type: 'text', text: text.slice(cursor, match.index) })
    if (match[1] !== undefined) {
      const href = safeHref(match[2])
      parts.push(href ? { type: 'link', text: match[1], href } : { type: 'text', text: match[1] })
    } else {
      parts.push({ type: 'bold', text: match[3] })
    }
    cursor = match.index + match[0].length
  }
  if (cursor < String(text || '').length) parts.push({ type: 'text', text: text.slice(cursor) })
  return parts
}
