// Статьи блога: проверка правок админа и slug. Без зависимостей от Strapi — для тестов.

export const BLOG_LANGS = ['ru', 'kk', 'en'] as const;
export type BlogLang = (typeof BLOG_LANGS)[number];
export type LocalizedText = Partial<Record<BlogLang, string>>;

export const BLOG_CATEGORIES = ['preparation', 'treatment', 'astana', 'recovery', 'routes', 'planning'] as const;

export const BLOG_LIMITS = {
  title: 300,
  excerpt: 1000,
  content: 100_000,
  slug: 120,
  coverUrl: 500,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Русский и казахский алфавиты → латиница для адреса статьи.
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Текст → slug из латиницы, цифр и дефисов. */
export function slugify(text: unknown): string {
  return String(text || '')
    .toLowerCase()
    .split('')
    .map((char) => (char in TRANSLIT ? TRANSLIT[char] : char))
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BLOG_LIMITS.slug)
    .replace(/-+$/, '');
}

/** Заголовок на языке посетителя → русский → любой непустой. */
export function pickText(map: unknown, lang?: string): string {
  if (!isPlainObject(map)) return '';
  const own = lang && typeof map[lang] === 'string' ? (map[lang] as string).trim() : '';
  if (own) return own;
  if (typeof map.ru === 'string' && map.ru.trim()) return map.ru.trim();
  for (const value of Object.values(map)) if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

function readLocalized(value: unknown, field: string, max: number): { value?: LocalizedText; error?: string } {
  if (value === null || value === undefined) return { value: {} };
  if (!isPlainObject(value)) return { error: `${field} must be an object keyed by language` };
  const result: LocalizedText = {};
  for (const [lang, text] of Object.entries(value)) {
    if (!(BLOG_LANGS as readonly string[]).includes(lang)) return { error: `${field}: unsupported language "${lang}"` };
    if (typeof text !== 'string') return { error: `${field}.${lang} must be a string` };
    if (text.length > max) return { error: `${field}.${lang} is longer than ${max} characters` };
    if (text.trim()) result[lang as BlogLang] = text.trim();
  }
  return { value: result };
}

/** Внешняя ссылка или путь от корня сайта; «javascript:» и прочие схемы — нет. */
function isSafeImageUrl(value: string) {
  return /^https?:\/\//i.test(value) || (value.startsWith('/') && !value.startsWith('//'));
}

/**
 * Тело POST/PUT от админа → только разрешённые поля. При создании нужен
 * заголовок хотя бы на одном языке; при правке поля можно передавать частично.
 */
export function validateBlogPost(
  input: unknown,
  { partial = false }: { partial?: boolean } = {},
): { data?: Record<string, unknown>; error?: string } {
  if (!isPlainObject(input)) return { error: 'Request body must be an object' };
  const data: Record<string, unknown> = {};

  for (const [field, max] of [['title', BLOG_LIMITS.title], ['excerpt', BLOG_LIMITS.excerpt], ['content', BLOG_LIMITS.content]] as const) {
    if (!(field in input)) continue;
    const { value, error } = readLocalized(input[field], field, max);
    if (error) return { error };
    data[field] = value;
  }
  if ((!partial || 'title' in input) && !pickText(data.title)) return { error: 'title is required' };

  if ('slug' in input) {
    const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
    if (slug && (!SLUG_PATTERN.test(slug) || slug.length > BLOG_LIMITS.slug)) {
      return { error: 'slug may contain only latin letters, digits and dashes' };
    }
    data.slug = slug;
  }

  if ('category' in input) {
    if (!(BLOG_CATEGORIES as readonly unknown[]).includes(input.category)) return { error: 'Unknown category' };
    data.category = input.category;
  }

  if ('readTime' in input) {
    const minutes = input.readTime === null || input.readTime === '' ? null : Number(input.readTime);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 600)) {
      return { error: 'readTime must be a whole number of minutes' };
    }
    data.readTime = minutes;
  }

  if ('sortOrder' in input) {
    const order = Number(input.sortOrder || 0);
    if (!Number.isInteger(order)) return { error: 'sortOrder must be an integer' };
    data.sortOrder = order;
  }

  for (const flag of ['isActive', 'isFeatured'] as const) {
    if (flag in input) data[flag] = Boolean(input[flag]);
  }

  if ('coverUrl' in input) {
    const url = typeof input.coverUrl === 'string' ? input.coverUrl.trim() : '';
    if (url && (!isSafeImageUrl(url) || url.length > BLOG_LIMITS.coverUrl)) return { error: 'coverUrl must be an http(s) link or a site path' };
    data.coverUrl = url || null;
  }

  if ('cover' in input) {
    const cover = input.cover === null || input.cover === '' ? null : Number(input.cover);
    if (cover !== null && (!Number.isInteger(cover) || cover < 1)) return { error: 'cover must be a media id' };
    data.cover = cover;
  }

  return { data };
}
