/**
 * Защита входа на уровне аккаунта и срок жизни ссылки сброса пароля.
 *
 * Лимиты по IP (middlewares/rate-limit.ts и лимит плагина users-permissions)
 * не останавливают распределённый подбор: с сотни адресов можно сделать по
 * 9 попыток с каждого. Поэтому неудачи считаются ещё и на самом аккаунте:
 * после LOCKOUT_THRESHOLD ошибок подряд вход закрывается на LOCKOUT_MINUTES,
 * а владелец получает письмо. Восстановление пароля (по ссылке или
 * администратором) снимает блокировку — так злоумышленник не может держать
 * чужой аккаунт закрытым бесконечно.
 *
 * Ссылка сброса пароля в штатном Strapi живёт вечно. Здесь у неё есть срок:
 * час для «Забыли пароль?» и сутки для ссылки, которую отправил
 * администратор (пользователь может открыть почту не сразу).
 */

export const LOCKOUT_THRESHOLD = 10;
export const LOCKOUT_MINUTES = 15;
/** Ошибки старше этого окна не копятся: опечатки раз в неделю не блокируют. */
export const FAILURE_WINDOW_MINUTES = 60;

export const SELF_SERVICE_RESET_TTL_MINUTES = 60;
export const ADMIN_RESET_TTL_HOURS = 24;

/** Служебные поля входа: пишет только сервер, наружу не отдаются. */
export const LOGIN_PROTECTION_FIELDS = [
  'failedLoginCount',
  'lastFailedLoginAt',
  'loginLockedUntil',
  'resetPasswordTokenExpiresAt',
] as const;

const time = (value: unknown) => {
  if (!value) return NaN;
  return new Date(value as any).getTime();
};

/** Сколько секунд осталось до снятия блокировки; 0 — вход открыт. */
export const lockRemainingSeconds = (user: any, now: Date = new Date()) => {
  const until = time(user?.loginLockedUntil);
  if (!Number.isFinite(until) || until <= now.getTime()) return 0;
  return Math.ceil((until - now.getTime()) / 1000);
};

/**
 * Неудачи считаются атомарно в базе (extensions/users-permissions): при
 * подсчёте «прочитал — прибавил — записал» десять параллельных попыток
 * давали +1, и блокировку можно было обходить пачками запросов. Здесь —
 * только правила: окно, после которого счёт начинается заново, и срок
 * блокировки.
 */
export const failureWindowStart = (now: Date = new Date()) =>
  new Date(now.getTime() - FAILURE_WINDOW_MINUTES * 60_000);

export const lockUntil = (now: Date = new Date()) =>
  new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);

export const reachesLockout = (failedLoginCount: unknown) =>
  (Number(failedLoginCount) || 0) >= LOCKOUT_THRESHOLD;

/** Поля, которые обнуляют счётчик и снимают блокировку. */
export const clearedLoginProtection = () => ({
  failedLoginCount: 0,
  lastFailedLoginAt: null,
  loginLockedUntil: null,
});

export const needsLoginProtectionReset = (user: any) =>
  Boolean(Number(user?.failedLoginCount) > 0 || user?.loginLockedUntil);

/**
 * Ссылка истекла. Токен без срока — выданный до появления сроков — тоже
 * считается истёкшим: иначе старые ссылки остались бы вечными.
 */
export const isResetTokenExpired = (user: any, now: Date = new Date()) => {
  const expires = time(user?.resetPasswordTokenExpiresAt);
  return !Number.isFinite(expires) || expires <= now.getTime();
};

export const resetTokenExpiry = (kind: 'self' | 'admin', now: Date = new Date()) =>
  new Date(now.getTime() + (kind === 'admin'
    ? ADMIN_RESET_TTL_HOURS * 3_600_000
    : SELF_SERVICE_RESET_TTL_MINUTES * 60_000)).toISOString();
