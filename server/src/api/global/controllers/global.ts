/**
 *  global controller
 */

import { factories } from '@strapi/strapi';

const DEPARTMENT_SLUGS = new Set([
  'neurosurgery',
  'therapy',
  'urology',
  'general-thoracic-surgery',
  'interventional-cardiology',
  'arrhythmology',
  'gynecology',
  'cardiac-surgery',
]);
const ICONS = new Set(['Activity', 'Brain', 'Heart', 'HeartPulse', 'ScanLine', 'Stethoscope', 'Syringe', 'Venus']);
const ACCENTS = new Set(['teal', 'sky', 'violet', 'amber', 'rose', 'indigo', 'pink', 'red']);
const LOCALES = ['ru', 'en', 'kk'];

function validateTreatmentDepartments(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== DEPARTMENT_SLUGS.size) {
    return 'Treatment departments must contain all configured departments';
  }
  if (JSON.stringify(value).length > 1_000_000) return 'Treatment department content is too large';

  const slugs = new Set<string>();
  const orders = new Set<number>();
  for (const department of value as any[]) {
    if (!department || typeof department !== 'object' || !DEPARTMENT_SLUGS.has(department.slug) || slugs.has(department.slug)) {
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

export default factories.createCoreController('api::global.global', () => ({
  async update(ctx) {
    const body = (ctx.request.body as any)?.data;
    if (body && Object.prototype.hasOwnProperty.call(body, 'treatmentDepartments')) {
      const validationError = validateTreatmentDepartments(body.treatmentDepartments);
      if (validationError) return ctx.badRequest(validationError);
    }
    return await super.update(ctx);
  },
}));
