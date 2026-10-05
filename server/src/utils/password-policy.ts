/**
 * Единая политика паролей — серверный источник истины для регистрации,
 * сброса, смены пароля и создания/редактирования пользователей админом.
 * Клиент (frontend/src/utils/helpers.js → getPasswordError) лишь дублирует
 * правила для UX: проверку на фронте можно обойти прямым вызовом API.
 *
 *   - 8+ символов, заглавная и строчная буквы, цифра, спецсимвол;
 *   - не длиннее 72 байт: bcrypt молча обрезает всё после 72-го байта;
 *   - без пробелов по краям (частый источник «не могу войти»).
 */

export type PasswordPolicyCode =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'whitespace_edges'
  | 'needs_uppercase'
  | 'needs_lowercase'
  | 'needs_digit'
  | 'needs_special';

const MESSAGES: Record<PasswordPolicyCode, string> = {
  required: 'Password is required.',
  too_short: 'Password must be at least 8 characters long.',
  too_long: 'Password is too long (72 characters maximum).',
  whitespace_edges: 'Password must not start or end with a space.',
  needs_uppercase: 'Password must contain an uppercase letter.',
  needs_lowercase: 'Password must contain a lowercase letter.',
  needs_digit: 'Password must contain a digit.',
  needs_special: 'Password must contain a special character.',
};

export const getPasswordPolicyViolation = (password: unknown): PasswordPolicyCode | null => {
  if (typeof password !== 'string' || !password) return 'required';
  if (password.length < 8) return 'too_short';
  if (Buffer.byteLength(password, 'utf8') > 72) return 'too_long';
  if (password !== password.trim()) return 'whitespace_edges';
  if (!/\p{Lu}/u.test(password)) return 'needs_uppercase';
  if (!/\p{Ll}/u.test(password)) return 'needs_lowercase';
  if (!/\d/.test(password)) return 'needs_digit';
  if (!/[^\p{L}\p{N}]/u.test(password)) return 'needs_special';
  return null;
};

/** Отвечает 400 и возвращает true, если пароль не проходит политику. */
export const rejectWeakPassword = (ctx: any, password: unknown): boolean => {
  const code = getPasswordPolicyViolation(password);
  if (!code) return false;
  ctx.badRequest(MESSAGES[code], { code: `password_${code}`, i18nKey: `password_policy.${code}` });
  return true;
};
