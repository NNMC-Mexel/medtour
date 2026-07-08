/**
 * Расширение users-permissions: кастомная регистрация.
 *
 * ВАЖНО: В Strapi v5 контроллеры плагинов — это factory-функции:
 *   plugin.controllers.auth = ({ strapi }) => ({ register, login, ... })
 * Поэтому нужно оборачивать саму factory, а не пытаться подменить метод.
 *
 * Принимает дополнительные поля при регистрации:
 *   - userRole: 'patient' | 'doctor' (admin запрещён)
 *   - fullName, phone, country, iin
 *   - doctorData больше не принимается из публичной регистрации.
 *
 * Автоматически:
 *   - Назначает Strapi-роль patient
 *   - Возвращает полные данные user в ответе
 *
 * В B2B-модели врачи создаются только администратором клиники через админ-панель.
 */
import { maskUserPIIForRole } from '../../utils/pii-crypto';

export default (plugin) => {
  // Сохраняем оригинальную factory-функцию контроллера auth
  const originalAuthFactory = plugin.controllers.auth;
  const originalUserController = plugin.controllers.user;
  const originalContentApiRoutes = plugin.routes['content-api'];

  const allowedUserRoles = ['patient', 'doctor', 'manager', 'coordinator', 'admin'];

  const resolveRoleByType = async (roleType: string) => {
    let role = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: roleType } });

    if (!role) {
      const roleName = roleType.charAt(0).toUpperCase() + roleType.slice(1);
      role = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { name: roleName } });
    }

    return role;
  };

  const normalizeContentApiBody = (requestBody: any) => {
    return requestBody?.data && typeof requestBody.data === 'object'
      ? requestBody.data
      : requestBody;
  };

  const normalizePhoneDigits = (value: any) => String(value || '').replace(/\D/g, '');

  const buildPhoneLookupValues = (value: any) => {
    const digits = normalizePhoneDigits(value);
    if (!digits) return { normalizedCandidates: [], displayCandidates: [] };

    const localDigits = digits.slice(-10);
    const normalizedCandidates = [
      digits,
      localDigits.length === 10 ? localDigits : null,
      localDigits.length === 10 ? `7${localDigits}` : null,
      localDigits.length === 10 ? `8${localDigits}` : null,
    ].filter(Boolean) as string[];

    const displayCandidates = [
      String(value).trim(),
      localDigits.length === 10 ? `+7${localDigits}` : null,
      localDigits.length === 10 ? `7${localDigits}` : null,
      localDigits.length === 10 ? `8${localDigits}` : null,
      localDigits.length === 10 ? localDigits : null,
    ].filter(Boolean) as string[];

    return {
      normalizedCandidates: [...new Set(normalizedCandidates)],
      displayCandidates: [...new Set(displayCandidates)],
    };
  };

  const enrichPhoneNormalized = (data: any) => {
    if (!Object.prototype.hasOwnProperty.call(data, 'phone')) return data;
    data.phoneNormalized = data.phone ? normalizePhoneDigits(data.phone) || null : null;
    return data;
  };

  const assignRoleFromUserRole = async (body: any) => {
    if (body.role) return body;

    const requestedRole = typeof body.userRole === 'string'
      ? body.userRole.toLowerCase()
      : 'patient';

    if (!allowedUserRoles.includes(requestedRole)) {
      throw new Error(`Unsupported userRole '${requestedRole}'`);
    }

    const targetRole = await resolveRoleByType(requestedRole);
    if (!targetRole) {
      throw new Error(`Role '${requestedRole}' not found in Strapi. Check roles configuration.`);
    }

    body.userRole = requestedRole;
    body.role = targetRole.id;
    return body;
  };

  const sanitizeProfilePayload = (body: any) => {
    const allowedFields = [
      'fullName',
      'phone',
      'country',
      'language',
      'timezone',
      'passportNumber',
      'birthDate',
      'gender',
      'i18n',
      'platformGuideCompleted',
    ];

    const data = allowedFields.reduce((acc: Record<string, any>, field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const value = body[field];
        acc[field] = value === '' ? null : value;
      }
      return acc;
    }, {});

    if (Object.prototype.hasOwnProperty.call(data, 'platformGuideCompleted')) {
      data.platformGuideCompleted = data.platformGuideCompleted === true;
      data.platformGuideCompletedAt = data.platformGuideCompleted ? new Date().toISOString() : null;
    }

    return enrichPhoneNormalized(data);
  };

  plugin.controllers.user = {
    ...originalUserController,

    // Mask iin/passportNumber for callers who are not allowed the full value
    // (patient/doctor see ****1234; admin/manager/coordinator see full).
    async me(ctx) {
      await originalUserController.me(ctx);
      const role = ctx.state.user?.role?.type || ctx.state.user?.userRole;
      maskUserPIIForRole(ctx.body, role);
    },

    async create(ctx) {
      try {
        const sourceBody = normalizeContentApiBody(ctx.request?.body || {});
        await assignRoleFromUserRole(sourceBody);
        enrichPhoneNormalized(sourceBody);
        ctx.request.body = sourceBody;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return ctx.badRequest(message);
      }

      return originalUserController.create(ctx);
    },

    async updateMe(ctx) {
      const authUser = ctx.state.user;
      if (!authUser) return ctx.unauthorized();

      const requestBody = ctx.request?.body || {};
      const sourceBody = normalizeContentApiBody(requestBody);
      const data = sanitizeProfilePayload(sourceBody);

      if (Object.keys(data).length === 0) {
        return ctx.badRequest('No allowed profile fields to update');
      }

      const currentUser = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: authUser.id },
      });
      if (!currentUser) return ctx.notFound('User not found');

      const updated = await strapi.query('plugin::users-permissions.user').update({
        where: { id: authUser.id },
        data,
        populate: { avatar: true, role: true },
      });

      const schema = strapi.getModel('plugin::users-permissions.user');
      ctx.body = await strapi.contentAPI.sanitize.output(updated, schema, { auth: ctx.state.auth });
      const role = authUser.role?.type || authUser.userRole;
      maskUserPIIForRole(ctx.body, role);
    },
  };

  plugin.routes['content-api'] = (strapi) => {
    const router = originalContentApiRoutes(strapi);
    const routes = Array.isArray(router) ? router : router.routes;
    const updateMeRoute = {
      method: 'PUT',
      path: '/users/me',
      handler: 'user.updateMe',
      config: { prefix: '' },
    };
    const userUpdateIndex = routes.findIndex((route: any) => route.method === 'PUT' && route.path === '/users/:id');
    const nextRoutes = userUpdateIndex === -1
      ? [...routes, updateMeRoute]
      : [
          ...routes.slice(0, userUpdateIndex),
          updateMeRoute,
          ...routes.slice(userUpdateIndex),
        ];

    return Array.isArray(router) ? nextRoutes : { ...router, routes: nextRoutes };
  };

  // Заменяем на новую factory, которая оборачивает оригинальную
  plugin.controllers.auth = (factoryContext) => {
    // Вызываем оригинальную factory, чтобы получить все методы контроллера
    const originalController = originalAuthFactory(factoryContext);
    const originalRegister = originalController.register;
    const originalLogin = originalController.login;

    return {
      ...originalController,

      // Логин по телефону: если identifier выглядит как номер телефона —
      // ищем пользователя по полю phone и подставляем его email
      async login(ctx) {
        const requestBody = ctx.request?.body || {};
        const sourceBody =
          requestBody?.data && typeof requestBody.data === 'object'
            ? requestBody.data
            : requestBody;

        const { identifier } = sourceBody;

        if (identifier) {
          const trimmed = String(identifier).trim();
          const digitsOnly = normalizePhoneDigits(trimmed);
          const isPhone = digitsOnly.length >= 7 && /^[\d\s\+\-\(\)]+$/.test(trimmed);

          if (isPhone) {
            const { normalizedCandidates, displayCandidates } = buildPhoneLookupValues(trimmed);

            let foundUser: any = null;

            for (const phoneNormalized of normalizedCandidates) {
              foundUser = await strapi.query('plugin::users-permissions.user').findOne({
                where: { phoneNormalized },
                select: ['id', 'email', 'phone', 'phoneNormalized'],
              });
              if (foundUser) break;
            }

            for (const phoneVariant of displayCandidates) {
              if (foundUser) break;
              foundUser = await strapi.query('plugin::users-permissions.user').findOne({
                where: { phone: phoneVariant },
                select: ['id', 'email', 'phone', 'phoneNormalized'],
              });
            }

            // Backward compatibility for existing users whose phone was saved as
            // "+7 778 000 36 34" etc. Once found, persist phoneNormalized so the
            // next login is an exact lookup instead of this bounded scan.
            if (!foundUser) {
              const usersWithPhone = await strapi.query('plugin::users-permissions.user').findMany({
                where: { phone: { $notNull: true } },
                select: ['id', 'email', 'phone', 'phoneNormalized'],
                limit: 2000,
              });
              foundUser = usersWithPhone.find((user: any) => {
                const normalizedPhone = normalizePhoneDigits(user.phone);
                return normalizedCandidates.includes(normalizedPhone);
              });
            }

            if (foundUser?.id && foundUser.phone && !foundUser.phoneNormalized) {
              try {
                await strapi.query('plugin::users-permissions.user').update({
                  where: { id: foundUser.id },
                  data: { phoneNormalized: normalizePhoneDigits(foundUser.phone) || null },
                });
              } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                strapi.log.warn(`[auth.login] Failed to backfill phoneNormalized: ${msg}`);
              }
            }

            if (foundUser?.email) {
              console.log(`[auth.login] Phone login: found user by phone, using email`);
              ctx.request.body = { ...sourceBody, identifier: foundUser.email };
            }
          }
        }

        return originalLogin(ctx);
      },

      async register(ctx) {
        // 0. Извлекаем дополнительные поля и УБИРАЕМ из body,
        //    иначе Strapi-валидация отклонит запрос: "Invalid parameters"
        const requestBody = ctx.request?.body || {};
        const sourceBody = normalizeContentApiBody(requestBody);

        const { userRole: rawRole, fullName, phone, country, language, timezone, iin, doctorData, ...cleanBody } = sourceBody;

        // MedTour security: public registration is only for patients.
        // Staff and partner doctors must be created/verified by an admin.
        const normalizedRole = typeof rawRole === 'string' ? rawRole.toLowerCase() : null;
        if (['manager', 'coordinator', 'doctor', 'admin'].includes(normalizedRole || '') || doctorData) {
          return ctx.forbidden('Staff registration is disabled. MedTour staff and doctors are created by administrators.');
        }
        const userRole = 'patient';
        const email = typeof cleanBody.email === 'string' ? cleanBody.email.toLowerCase() : '';

        // Подменяем body — Strapi-валидатор видит только username, email, password
        ctx.request.body = cleanBody;

        // Strapi's built-in register CREATES the user (confirmed=false, because
        // email_confirmation is enforced on at bootstrap) and THEN tries to send
        // the confirmation email. If only the email send fails it throws
        // 'Error sending confirmation email' AFTER the user row already exists.
        //
        // Previously that throw escaped before our profile/role update ran, which
        // left a half-created account (no role/profile/iin) that could never be
        // re-registered or logged into. We now swallow ONLY that specific failure
        // and finish the account, while genuine validation/duplicate errors are
        // re-thrown so the client still gets the correct 4xx.
        let confirmationEmailFailed = false;
        try {
          await originalRegister(ctx);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (!/sending confirmation email/i.test(msg)) {
            throw error; // bad password, taken email, invalid params, etc.
          }
          confirmationEmailFailed = true;
          strapi.log.warn('[auth.register] Confirmation email failed at create time; account kept, will retry once.');
        }

        // Resolve the freshly-created user id — from the success response, or by
        // email when the email-send path threw before ctx.send populated the body.
        const responseBody = ctx.response?.body || ctx.body;
        let userId = responseBody?.user?.id;
        if (!userId && email) {
          const existing = await strapi.query('plugin::users-permissions.user').findOne({ where: { email } });
          userId = existing?.id;
        }
        if (!userId) {
          // Nothing was created — leave whatever response Strapi produced.
          return;
        }

        try {
          // 1. Находим целевую Strapi-роль
          const targetRole = await resolveRoleByType(userRole);
          if (!targetRole) {
            // Hard fail — assigning the wrong role (authenticated) is a security risk
            throw new Error(`Role '${userRole}' not found in Strapi. Check roles configuration.`);
          }

          // 2. Обновляем user: userRole + профиль + правильная Strapi-роль.
          // confirmed=false — пользователь должен подтвердить email перед login
          // (иначе регистрация = заявка на чужой email / impersonation).
          await strapi.query('plugin::users-permissions.user').update({
            where: { id: userId },
            data: {
              userRole,
              fullName: fullName || null,
              phone: phone || null,
              country: country || null,
              language: language || 'en',
              timezone: timezone || null,
              iin: iin || null,
              platformGuideCompleted: false,
              platformGuideCompletedAt: null,
              role: targetRole.id,
              confirmed: false,
              phoneNormalized: phone ? normalizePhoneDigits(phone) || null : null,
            },
          });

          // 3. Письмо подтверждения шлём ТОЛЬКО если встроенный register не смог.
          // На happy-path Strapi уже отправил ровно одно письмо — повторная
          // отправка перегенерировала бы confirmationToken и убила бы ссылку,
          // которую пользователь только что получил (это и был баг с двойным письмом).
          if (confirmationEmailFailed) {
            const freshUser = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: userId } });
            try {
              await strapi.plugin('users-permissions').service('user').sendConfirmationEmail(freshUser);
              confirmationEmailFailed = false;
            } catch (emailError) {
              const emailMsg = emailError instanceof Error ? emailError.message : String(emailError);
              strapi.log.error('[auth.register] Confirmation email retry failed — account kept:', emailMsg);
            }
          }

          // 4. Ответ без JWT — email не подтверждён, пользователь не залогинен.
          const safeUser = {
            id: userId,
            documentId: responseBody?.user?.documentId,
            username: responseBody?.user?.username,
            email: responseBody?.user?.email || email,
            confirmed: false,
            blocked: false,
            userRole,
            fullName: fullName || null,
            phone: phone || null,
            country: country || null,
            language: language || 'en',
            timezone: timezone || null,
          };

          const newBody = {
            user: safeUser,
            requiresEmailConfirmation: true,
            emailDelivered: !confirmationEmailFailed,
            message: confirmationEmailFailed
              ? 'Registration successful, but we could not send the confirmation email right now. Please use "resend confirmation" or contact support. If the email arrives later, check your inbox and Spam folder.'
              : 'Registration successful. Please check your inbox and Spam folder to confirm your account before logging in.',
          };

          ctx.status = 200;
          if (ctx.response?.body) {
            ctx.response.body = newBody;
          } else {
            ctx.body = newBody;
          }

          // Audit log — registration
          strapi.log.info(JSON.stringify({
            audit: 'USER_REGISTERED',
            userId,
            userRole,
            confirmed: false,
            emailConfirmationSent: !confirmationEmailFailed,
            ts: new Date().toISOString(),
          }));
        } catch (error) {
          // Profile finalization itself failed (DB error / missing role). Roll the
          // user back so the email can be reused on retry. Email-send failures do
          // NOT reach here — they are handled above without rollback.
          const safeMessage = error instanceof Error ? error.message : String(error);
          strapi.log.error('[auth.register] Profile finalization failed — rolling back user:', safeMessage);
          try {
            await strapi.query('plugin::users-permissions.user').delete({ where: { id: userId } });
          } catch (deleteErr) {
            const deleteMsg = deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
            strapi.log.error('[auth.register] Failed to rollback user:', deleteMsg);
          }

          ctx.status = 500;
          ctx.body = {
            error: {
              status: 500,
              name: 'InternalServerError',
              message: 'Registration failed due to a server error. Please try again.',
            },
          };
        }
      },
    };
  };

  return plugin;
};
