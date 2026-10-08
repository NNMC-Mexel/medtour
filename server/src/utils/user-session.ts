/**
 * Отзыв сессий.
 *
 * users-permissions выдаёт stateless JWT: до истечения срока он действителен
 * даже после выхода, смены пароля или блокировки. Поэтому вводится «водораздел»
 * `user.tokenValidAfter`: любой токен с `iat` раньше этой отметки считается
 * отозванным. Отметка сдвигается при выходе и смене/сбросе пароля.
 */

/**
 * Приводит datetime к epoch-миллисекундам. Драйверы отдают его по-разному:
 * SQLite — числом, Postgres — Date, сериализованный ответ — ISO-строкой.
 * Наивное `new Date('1700000000000')` даёт Invalid Date, и проверка отзыва
 * молча превратилась бы в no-op.
 */
export const toEpochMs = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * `iat` в JWT — целые секунды, а отметка хранится с миллисекундами. Границу
 * округляем ВВЕРХ: токен, выпущенный в ту же секунду, что и выход, тоже
 * считается отозванным.
 */
export const revocationBoundarySeconds = (tokenValidAfter: unknown): number | null => {
  const ms = toEpochMs(tokenValidAfter);
  return ms === null ? null : Math.ceil(ms / 1000);
};

export const sessionIsCurrent = (user: any, payload: any) => {
  if (!user || user.blocked) return false;
  const issuedAt = Number(payload?.iat);
  if (!Number.isFinite(issuedAt)) return false;
  const boundary = revocationBoundarySeconds(user.tokenValidAfter);
  return boundary === null || issuedAt >= boundary;
};

/** Проверяет JWT users-permissions с учётом блокировки и отзыва. */
export async function verifyUserSession(strapi: any, token: string | null | undefined) {
  if (!token) return null;
  try {
    const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
    if (!payload?.id) return null;
    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: payload.id },
      populate: { role: true },
    });
    return sessionIsCurrent(user, payload) ? user : null;
  } catch {
    return null;
  }
}

/**
 * Выдаёт JWT, который гарантированно не попадает под только что выставленную
 * отметку отзыва: без этого новый токен после смены пароля, выданный в ту же
 * секунду, сразу получал бы 401.
 */
export async function issueUserJwt(strapi: any, userId: number | string) {
  const user = await strapi.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    select: ['tokenValidAfter'],
  });
  const boundary = revocationBoundarySeconds(user?.tokenValidAfter) ?? 0;
  const iat = Math.max(Math.floor(Date.now() / 1000), boundary);
  return strapi.plugin('users-permissions').service('jwt').issue({ id: userId, iat });
}

export async function revokeUserSessions(strapi: any, userId: number | string) {
  await strapi.query('plugin::users-permissions.user').update({
    where: { id: userId },
    data: { tokenValidAfter: new Date().toISOString() },
  });
}
