/**
 * specialization controller
 */

import { factories } from '@strapi/strapi';
import { repairDoctorPrimarySpecializations } from '../../../utils/doctor-specializations-backfill';

// После публикации или удаления специализации у её врачей пропадает основная
// специальность (см. repairDoctorPrimarySpecializations) — восстанавливаем.
const repairAfter = async (strapi: any, action: () => Promise<any>) => {
  const result = await action();
  try {
    await repairDoctorPrimarySpecializations(strapi);
  } catch (error: any) {
    strapi.log.warn(`[specializations] primary specialization repair failed: ${error?.message}`);
  }
  return result;
};

export default factories.createCoreController('api::specialization.specialization', ({ strapi }) => ({
  async update(ctx) {
    return repairAfter(strapi, () => super.update(ctx));
  },
  async delete(ctx) {
    return repairAfter(strapi, () => super.delete(ctx));
  },
}));
