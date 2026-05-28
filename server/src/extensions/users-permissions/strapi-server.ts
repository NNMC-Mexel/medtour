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
      'email',
      'phone',
      'country',
      'language',
      'timezone',
      'passportNumber',
      'iin',
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

    return data;
  };

  plugin.controllers.user = {
    ...originalUserController,

    async create(ctx) {
      try {
        const sourceBody = normalizeContentApiBody(ctx.request?.body || {});
        await assignRoleFromUserRole(sourceBody);
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

      if (data.email) {
        const email = String(data.email).trim().toLowerCase();
        const sameEmailUser = await strapi.query('plugin::users-permissions.user').findOne({
          where: { email },
        });
        if (sameEmailUser && String(sameEmailUser.id) !== String(authUser.id)) {
          return ctx.badRequest('Email already taken');
        }
        data.email = email;
        if (currentUser.username === currentUser.email) data.username = email;
      }

      const updated = await strapi.query('plugin::users-permissions.user').update({
        where: { id: authUser.id },
        data,
        populate: { avatar: true, role: true },
      });

      const schema = strapi.getModel('plugin::users-permissions.user');
      ctx.body = await strapi.contentAPI.sanitize.output(updated, schema, { auth: ctx.state.auth });
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
          const digitsOnly = trimmed.replace(/\D/g, '');
          const isPhone = digitsOnly.length >= 7 && /^[\d\s\+\-\(\)]+$/.test(trimmed);

          if (isPhone) {
            // Build exact-match candidates from the same digit string to avoid
            // loading ALL users into memory (collision + performance risk).
            // We try up to 4 known formats used in Kazakhstan:
            //   +7XXXXXXXXXX  (international)
            //    7XXXXXXXXXX  (without +)
            //    8XXXXXXXXXX  (Russian-style)
            //     XXXXXXXXXX  (local 10-digit)
            const localDigits = digitsOnly.slice(-10); // last 10 digits
            const phoneCandidates: string[] = [trimmed];

            if (localDigits.length === 10) {
              const variants = [
                `+7${localDigits}`,
                `7${localDigits}`,
                `8${localDigits}`,
                localDigits,
              ];
              // Add variants not already in the list
              variants.forEach((v) => {
                if (!phoneCandidates.includes(v)) phoneCandidates.push(v);
              });
            }

            let foundUser: any = null;
            for (const phoneVariant of phoneCandidates) {
              foundUser = await strapi.query('plugin::users-permissions.user').findOne({
                where: { phone: phoneVariant },
                select: ['id', 'email', 'phone'],
              });
              if (foundUser) break;
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
        console.log('[auth.register] Custom registration handler started');

        // 0. Извлекаем дополнительные поля и УБИРАЕМ из body,
        //    иначе Strapi-валидация отклонит запрос: "Invalid parameters"
        const requestBody = ctx.request?.body || {};
        const sourceBody = normalizeContentApiBody(requestBody);

        const { userRole: rawRole, fullName, phone, country, iin, doctorData, ...cleanBody } = sourceBody;

        // MedTour security: public registration is only for patients.
        // Staff and partner doctors must be created/verified by an admin.
        const normalizedRole = typeof rawRole === 'string' ? rawRole.toLowerCase() : null;
        if (['manager', 'coordinator', 'doctor', 'admin'].includes(normalizedRole || '') || doctorData) {
          return ctx.forbidden('Staff registration is disabled. MedTour staff and doctors are created by administrators.');
        }
        const userRole = 'patient';

        console.log(`[auth.register] userRole=${userRole}, fullName=${fullName}`);

        // Подменяем body — оставляем только username, email, password
        ctx.request.body = cleanBody;

        // Вызываем оригинальную регистрацию Strapi (создаёт user + JWT)
        await originalRegister(ctx);

        // Если регистрация не удалась — выходим (ошибка уже в ctx.response)
        const responseBody = ctx.response?.body || ctx.body;
        console.log('[auth.register] Response user id:', responseBody?.user?.id);

        if (!responseBody?.user?.id) {
          console.log('[auth.register] No user id in response, skipping role assignment');
          return;
        }

        const userId = responseBody.user.id;

        let createdDoctorDocId: string | undefined;

        try {
          // 1. Находим целевую Strapi-роль
          const targetRole = await resolveRoleByType(userRole);

          if (!targetRole) {
            // Hard fail — assigning the wrong role (authenticated) is a security risk
            throw new Error(`Role '${userRole}' not found in Strapi. Check roles configuration.`);
          }

          console.log(`[auth.register] Found role: id=${targetRole.id}, name=${targetRole.name}, type=${targetRole.type}`);

          const roleId = targetRole.id;

          // 2. Обновляем user: userRole + fullName + phone + country + iin + правильная Strapi-роль
          await strapi.query('plugin::users-permissions.user').update({
            where: { id: userId },
            data: {
              userRole,
              fullName: fullName || null,
              phone: phone || null,
              country: country || null,
              iin: iin || null,
              platformGuideCompleted: false,
              platformGuideCompletedAt: null,
              role: roleId,
            },
          });

          console.log(`[auth.register] User ${userId} updated: userRole=${userRole}, roleId=${roleId}`);

          // 3. Обновляем response body, чтобы фронтенд получил актуальные данные
          responseBody.user.userRole = userRole;
          responseBody.user.fullName = fullName || null;
          responseBody.user.phone = phone || null;
          responseBody.user.country = country || null;
          responseBody.user.platformGuideCompleted = false;
          responseBody.user.platformGuideCompletedAt = null;

          if (ctx.response?.body) {
            ctx.response.body = responseBody;
          } else {
            ctx.body = responseBody;
          }

          // Audit log — registration
          strapi.log.info(JSON.stringify({
            audit: 'USER_REGISTERED',
            userId,
            userRole,
            ts: new Date().toISOString(),
          }));

          console.log('[auth.register] Registration complete');
        } catch (error) {
          const safeMessage = error instanceof Error ? error.message : String(error);
          console.error('[auth.register] Error during extended registration — rolling back user:', safeMessage);

          // Rollback: remove the partially-created doctor profile and user so the
          // client can safely retry. The JWT was only written to ctx.body (not flushed),
          // so we can still overwrite the response before Strapi sends it.
          if (createdDoctorDocId) {
            try {
              await strapi.documents('api::doctor.doctor').delete({ documentId: createdDoctorDocId });
              console.log(`[auth.register] Rolled back doctor profile ${createdDoctorDocId}`);
            } catch (deleteErr) {
              const deleteMsg = deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
              console.error('[auth.register] Failed to rollback doctor profile:', deleteMsg);
            }
          }
          try {
            await strapi.query('plugin::users-permissions.user').delete({ where: { id: userId } });
            console.log(`[auth.register] Rolled back user ${userId}`);
          } catch (deleteErr) {
            const deleteMsg = deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
            console.error('[auth.register] Failed to rollback user:', deleteMsg);
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
