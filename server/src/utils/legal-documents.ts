// Правовые документы (оферта, согласия): языки, проверка правок админа и
// выбор языка для публичной страницы. Без зависимостей от Strapi — для тестов.

export const LEGAL_LANGS = ['ru', 'kk', 'en', 'zh'] as const;
export type LegalLang = (typeof LEGAL_LANGS)[number];
export type LocalizedText = Partial<Record<LegalLang, string>>;

export const LEGAL_LIMITS = {
  title: 300,
  // Самая длинная редакция сейчас ~72 тыс. символов; запас на рост документа.
  body: 400_000,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Языки, на которых у документа есть текст. */
export function availableLanguages(body: unknown): LegalLang[] {
  if (!isPlainObject(body)) return [];
  return LEGAL_LANGS.filter((lang) => typeof body[lang] === 'string' && (body[lang] as string).trim());
}

/** Запрошенный язык → он же, если текст есть; иначе русский; иначе первый доступный. */
export function resolveLanguage(body: unknown, requested: unknown): LegalLang | null {
  const available = availableLanguages(body);
  if (!available.length) return null;
  if (available.includes(requested as LegalLang)) return requested as LegalLang;
  if (available.includes('ru')) return 'ru';
  return available[0];
}

function readLocalized(value: unknown, field: string, max: number): { value?: LocalizedText; error?: string } {
  if (!isPlainObject(value)) return { error: `${field} must be an object keyed by language` };
  const result: LocalizedText = {};
  for (const [lang, text] of Object.entries(value)) {
    if (!(LEGAL_LANGS as readonly string[]).includes(lang)) return { error: `${field}: unsupported language "${lang}"` };
    if (typeof text !== 'string') return { error: `${field}.${lang} must be a string` };
    if (text.length > max) return { error: `${field}.${lang} is longer than ${max} characters` };
    result[lang as LegalLang] = text;
  }
  return { value: result };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Тело PUT от админа → только разрешённые поля. title и body заменяются
 * целиком по каждому языку, переданному в запросе; остальные языки остаются.
 */
export function validateLegalUpdate(input: unknown): { data?: Record<string, unknown>; error?: string } {
  if (!isPlainObject(input)) return { error: 'Request body must be an object' };
  const data: Record<string, unknown> = {};

  if ('title' in input) {
    const { value, error } = readLocalized(input.title, 'title', LEGAL_LIMITS.title);
    if (error) return { error };
    data.title = value;
  }
  if ('body' in input) {
    const { value, error } = readLocalized(input.body, 'body', LEGAL_LIMITS.body);
    if (error) return { error };
    data.body = value;
  }
  if ('revisionDate' in input) {
    const date = input.revisionDate;
    if (date === null || date === '') data.revisionDate = null;
    else if (typeof date === 'string' && DATE.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))) data.revisionDate = date;
    else return { error: 'revisionDate must be YYYY-MM-DD or null' };
  }
  if (!Object.keys(data).length) return { error: 'Nothing to update' };
  return { data };
}

/** Слияние правки с сохранённым текстом: переданные языки заменяются, пустая строка — удаляет язык. */
export function mergeLocalized(stored: unknown, patch: LocalizedText | undefined): LocalizedText {
  const base: LocalizedText = isPlainObject(stored) ? { ...(stored as LocalizedText) } : {};
  for (const [lang, text] of Object.entries(patch || {})) {
    if (text.trim()) base[lang as LegalLang] = text;
    else delete base[lang as LegalLang];
  }
  return base;
}
