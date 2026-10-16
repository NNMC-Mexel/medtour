/**
 * Пароли пользователей глазами администратора и письма о безопасности входа.
 *
 * Два действия из раздела «Пользователи»:
 *   - отправить письмо со ссылкой на сброс — пользователь сам задаёт пароль
 *     на /reset-password, тем же штатным resetPassword, что и «Забыли пароль?»;
 *   - задать пароль самому — например, когда пациент не может открыть почту.
 *
 * Раньше пароль меняли штатным PUT /api/users/:id: без разрыва сессий, то есть
 * старый токен продолжал работать. Теперь пароль меняется только здесь, а
 * PUT /users/:id с полем password отклоняется (extensions/users-permissions).
 *
 * Сам пароль никуда не пишется и в письме не отправляется: письмо лишь
 * сообщает, что пароль сменил администратор.
 *
 * Пациенты MedTour — часто иностранцы, поэтому письма идут на языке
 * пользователя (user.language: ru / en / kk), как и письма по кейсам.
 */
import crypto from 'crypto';
import { ADMIN_RESET_TTL_HOURS, LOCKOUT_MINUTES, resetTokenExpiry } from './login-protection';

const USER_UID = 'plugin::users-permissions.user';
const BRAND_COLOR = '#0d9488';

type Lang = 'ru' | 'en' | 'kk';

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const langOf = (user: any): Lang => {
  const value = String(user?.language || '').toLowerCase();
  return value === 'en' || value === 'kk' ? value : 'ru';
};

const greetingText = (user: any, lang: Lang) => {
  const name = user?.fullName;
  if (lang === 'en') return name ? `Hello, ${name}!` : 'Hello!';
  if (lang === 'kk') return name ? `Сәлеметсіз бе, ${name}!` : 'Сәлеметсіз бе!';
  return name ? `Здравствуйте, ${name}!` : 'Здравствуйте!';
};

const paragraph = (text: string) => `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">${text}</p>`;
const note = (text: string) => `<p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:24px 0 0;">${text}</p>`;
const button = (href: string, label: string) => `
  <div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="background:${BRAND_COLOR};color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">${escapeHtml(label)}</a>
  </div>`;

