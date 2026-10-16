import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ExternalLink, Eye, FileText, RefreshCcw, RotateCcw, Save, SplitSquareHorizontal } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import LegalDocumentBody from '../../components/legal/LegalDocumentBody'
import { LEGAL_LANGS, LEGAL_LANG_NAMES, parseLegalMarkup } from '../../config/legalMarkup'
import { legalDocumentsAPI } from '../../services/api'
import { cn } from '../../utils/helpers'

const COPY = {
  ru: {
    documents: 'Документ', language: 'Язык текста', titleLabel: 'Название документа', bodyLabel: 'Текст документа',
    revision: 'Дата редакции', revisionHint: 'Показывается на странице документа. По оферте новая редакция публикуется не позднее чем за 10 дней до вступления в силу.',
    save: 'Сохранить', reset: 'Отменить изменения', reload: 'Обновить', open: 'Открыть на сайте',
    edit: 'Текст', preview: 'Предпросмотр', split: 'Рядом', empty: 'нет текста',
    saved: 'Документ сохранён — страница на сайте уже обновлена', saveError: 'Не удалось сохранить документ',
    conflict: 'Документ успел изменить другой администратор. Обновите страницу: ваши правки нужно будет внести заново.',
    backupFound: (time) => `Найдена несохранённая правка от ${time}: сессия могла истечь или вкладка закрылась до сохранения.`,
    backupStale: 'С тех пор документ на сервере изменился — после восстановления проверьте текст перед сохранением.',
    restore: 'Восстановить', discard: 'Удалить',
    loadError: 'Не удалось загрузить документ', unsaved: 'Есть несохранённые изменения', leaveConfirm: 'Изменения в документе не сохранены. Уйти без сохранения?',
    stats: (parts, sections) => `Частей: ${parts}, разделов: ${sections}`,
    missingAnchors: (ids) => `В этом языке нет частей, на которые ведут ссылки с сайта: ${ids}. Проверьте строки «# … {#якорь}».`,
    emptyBody: 'Нет текста на этом языке — посетители, выбравшие его, увидят русскую версию.',
    help: 'Как оформлять текст',
    helpRows: [
      ['# Заголовок части {#id}', 'Подряд идущие строки «#» — один заголовок с подзаголовком. {#id} — якорь для ссылок, его не переводят.'],
      ['## 1. Раздел', 'Раздел — попадает в оглавление.'],
      ['### Подзаголовок', 'Жирная строка внутри раздела.'],
      ['- пункт', 'Пункт списка.'],
      ['> Примечание', 'Выделенный блок. «> ОБРАЗЕЦ» — пометка образца формы.'],
      ['| ячейка | ячейка |', 'Строка таблицы.'],
      ['**жирный**, [текст](/prices)', 'Выделение и ссылка. Ссылки — только на страницы сайта, http(s), почту и телефон.'],
    ],
  },
  en: {
    documents: 'Document', language: 'Text language', titleLabel: 'Document title', bodyLabel: 'Document text',
    revision: 'Version date', revisionHint: 'Shown on the document page. Under the offer, a new version is published at least 10 days before it takes effect.',
    save: 'Save', reset: 'Discard changes', reload: 'Reload', open: 'Open on site',
    edit: 'Text', preview: 'Preview', split: 'Side by side', empty: 'no text',
    saved: 'Document saved — the page on the site is already updated', saveError: 'Could not save the document',
    conflict: 'Another administrator changed this document. Reload the page and apply your edits again.',
    backupFound: (time) => `Unsaved edits from ${time} were found: the session may have expired or the tab was closed before saving.`,
    backupStale: 'The document has changed on the server since then — review the text after restoring, before saving.',
    restore: 'Restore', discard: 'Discard',
    loadError: 'Could not load the document', unsaved: 'Unsaved changes', leaveConfirm: 'Document changes are not saved. Leave anyway?',
    stats: (parts, sections) => `Parts: ${parts}, sections: ${sections}`,
    missingAnchors: (ids) => `This language is missing parts that site links point to: ${ids}. Check the "# … {#anchor}" lines.`,
    emptyBody: 'No text in this language — visitors who choose it will see the Russian version.',
    help: 'Formatting guide',
    helpRows: [
      ['# Part heading {#id}', 'Consecutive "#" lines form one heading with a subtitle. {#id} is a link anchor; do not translate it.'],
      ['## 1. Section', 'Section — shown in the table of contents.'],
      ['### Subheading', 'Bold line inside a section.'],
      ['- item', 'List item.'],
      ['> Note', 'Highlighted block. "> SAMPLE" marks a form template.'],
      ['| cell | cell |', 'Table row.'],
      ['**bold**, [text](/prices)', 'Emphasis and link. Links may point to site pages, http(s), email and phone only.'],
    ],
  },
  kk: {
    documents: 'Құжат', language: 'Мәтін тілі', titleLabel: 'Құжат атауы', bodyLabel: 'Құжат мәтіні',
    revision: 'Редакция күні', revisionHint: 'Құжат бетінде көрсетіледі. Оферта бойынша жаңа редакция күшіне енуінен кемінде 10 күн бұрын жарияланады.',
    save: 'Сақтау', reset: 'Өзгерістерді болдырмау', reload: 'Жаңарту', open: 'Сайтта ашу',
    edit: 'Мәтін', preview: 'Алдын ала қарау', split: 'Қатар', empty: 'мәтін жоқ',
    saved: 'Құжат сақталды — сайттағы бет жаңартылды', saveError: 'Құжатты сақтау мүмкін болмады',
    conflict: 'Бұл құжатты басқа әкімші өзгертті. Бетті жаңартып, өзгерістеріңізді қайта енгізіңіз.',
    backupFound: (time) => `${time} сақталмаған өзгерістер табылды: сессия аяқталған не бет сақталмай жабылған болуы мүмкін.`,
    backupStale: 'Содан бері құжат серверде өзгерді — қалпына келтіргеннен кейін сақтау алдында мәтінді тексеріңіз.',
    restore: 'Қалпына келтіру', discard: 'Жою',
    loadError: 'Құжатты жүктеу мүмкін болмады', unsaved: 'Сақталмаған өзгерістер бар', leaveConfirm: 'Құжаттағы өзгерістер сақталмаған. Сақтамай шығасыз ба?',
    stats: (parts, sections) => `Бөліктер: ${parts}, бөлімдер: ${sections}`,
    missingAnchors: (ids) => `Бұл тілде сайттағы сілтемелер апаратын бөліктер жоқ: ${ids}. «# … {#якорь}» жолдарын тексеріңіз.`,
    emptyBody: 'Бұл тілде мәтін жоқ — оны таңдаған келушілер орысша нұсқаны көреді.',
    help: 'Мәтінді қалай рәсімдеу керек',
    helpRows: [
      ['# Бөлік тақырыбы {#id}', 'Қатар тұрған «#» жолдары — бір тақырып пен тақырыпша. {#id} — сілтеме якоры, аударылмайды.'],
      ['## 1. Бөлім', 'Бөлім — мазмұнға кіреді.'],
      ['### Тақырыпша', 'Бөлім ішіндегі жуан жол.'],
      ['- тармақ', 'Тізім тармағы.'],
      ['> Ескертпе', 'Бөлектелген блок. «> ҮЛГІ» — нысан үлгісінің белгісі.'],
      ['| ұяшық | ұяшық |', 'Кесте жолы.'],
      ['**жуан**, [мәтін](/prices)', 'Бөлектеу және сілтеме. Сілтемелер тек сайт беттеріне, http(s), поштаға және телефонға.'],
    ],
  },
}

