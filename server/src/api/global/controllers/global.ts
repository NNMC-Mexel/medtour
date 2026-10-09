/**
 *  global controller
 */

import { factories } from '@strapi/strapi';
import { GLOBAL_DEFAULTS } from '../../../utils/global-defaults';

const ICONS = new Set(['Activity', 'Brain', 'Heart', 'HeartPulse', 'ScanLine', 'Stethoscope', 'Syringe', 'Venus']);
const ACCENTS = new Set(['teal', 'sky', 'violet', 'amber', 'rose', 'indigo', 'pink', 'red']);
const LOCALES = ['ru', 'en', 'kk'];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateTreatmentDepartments(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    return 'Treatment departments must contain between 1 and 50 departments';
  }
  if (JSON.stringify(value).length > 1_000_000) return 'Treatment department content is too large';

  const slugs = new Set<string>();
  const orders = new Set<number>();
  for (const department of value as any[]) {
    if (
      !department
      || typeof department !== 'object'
      || typeof department.slug !== 'string'
      || department.slug.length > 80
      || !SLUG_PATTERN.test(department.slug)
      || slugs.has(department.slug)
    ) {
      return 'Treatment department slug is invalid or duplicated';
    }
    slugs.add(department.slug);

    const order = Number(department.sortOrder);
    if (!Number.isInteger(order) || order < 1 || orders.has(order)) return 'Treatment department order must be positive and unique';
    orders.add(order);
    if (!ICONS.has(department.icon) || !ACCENTS.has(department.accent)) return 'Treatment department icon or accent is invalid';
    if (typeof department.isActive !== 'boolean') return 'Treatment department visibility is invalid';
    if (!Array.isArray(department.specialtyMatches) || department.specialtyMatches.some((item: unknown) => typeof item !== 'string')) {
      return 'Treatment department specialty matching is invalid';
    }

    const media = department.heroImage;
    const mediaUrl = typeof media === 'string' ? media : media?.url;
    if (typeof mediaUrl !== 'string' || (
      !mediaUrl.startsWith('/treatments/')
      && !mediaUrl.startsWith('/uploads/')
      && !mediaUrl.startsWith('/api/file-proxy/')
    )) {
      return 'Treatment department hero image is invalid';
    }

    // Inactive departments are drafts and may be saved before all translations
    // are ready. Public pages already filter them out.
    if (department.isActive === false) continue;

    for (const locale of LOCALES) {
      const content = department.content?.[locale];
      const requiredText = [content?.title, content?.short, content?.summary];
      if (requiredText.some((item) => typeof item !== 'string' || !item.trim())) return `Treatment department ${locale} content is incomplete`;
      const requiredLists = ['services', 'conditions', 'technology', 'journey', 'benefits'];
      if (requiredLists.some((field) => !Array.isArray(content[field]) || content[field].length === 0)) {
        return `Treatment department ${locale} lists are incomplete`;
      }
      if (!Array.isArray(content.programs) || content.programs.length === 0) return `Treatment department ${locale} programs are required`;
      if (content.programs.some((program: any) => !program?.name?.trim() || !program?.text?.trim())) {
        return `Treatment department ${locale} programs are incomplete`;
      }
    }
  }

  return null;
}

const TOURISM_TYPES = new Set([
  'city', 'nature', 'mountains', 'culture', 'history', 'sacred',
  'wellness', 'beach', 'adventure', 'eco', 'gastronomy', 'space',
]);
const MEDIA_PREFIXES = ['/tourism/', '/treatments/', '/uploads/', '/api/file-proxy/'];
const isShortText = (value: unknown, max: number) => value === undefined || value === null || (typeof value === 'string' && value.length <= max);

// Места на странице «Туризм». Русский — обязательный язык опубликованного
// места; пустые переводы сайт заменяет русским текстом.
function validateTourismRegions(value: unknown): string | null {
  if (!Array.isArray(value) || value.length > 100) return 'Tourism places must be a list of at most 100 items';
  if (JSON.stringify(value).length > 1_000_000) return 'Tourism content is too large';

  const ids = new Set<string>();
  for (const item of value as any[]) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !SLUG_PATTERN.test(item.id) || item.id.length > 80 || ids.has(item.id)) {
      return 'Tourism place id is invalid or duplicated';
    }
    ids.add(item.id);
    if (!Array.isArray(item.types) || item.types.some((type: unknown) => typeof type !== 'string' || !TOURISM_TYPES.has(type))) {
      return 'Tourism place type is invalid';
    }
    if (typeof item.isActive !== 'boolean') return 'Tourism place visibility is invalid';
    const order = Number(item.sortOrder);
    if (!Number.isInteger(order) || order < 1) return 'Tourism place order is invalid';
    const mediaUrl = typeof item.image === 'string' ? item.image : item.image?.url;
    if (typeof mediaUrl !== 'string' || !MEDIA_PREFIXES.some((prefix) => mediaUrl.startsWith(prefix))) {
      return 'Tourism place image is invalid';
    }
    for (const locale of LOCALES) {
      const content = item.content?.[locale];
      if (content === undefined) continue;
      if (!content || typeof content !== 'object') return `Tourism place ${locale} content is invalid`;
      if (!isShortText(content.name, 200) || !isShortText(content.center, 200) || !isShortText(content.summary, 2000)) {
        return `Tourism place ${locale} text is too long`;
      }
      if (content.highlights !== undefined && (!Array.isArray(content.highlights) || content.highlights.length > 20
        || content.highlights.some((line: unknown) => typeof line !== 'string' || line.length > 300))) {
        return `Tourism place ${locale} highlights are invalid`;
      }
    }
    if (item.isActive && !(typeof item.content?.ru?.name === 'string' && item.content.ru.name.trim())) {
      return 'Tourism place needs a Russian name';
    }
  }
  return null;
}

export default factories.createCoreController('api::global.global', ({ strapi }) => ({
  async update(ctx) {
    const body = (ctx.request.body as any)?.data;
    if (body && Object.prototype.hasOwnProperty.call(body, 'treatmentDepartments')) {
      const validationError = validateTreatmentDepartments(body.treatmentDepartments);
      if (validationError) return ctx.badRequest(validationError);
    }
    if (body && Object.prototype.hasOwnProperty.call(body, 'tourismRegions')) {
      const validationError = validateTourismRegions(body.tourismRegions);
      if (validationError) return ctx.badRequest(validationError);
    }
    if (body && Object.prototype.hasOwnProperty.call(body, 'landingConfig')) {
      const config = body.landingConfig;
      if (config !== null && (typeof config !== 'object' || Array.isArray(config) || JSON.stringify(config).length > 1_000_000)) {
        return ctx.badRequest('Landing content is invalid');
      }
    }

    // Отделения и туризм сохраняют только своё поле. Если записи Global ещё
    // нет, PUT создаёт её и падает на обязательных siteName/siteDescription.
    if (body && typeof body === 'object') {
      const existing: any = await strapi.documents('api::global.global' as any).findFirst({});
      for (const [key, value] of Object.entries(GLOBAL_DEFAULTS)) {
        const missing = typeof body[key] !== 'string' || !body[key].trim();
        if (missing && !(existing?.[key] && String(existing[key]).trim())) body[key] = value;
        else if (missing && key in body) delete body[key];
      }
    }
    return await super.update(ctx);
  },
}));
