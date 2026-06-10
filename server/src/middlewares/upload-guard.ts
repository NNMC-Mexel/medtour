/**
 * Upload guard middleware — MIME-type, extension and size whitelist for /api/upload.
 *
 * Background: Strapi's default /api/upload accepts any file from any authenticated
 * user. Combined with the file-proxy that serves files inline with their original
 * Content-Type, this allowed:
 *   - Stored XSS via .html or .svg with <script> (Content-Type: text/html / image/svg+xml)
 *   - Malware hosting via .exe / .php / .jsp / .bat / .py on a trusted domain
 *
 * This middleware rejects anything outside the whitelist BEFORE Strapi writes
 * to MinIO. Applied globally because the upload route lives inside the
 * users-permissions plugin and is awkward to wrap per-route.
 */

const ALLOWED_MIME = new Set<string>([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Video (consultation recordings, patient guide videos)
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

// Positive allowlist of extensions, mirroring ALLOWED_MIME. This is the PRIMARY
// gate: the upstream body parser (koa-body + formidable v2) collapses every
// multipart part's MIME to "application/octet-stream", so we cannot rely on the
// reported MIME at this layer — extension + the denylist below are authoritative.
const ALLOWED_EXTENSIONS = new Set<string>([
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  // Images
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  // Video (consultation recordings, patient guide videos)
  '.mp4', '.webm', '.mov',
]);

// Always rejected, regardless of MIME — defence in depth against MIME spoofing.
const DENIED_EXTENSIONS = new Set<string>([
  // Script / markup (XSS vector when served back inline)
  '.svg', '.svgz',
  '.html', '.htm', '.xhtml', '.shtml',
  '.xml', '.xsl', '.xslt',
  '.js', '.mjs', '.cjs',
  '.css',
  // Server-side execution
  '.php', '.php3', '.php4', '.php5', '.phtml', '.phar',
  '.jsp', '.jspx',
  '.asp', '.aspx', '.cer', '.asa',
  '.cgi', '.pl', '.py', '.rb',
  // Native executables / installers
  '.exe', '.dll', '.scr', '.com', '.msi', '.msp',
  '.sh', '.bash', '.zsh', '.ksh',
  '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.vbe', '.wsf',
  // Mac / iOS
  '.app', '.command', '.workflow',
  // Other dangerous formats often abused
  '.jar', '.war', '.ear',
  '.swf',
]);

const MAX_FILE_BYTES = 50 * 1024 * 1024;       // 50 MB per file
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;     // 200 MB per request

function lastExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx).toLowerCase();
}

function isAllowedFile(file: any): { ok: true } | { ok: false; reason: string } {
  if (!file) return { ok: false, reason: 'Empty file payload' };

  const name: string = file.name || file.originalFilename || file.newFilename || '';
  const mime: string = file.type || file.mimetype || '';
  const size: number = typeof file.size === 'number' ? file.size : 0;

  // Reject double extensions where the last segment is denied (e.g. invoice.pdf.exe)
  const ext = lastExtension(name);
  if (DENIED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `File extension "${ext}" is not allowed` };
  }

  // Primary gate: extension must be on the allowlist. The body parser reports
  // MIME as octet-stream for every part, so the extension is the reliable signal.
  if (!ext) {
    return { ok: false, reason: 'File must have an extension' };
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `File extension "${ext}" is not allowed` };
  }

  // Secondary gate: only enforce MIME when the parser actually resolved a real
  // type. "application/octet-stream" and empty are treated as "unknown" and fall
  // back to the extension check above.
  const normalizedMime = mime.toLowerCase();
  if (normalizedMime && normalizedMime !== 'application/octet-stream' && !ALLOWED_MIME.has(normalizedMime)) {
    return { ok: false, reason: `MIME type "${mime}" is not allowed` };
  }

  if (size > MAX_FILE_BYTES) {
    return { ok: false, reason: `File exceeds the ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB per-file limit` };
  }

  return { ok: true };
}

export default (_config, _ctx) => {
  return async (ctx, next) => {
    // Only enforce on the Strapi public upload endpoint.
    // Admin panel uploads go through /admin and use ADMIN_JWT — already
    // gated by Strapi's admin auth, and admins are trusted.
    const path = ctx.request.path || '';
    const isUploadRoute = (
      ctx.request.method === 'POST' &&
      (path === '/api/upload' || path === '/upload' || path.startsWith('/api/upload/'))
    );

    if (!isUploadRoute) return next();

    const files = (ctx.request as any).files || {};
    // koa-body / formidable can stash a single file under `files.files` either as
    // an object or an array; sometimes also under arbitrary field names.
    const candidates: any[] = [];
    for (const key of Object.keys(files)) {
      const value = files[key];
      if (Array.isArray(value)) candidates.push(...value);
      else if (value) candidates.push(value);
    }

    if (candidates.length === 0) return next(); // no files to inspect — let Strapi handle

    let totalBytes = 0;
    for (const file of candidates) {
      const check = isAllowedFile(file);
      if (check.ok === false) {
        ctx.status = 415;
        ctx.body = {
          data: null,
          error: {
            status: 415,
            name: 'UnsupportedMediaType',
            message: check.reason,
            details: { filename: file.name || file.originalFilename || null },
          },
        };
        return;
      }
      totalBytes += typeof file.size === 'number' ? file.size : 0;
    }

    if (totalBytes > MAX_TOTAL_BYTES) {
      ctx.status = 413;
      ctx.body = {
        data: null,
        error: {
          status: 413,
          name: 'PayloadTooLarge',
          message: `Total upload exceeds the ${Math.floor(MAX_TOTAL_BYTES / 1024 / 1024)} MB request limit`,
        },
      };
      return;
    }

    return next();
  };
};