const layout = (lang: Lang, title: string, body: string) => `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:${BRAND_COLOR};padding:28px 32px;">
          <div style="font-size:22px;font-weight:700;color:#fff;">MedTour</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${escapeHtml(title)}</h2>
          ${body}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/** Письмо из абзацев: текстовая версия и HTML с одной кнопкой. */
const compose = (
  lang: Lang,
  user: any,
  copy: { subject: string; title: string; lines: string[]; button: string; url: string; footer: string },
) => ({
  subject: `${copy.subject} — MedTour`,
  text: [greetingText(user, lang), ...copy.lines, `${copy.button}: ${copy.url}`, copy.footer].join('\n\n'),
  html: layout(lang, copy.title, [
    paragraph(escapeHtml(greetingText(user, lang))),
    ...copy.lines.map((line) => paragraph(escapeHtml(line))),
    button(copy.url, copy.button),
    note(escapeHtml(copy.footer)),
  ].join('')),
});

const SUPPORT_FOOTER: Record<Lang, string> = {
  ru: 'Если вы не обращались в клинику — свяжитесь с поддержкой MedTour.',
  en: 'If you did not contact the clinic, please contact MedTour support.',
  kk: 'Егер клиникаға хабарласпаған болсаңыз — MedTour қолдау қызметіне жазыңыз.',
};

const send = (strapi: any, user: any, mail: { subject: string; text: string; html: string }) =>
  strapi.plugin('email').service('email').send({ to: user.email, ...mail });

/**
 * Ставит пользователю новый resetPasswordToken и отправляет ссылку на
 * /reset-password. Прежняя ссылка (если была) перестаёт работать: токен один.
 */
export async function sendAdminPasswordResetEmail(strapi: any, user: any) {
  const resetPasswordToken = crypto.randomBytes(64).toString('hex');
  await strapi.query(USER_UID).update({
    where: { id: user.id },
    data: { resetPasswordToken, resetPasswordTokenExpiresAt: resetTokenExpiry('admin') },
  });

  const lang = langOf(user);
  const url = `${frontendUrl()}/reset-password?code=${resetPasswordToken}`;
  const hours = ADMIN_RESET_TTL_HOURS;
  const copy = {
    ru: {
      subject: 'Установите новый пароль',
      title: 'Установите новый пароль',
      lines: [
        'Администратор MedTour отправил вам ссылку для установки нового пароля.',
        `Ссылка действует ${hours} часа. Пока вы не перейдёте по ней, прежний пароль продолжает действовать.`,
      ],
      button: 'Задать новый пароль',
    },
    en: {
      subject: 'Set a new password',
      title: 'Set a new password',
      lines: [
        'A MedTour administrator has sent you a link to set a new password.',
        `The link is valid for ${hours} hours. Until you use it, your current password keeps working.`,
      ],
      button: 'Set a new password',
    },
    kk: {
      subject: 'Жаңа құпиясөз орнатыңыз',
      title: 'Жаңа құпиясөз орнатыңыз',
      lines: [
        'MedTour әкімшісі сізге жаңа құпиясөз орнату сілтемесін жіберді.',
        `Сілтеме ${hours} сағат жарамды. Оған өткенге дейін ескі құпиясөз жарамды.`,
      ],
      button: 'Жаңа құпиясөз орнату',
    },
  }[lang];

  await send(strapi, user, compose(lang, user, { ...copy, url, footer: SUPPORT_FOOTER[lang] }));
}

/** Уведомление: пароль сменил администратор. Сам пароль в письме не передаётся. */
export async function sendAdminPasswordChangedEmail(strapi: any, user: any) {
  const lang = langOf(user);
  const url = `${frontendUrl()}/login`;
  const copy = {
    ru: {
      subject: 'Пароль изменён администратором',
      title: 'Пароль изменён',
      lines: [
        'Администратор MedTour установил вам новый пароль. Все прежние входы в аккаунт завершены.',
        'Новый пароль вам сообщит администратор. После входа его можно сменить в профиле.',
      ],
      button: 'Войти',
    },
    en: {
      subject: 'Your password was changed by an administrator',
      title: 'Password changed',
      lines: [
        'A MedTour administrator has set a new password for your account. All previous sign-ins have been ended.',
        'The administrator will tell you the new password. You can change it in your profile after signing in.',
      ],
      button: 'Sign in',
    },
    kk: {
      subject: 'Құпиясөзді әкімші өзгертті',
      title: 'Құпиясөз өзгертілді',
      lines: [
        'MedTour әкімшісі сізге жаңа құпиясөз орнатты. Аккаунтқа бұрынғы барлық кірулер аяқталды.',
        'Жаңа құпиясөзді әкімші айтады. Кіргеннен кейін оны профильде өзгертуге болады.',
      ],
      button: 'Кіру',
    },
  }[lang];

  await send(strapi, user, compose(lang, user, { ...copy, url, footer: SUPPORT_FOOTER[lang] }));
}

/**
 * Вход закрыт после серии неудачных попыток. Письмо говорит, когда вход
 * откроется и как войти сразу — через восстановление пароля.
 */
export async function sendAccountLockedEmail(strapi: any, user: any) {
  const lang = langOf(user);
  const url = `${frontendUrl()}/forgot-password`;
  const minutes = LOCKOUT_MINUTES;
  const copy = {
    ru: {
      subject: 'Вход в аккаунт временно закрыт',
      title: 'Вход временно закрыт',
      lines: [
        `В ваш аккаунт несколько раз подряд пытались войти с неверным паролем. Вход закрыт на ${minutes} минут.`,
        'Если это были вы — подождите или восстановите пароль: это откроет вход сразу.',
      ],
      button: 'Восстановить пароль',
      footer: 'Если это были не вы — восстановите пароль и сообщите в поддержку MedTour.',
    },
    en: {
      subject: 'Sign-in to your account is temporarily locked',
      title: 'Sign-in temporarily locked',
      lines: [
        `Someone tried to sign in to your account with a wrong password several times in a row. Sign-in is locked for ${minutes} minutes.`,
        'If it was you, wait or reset your password — that unlocks sign-in right away.',
      ],
      button: 'Reset password',
      footer: 'If it was not you, reset your password and let MedTour support know.',
    },
    kk: {
      subject: 'Аккаунтқа кіру уақытша жабылды',
      title: 'Кіру уақытша жабылды',
      lines: [
        `Аккаунтыңызға қатарынан бірнеше рет қате құпиясөзбен кіруге тырысты. Кіру ${minutes} минутқа жабылды.`,
        'Егер бұл сіз болсаңыз — күтіңіз немесе құпиясөзді қалпына келтіріңіз: кіру бірден ашылады.',
      ],
      button: 'Құпиясөзді қалпына келтіру',
      footer: 'Егер бұл сіз болмасаңыз — құпиясөзді қалпына келтіріп, MedTour қолдау қызметіне хабарлаңыз.',
    },
  }[lang];

  await send(strapi, user, compose(lang, user, { ...copy, url }));
}

/** Пользователь, над которым админ выполняет действие, или null. */
export async function findPasswordTarget(strapi: any, rawId: unknown) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return strapi.query(USER_UID).findOne({
    where: { id },
    select: ['id', 'email', 'fullName', 'language', 'blocked', 'userRole'],
  });
}