const explicitAnchors = (text) => parseLegalMarkup(text).toc
  .filter((item) => item.level === 1 && !item.id.startsWith('part-'))
  .map((item) => item.id)

// Несохранённая правка дублируется в браузер: если сессия истечёт при сохранении
// (админку перекинет на вход) или вкладка закроется, большой текст не пропадёт.
const backupKey = (slug) => `medtour-legal-draft:${slug}`
const readBackup = (slug) => { try { return JSON.parse(localStorage.getItem(backupKey(slug)) || 'null') } catch { return null } }
const writeBackup = (slug, value) => { try { localStorage.setItem(backupKey(slug), JSON.stringify(value)) } catch { /* хранилище недоступно */ } }
const dropBackup = (slug) => { try { localStorage.removeItem(backupKey(slug)) } catch { /* хранилище недоступно */ } }

const snapshotOf = (doc) => JSON.stringify({ title: doc?.title || {}, body: doc?.body || {}, revisionDate: doc?.revisionDate || '' })

export default function AdminLegalDocuments() {
  const { i18n } = useTranslation()
  const uiLang = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const copy = COPY[uiLang]
  const toast = useToast()

  const [list, setList] = useState([])
  const [slug, setSlug] = useState(null)
  const [saved, setSaved] = useState(null)      // документ как на сервере
  const [draft, setDraft] = useState(null)      // правки в редакторе
  const [lang, setLang] = useState('ru')
  const [mode, setMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'split' : 'edit'))
  const [status, setStatus] = useState('loading')
  const [isSaving, setIsSaving] = useState(false)
  const [backup, setBackup] = useState(null)

  const isDirty = Boolean(saved && draft && snapshotOf(saved) !== snapshotOf(draft))

  useEffect(() => {
    legalDocumentsAPI.list()
      .then((response) => {
        const docs = response.data?.data || []
        setList(docs)
        setSlug((current) => current || docs[0]?.slug || null)
        if (!docs.length) setStatus('error')
      })
      .catch(() => setStatus('error'))
  }, [])

  const loadDocument = useCallback(async (target) => {
    if (!target) return
    setStatus('loading')
    try {
      const response = await legalDocumentsAPI.getForEdit(target)
      const doc = response.data?.data
      setSaved(doc)
      setDraft({ ...doc, revisionDate: doc.revisionDate || '' })
      const stored = readBackup(target)
      setBackup(stored && snapshotOf(stored) !== snapshotOf(doc) ? stored : null)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])
  useEffect(() => { loadDocument(slug) }, [slug, loadDocument])

  useEffect(() => {
    if (!isDirty) return undefined
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = copy.leaveConfirm
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [copy.leaveConfirm, isDirty])

  const backupDraft = useCallback(() => writeBackup(slug, {
    savedAt: new Date().toISOString(),
    baseUpdatedAt: saved?.updatedAt,
    title: draft?.title,
    body: draft?.body,
    revisionDate: draft?.revisionDate,
  }), [slug, saved?.updatedAt, draft])

  // Пока есть несохранённая правка — держим её копию в браузере (раз в секунду
  // и обязательно перед сохранением: оно может упасть с 401 и увести на вход).
  useEffect(() => {
    if (!isDirty || !slug) return undefined
    const timer = setTimeout(backupDraft, 1000)
    return () => clearTimeout(timer)
  }, [isDirty, slug, backupDraft])

  const switchDocument = (next) => {
    if (next === slug) return
    if (isDirty) {
      if (!window.confirm(copy.leaveConfirm)) return
      dropBackup(slug)                          // админ сам решил уйти без сохранения
    }
    setSlug(next)
  }

  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: { ...(current[field] || {}), [lang]: value } }))

  const body = draft?.body?.[lang] || ''
  const parsed = useMemo(() => parseLegalMarkup(body), [body])
  const missingAnchors = useMemo(() => {
    if (!draft || lang === 'ru' || !body.trim()) return []
    const own = new Set(explicitAnchors(body))
    return explicitAnchors(draft.body?.ru || '').filter((id) => !own.has(id))
  }, [draft, lang, body])

  const save = async () => {
    backupDraft()
    setIsSaving(true)
    try {
      // Отправляем только изменённые языки — меньше риск затереть чужую правку.
      const changed = (field) => Object.fromEntries(LEGAL_LANGS
        .filter((code) => (draft[field]?.[code] || '') !== (saved[field]?.[code] || ''))
        .map((code) => [code, draft[field]?.[code] || '']))
      const payload = { expectedUpdatedAt: saved.updatedAt }
      const title = changed('title')
      const bodyPatch = changed('body')
      if (Object.keys(title).length) payload.title = title
      if (Object.keys(bodyPatch).length) payload.body = bodyPatch
      if ((draft.revisionDate || '') !== (saved.revisionDate || '')) payload.revisionDate = draft.revisionDate || null
      const response = await legalDocumentsAPI.update(slug, payload)
      const doc = response.data?.data
      setSaved(doc)
      setDraft({ ...doc, revisionDate: doc.revisionDate || '' })
      dropBackup(slug)
      setBackup(null)
      setList((current) => current.map((item) => (item.slug === slug ? { ...item, title: doc.title, revisionDate: doc.revisionDate } : item)))
      toast.success(copy.saved)
    } catch (error) {
      if (error?.response?.status === 409) toast.error(copy.conflict)
      else toast.error(error?.response?.data?.error?.message ? `${copy.saveError}: ${error.response.data.error.message}` : copy.saveError)
    } finally {
      setIsSaving(false)
    }
  }

  const editor = draft && (
    <textarea
      aria-label={`${copy.bodyLabel} (${LEGAL_LANG_NAMES[lang]})`}
      lang={lang}
      value={body}
      onChange={(event) => setField('body', event.target.value)}
      spellCheck={false}
      className='h-[70vh] min-h-[420px] w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 font-mono text-[13px] leading-6 text-slate-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500'
    />
  )
  const preview = draft && (
    <div className='h-[70vh] min-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white px-6 py-8'>
      <LegalDocumentBody blocks={parsed.blocks} lang={lang} />
    </div>
  )

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div role='tablist' aria-label={copy.documents} className='flex flex-wrap gap-2'>
          {list.map((doc) => (
            <button
              key={doc.slug}
              type='button'
              role='tab'
              aria-selected={slug === doc.slug}
              onClick={() => switchDocument(doc.slug)}
              className={cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors', slug === doc.slug ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
            >
              <FileText className='h-4 w-4' />{doc.title?.[uiLang] || doc.title?.ru || doc.slug}
            </button>
          ))}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {isDirty && <span className='text-sm font-medium text-amber-600'>{copy.unsaved}</span>}
          {slug && (
            <a href={`/documents/${slug}?docLang=${lang}`} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50'>
              {copy.open}<ExternalLink className='h-4 w-4' />
            </a>
          )}
          <Button variant='ghost' onClick={() => { if (isDirty) { setDraft({ ...saved, revisionDate: saved.revisionDate || '' }); dropBackup(slug) } else loadDocument(slug) }} disabled={isSaving || status !== 'ready'} leftIcon={isDirty ? <RotateCcw className='h-4 w-4' /> : <RefreshCcw className='h-4 w-4' />}>
            {isDirty ? copy.reset : copy.reload}
          </Button>
          <Button onClick={save} isLoading={isSaving} disabled={!isDirty} leftIcon={<Save className='h-4 w-4' />}>{copy.save}</Button>
        </div>
      </div>

      {backup && status === 'ready' && !isDirty && (
        <div className='flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p>{copy.backupFound(new Date(backup.savedAt).toLocaleString(uiLang))}</p>
            {backup.baseUpdatedAt !== saved?.updatedAt && <p className='mt-1 font-medium'>{copy.backupStale}</p>}
          </div>
          <div className='flex shrink-0 gap-2'>
            <Button size='sm' onClick={() => { setDraft({ ...saved, title: backup.title, body: backup.body, revisionDate: backup.revisionDate || '' }); setBackup(null) }}>{copy.restore}</Button>
            <Button size='sm' variant='ghost' onClick={() => { dropBackup(slug); setBackup(null) }}>{copy.discard}</Button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className='rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
          {copy.loadError}{' '}
          <button type='button' className='font-semibold underline' onClick={() => loadDocument(slug)}>{copy.reload}</button>
        </div>
      )}

      {status !== 'error' && (
        <section className='rounded-3xl border border-slate-200 bg-white p-5 sm:p-7'>
          {!draft ? (
            <div className='h-96 animate-pulse rounded-2xl bg-slate-100' />
          ) : (
            <div className='space-y-5'>
              <div className='grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]'>
                <Input label={`${copy.titleLabel} (${LEGAL_LANG_NAMES[lang]})`} value={draft.title?.[lang] || ''} onChange={(event) => setField('title', event.target.value)} maxLength={300} lang={lang} />
                <Input label={copy.revision} type='date' value={draft.revisionDate || ''} onChange={(event) => setDraft((current) => ({ ...current, revisionDate: event.target.value }))} />
              </div>
              <p className='-mt-2 text-xs text-slate-500'>{copy.revisionHint}</p>

              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div role='tablist' aria-label={copy.language} className='inline-flex flex-wrap rounded-xl bg-slate-100 p-1'>
                  {LEGAL_LANGS.map((code) => {
                    const hasText = Boolean(draft.body?.[code]?.trim())
                    return (
                      <button
                        key={code}
                        type='button'
                        role='tab'
                        lang={code}
                        aria-selected={lang === code}
                        onClick={() => setLang(code)}
                        className={cn('rounded-lg px-4 py-2 text-sm font-semibold transition-colors', lang === code ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                      >
                        {LEGAL_LANG_NAMES[code]}
                        {!hasText && <span className='ml-1.5 text-xs font-normal text-rose-500'>({copy.empty})</span>}
                      </button>
                    )
                  })}
                </div>
                <div className='inline-flex rounded-xl border border-slate-200 p-1'>
                  {[['edit', FileText, copy.edit], ['preview', Eye, copy.preview], ['split', SplitSquareHorizontal, copy.split]].map(([id, Icon, label]) => (
                    <button key={id} type='button' aria-pressed={mode === id} onClick={() => setMode(id)} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', mode === id ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:text-slate-700', id === 'split' && 'hidden xl:inline-flex')}>
                      <Icon className='h-4 w-4' />{label}
                    </button>
                  ))}
                </div>
              </div>

              {!body.trim() && <p className='rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800'>{copy.emptyBody}</p>}
              {missingAnchors.length > 0 && (
                <p className='flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800'>
                  <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />{copy.missingAnchors(missingAnchors.join(', '))}
                </p>
              )}

              {/* «Рядом» — только на широком экране; на узком остаётся одно поле ввода. */}
              {mode === 'preview' ? preview : (
                <div className={mode === 'split' ? 'grid gap-4 xl:grid-cols-2' : ''}>
                  {editor}
                  {mode === 'split' && <div className='hidden xl:block'>{preview}</div>}
                </div>
              )}

              <div className='flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-start sm:justify-between'>
                <p>{copy.stats(parsed.toc.filter((t) => t.level === 1).length, parsed.toc.filter((t) => t.level === 2).length)} · {body.length.toLocaleString(uiLang)} / 400 000</p>
                <details className='max-w-2xl rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600'>
                  <summary className='cursor-pointer font-medium text-slate-700'>{copy.help}</summary>
                  <dl className='mt-3 grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]'>
                    {copy.helpRows.map(([syntax, meaning]) => (
                      <div key={syntax} className='contents'>
                        <dt><code className='rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800'>{syntax}</code></dt>
                        <dd>{meaning}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
