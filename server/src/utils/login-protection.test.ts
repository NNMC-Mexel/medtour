import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCKOUT_THRESHOLD,
  clearedLoginProtection,
  failureWindowStart,
  isResetTokenExpired,
  lockRemainingSeconds,
  lockUntil,
  needsLoginProtectionReset,
  reachesLockout,
  resetTokenExpiry,
} from './login-protection';

const NOW = new Date('2026-10-10T10:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const minutesAhead = (m: number) => new Date(NOW.getTime() + m * 60_000).toISOString();

test('failures older than 60 minutes no longer count', () => {
  assert.equal(failureWindowStart(NOW).toISOString(), minutesAgo(60));
});

test(`lock starts at ${LOCKOUT_THRESHOLD} failures and lasts 15 minutes`, () => {
  assert.equal(reachesLockout(LOCKOUT_THRESHOLD - 1), false);
  assert.equal(reachesLockout(LOCKOUT_THRESHOLD), true);
  assert.equal(reachesLockout(LOCKOUT_THRESHOLD + 5), true, 'parallel requests can overshoot the threshold');
  assert.equal(reachesLockout(null), false);
  assert.equal(lockUntil(NOW).toISOString(), minutesAhead(15));
});

test('lockRemainingSeconds: open, locked, expired lock', () => {
  assert.equal(lockRemainingSeconds({}, NOW), 0);
  assert.equal(lockRemainingSeconds({ loginLockedUntil: minutesAhead(15) }, NOW), 900);
  assert.equal(lockRemainingSeconds({ loginLockedUntil: minutesAgo(1) }, NOW), 0);
  assert.equal(lockRemainingSeconds({ loginLockedUntil: 'garbage' }, NOW), 0);
});

test('needsLoginProtectionReset only when there is something to clear', () => {
  assert.equal(needsLoginProtectionReset({}), false);
  assert.equal(needsLoginProtectionReset({ failedLoginCount: 0, loginLockedUntil: null }), false);
  assert.equal(needsLoginProtectionReset({ failedLoginCount: 2 }), true);
  assert.equal(needsLoginProtectionReset({ loginLockedUntil: minutesAhead(5) }), true);
  assert.deepEqual(clearedLoginProtection(), { failedLoginCount: 0, lastFailedLoginAt: null, loginLockedUntil: null });
});

test('reset token expiry: self-service 1 hour, admin 24 hours', () => {
  assert.equal(resetTokenExpiry('self', NOW), minutesAhead(60));
  assert.equal(resetTokenExpiry('admin', NOW), minutesAhead(24 * 60));
});

test('isResetTokenExpired: future valid, past and missing expired', () => {
  assert.equal(isResetTokenExpired({ resetPasswordTokenExpiresAt: minutesAhead(1) }, NOW), false);
  assert.equal(isResetTokenExpired({ resetPasswordTokenExpiresAt: minutesAgo(1) }, NOW), true);
  assert.equal(isResetTokenExpired({ resetPasswordTokenExpiresAt: NOW.toISOString() }, NOW), true);
  assert.equal(isResetTokenExpired({}, NOW), true, 'legacy token without expiry must not live forever');
});
