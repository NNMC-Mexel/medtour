/**
 * Permissions-Policy — отключает браузерные API, которые платформе не нужны.
 * helmet в составе `strapi::security` этот заголовок не выставляет.
 *
 * camera/microphone разрешены для self: на них держится видеоконсультация.
 */

const POLICY = [
  'camera=(self)',
  'microphone=(self)',
  'display-capture=(self)',
  'fullscreen=(self)',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'serial=()',
  'bluetooth=()',
  'magnetometer=()',
  'accelerometer=()',
  'gyroscope=()',
  'midi=()',
  'interest-cohort=()',
].join(', ');

export default () => {
  return async (ctx, next) => {
    ctx.set('Permissions-Policy', POLICY);
    return next();
  };
};
