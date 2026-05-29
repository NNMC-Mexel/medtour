/**
 * PII encryption-at-rest for restricted-access personal data (RK Law 94-V, art.10).
 *
 * Used for `iin` and `passportNumber` on the users-permissions user. Values are
 * encrypted with AES-256-GCM before they hit the database (via db lifecycles in
 * src/index.ts) and decrypted on read, so application code and the Strapi admin
 * panel keep seeing plaintext while the data at rest (DB, backups, SQL logs) is
 * ciphertext.
 *
 * Storage format:  enc:v1:<base64 iv>:<base64 auth-tag>:<base64 ciphertext>
 *
 * Key: PII_ENCRYPTION_KEY env, 32 bytes as 64 hex chars OR base64. If absent or
 * malformed, encryption is a no-op (values stay plaintext) and a warning is
 * logged at boot — this keeps dev/test environments working without a key but
 * must NOT be the case in production.
 *
 * Legacy plaintext (records that predate this feature) is detected by the
 * missing `enc:v1:` prefix and passed through untouched, so a gradual
 * "encrypt on next write" migration is safe.
 */
import crypto from 'node:crypto';

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';

let cachedKey: Buffer | null | undefined;

function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;

  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    cachedKey = null;
    return null;
  }

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }

  cachedKey = key.length === 32 ? key : null;
  return cachedKey;
}

export function isPiiEncryptionEnabled(): boolean {
  return getKey() !== null;
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptPII(plain: unknown): unknown {
  if (plain === null || plain === undefined || plain === '') return plain;
  if (typeof plain !== 'string') return plain;
  if (isEncrypted(plain)) return plain; // already encrypted — never double-encrypt

  const key = getKey();
  if (!key) return plain; // no key configured — leave as-is (warned at boot)

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptPII(value: unknown): unknown {
  if (!isEncrypted(value)) return value; // legacy plaintext / null / non-string

  const key = getKey();
  if (!key) return value;

  try {
    const parts = (value as string).split(':');
    // parts = ['enc', 'v1', iv, tag, ciphertext]
    const iv = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const ciphertext = Buffer.from(parts[4], 'base64');

    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    return value; // tampered / wrong key — fail closed by returning ciphertext
  }
}

/**
 * Mask a (decrypted) PII value for callers who are not allowed to see the full
 * value: keep only the last 4 characters. Returns null for empty input.
 */
export function maskPII(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value);
  if (s.startsWith(PREFIX)) return '****'; // safety: never echo raw ciphertext as a "mask"
  if (s.length <= 4) return '****';
  return '*'.repeat(s.length - 4) + s.slice(-4);
}

const PII_FIELDS = ['iin', 'passportNumber'] as const;

/** Encrypt PII fields in-place on a write payload (beforeCreate/beforeUpdate). */
export function encryptUserPII(data: Record<string, any> | undefined | null): void {
  if (!data) return;
  for (const field of PII_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      data[field] = encryptPII(data[field]);
    }
  }
}

/** Decrypt PII fields in-place on a read result (after-find / after-write hooks). */
export function decryptUserPII(row: Record<string, any> | undefined | null): void {
  if (!row || typeof row !== 'object') return;
  for (const field of PII_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      row[field] = decryptPII(row[field]);
    }
  }
}

/** Roles allowed to see the full (unmasked) IIN / passport in API output. */
const FULL_PII_ROLES = new Set(['admin', 'manager', 'coordinator']);

export function canSeeFullPII(role: string | undefined | null): boolean {
  return !!role && FULL_PII_ROLES.has(role);
}

/** Replace PII fields with masked values in-place for non-privileged callers. */
export function maskUserPIIForRole(row: Record<string, any> | undefined | null, role: string | undefined | null): void {
  if (!row || typeof row !== 'object') return;
  if (canSeeFullPII(role)) return;
  for (const field of PII_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      row[field] = maskPII(row[field]);
    }
  }
}
