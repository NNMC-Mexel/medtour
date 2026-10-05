/**
 * Временные учётные данные TURN (coturn REST API, `use-auth-secret`).
 *
 * Раньше логин и пароль TURN были статическими и попадали в JS-бандл
 * (VITE_TURN_CREDENTIAL): любой, кто открыл сайт, мог гонять трафик через
 * relay клиники. Теперь секрет живёт только на сервере, а клиент после входа
 * получает пару с коротким сроком жизни:
 *   username = "<unix-expiry>:medtour-<userId>"
 *   password = base64(HMAC-SHA1(username, TURN_STATIC_AUTH_SECRET))
 *
 * Пока TURN_STATIC_AUTH_SECRET не задан, эндпоинт отвечает 503, а фронтенд
 * остаётся на прежних настройках — включение не ломает звонки до
 * перенастройки coturn.
 */
import crypto from 'crypto';
import { verifyUserSession } from '../../../utils/user-session';

const DEFAULT_TTL_SECONDS = 4 * 60 * 60; // с запасом на длинную консультацию

const getTtlSeconds = () => {
  const value = Number(process.env.TURN_CREDENTIAL_TTL_SECONDS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TTL_SECONDS;
};

const buildUrls = () => {
  const urls: string[] = [];
  const internal = process.env.TURN_URL_INTERNAL;
  const udp = process.env.TURN_URL;
  const tls = process.env.TURN_URL_TLS;
  if (internal) urls.push(internal, `${internal}?transport=tcp`);
  if (udp) urls.push(udp, `${udp}?transport=tcp`);
  if (tls) urls.push(tls);
  return urls;
};

const getBearerToken = (ctx: any) => {
  const header = String(ctx.request?.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

export default {
  /** GET /api/turn-credentials — временная пара для ICE, только после входа. */
  async issue(ctx) {
    const user = await verifyUserSession(strapi, getBearerToken(ctx));
    if (!user) return ctx.unauthorized('Not authenticated');

    const secret = process.env.TURN_STATIC_AUTH_SECRET;
    const urls = buildUrls();
    if (!secret || urls.length === 0) {
      ctx.status = 503;
      ctx.body = { error: 'Ephemeral TURN credentials are not configured' };
      return;
    }

    const ttl = getTtlSeconds();
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;
    // Привязка к пользователю: по логам coturn видно, чей это был relay.
    const username = `${expiresAt}:medtour-${user.id}`;
    const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');

    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data: { username, credential, ttl, expiresAt, urls } };
  },
};
