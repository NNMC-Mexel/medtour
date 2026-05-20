'use strict';

/**
 * Staging API smoke for case-first chat/workspace.
 *
 * Required env:
 *   API_URL=http://localhost:1340
 *   CASE_ID=<medical-case documentId>
 *   PATIENT_JWT=...
 *   MANAGER_JWT=...
 *
 * Optional:
 *   ADMIN_JWT=...
 *   DOCTOR_JWT=...
 *   OTHER_PATIENT_JWT=...  (negative RBAC check)
 */

const API_URL = process.env.API_URL || 'http://localhost:1340';
const CASE_ID = process.env.CASE_ID;

const TOKENS = {
  patient: process.env.PATIENT_JWT,
  manager: process.env.MANAGER_JWT,
  admin: process.env.ADMIN_JWT,
  doctor: process.env.DOCTOR_JWT,
  otherPatient: process.env.OTHER_PATIENT_JWT,
};

function requireEnv(name, value) {
  if (!value) {
    console.error(`[FAIL] ${name} is required`);
    process.exitCode = 1;
  }
}

async function request(method, path, token, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);
  return { response, json };
}

function ok(condition, label, details = '') {
  if (condition) console.log(`  [OK] ${label}`);
  else {
    console.error(`  [FAIL] ${label}${details ? `: ${details}` : ''}`);
    process.exitCode = 1;
  }
}

async function runSmoke() {
  console.log('=== Chat/workspace API smoke ===\n');
  requireEnv('CASE_ID', CASE_ID);
  requireEnv('PATIENT_JWT', TOKENS.patient);
  requireEnv('MANAGER_JWT', TOKENS.manager);
  if (process.exitCode) process.exit(process.exitCode);

  const patientCaseChat = await request('GET', `/api/conversations/for-case/${encodeURIComponent(CASE_ID)}`, TOKENS.patient);
  ok(patientCaseChat.response.ok, 'patient can open own case chat', patientCaseChat.json?.error?.message);
  const conversationId = patientCaseChat.json?.data?.documentId || patientCaseChat.json?.data?.id;
  ok(Boolean(conversationId), 'case chat returns conversation id');

  const patientMessage = await request('POST', '/api/messages', TOKENS.patient, {
    data: {
      conversation: conversationId,
      content: `Smoke patient message ${new Date().toISOString()}`,
    },
  });
  ok(patientMessage.response.ok, 'patient can send message', patientMessage.json?.error?.message);

  const managerMessages = await request('GET', `/api/conversations/${encodeURIComponent(conversationId)}/messages`, TOKENS.manager);
  ok(managerMessages.response.ok, 'manager can read assigned/shared case chat', managerMessages.json?.error?.message);
  ok((managerMessages.json?.data || []).length > 0, 'message history is persistent');

  const takeover = await request('PUT', `/api/conversations/${encodeURIComponent(conversationId)}/takeover`, TOKENS.manager);
  ok(takeover.response.ok, 'manager can take over chat', takeover.json?.error?.message);

  const read = await request('PUT', `/api/conversations/${encodeURIComponent(conversationId)}/read`, TOKENS.manager);
  ok(read.response.ok, 'manager can mark chat as read', read.json?.error?.message);

  const managerCase = await request('GET', `/api/medical-cases/${encodeURIComponent(CASE_ID)}`, TOKENS.manager);
  ok(managerCase.response.ok, 'manager workspace can load medical case', managerCase.json?.error?.message);

  if (TOKENS.admin) {
    const adminConversation = await request('GET', `/api/conversations/${encodeURIComponent(conversationId)}`, TOKENS.admin);
    ok(adminConversation.response.ok, 'admin can read all chats', adminConversation.json?.error?.message);
  }

  if (TOKENS.doctor) {
    const doctorConversation = await request('GET', `/api/conversations/${encodeURIComponent(conversationId)}`, TOKENS.doctor);
    const doctorAllowed = doctorConversation.response.ok;
    const doctorForbidden = doctorConversation.response.status === 403 || doctorConversation.response.status === 404;
    ok(doctorAllowed || doctorForbidden, 'doctor chat access is explicitly allowed or denied by doctorChatEnabled');
  }

  if (TOKENS.otherPatient) {
    const otherPatientConversation = await request('GET', `/api/conversations/${encodeURIComponent(conversationId)}`, TOKENS.otherPatient);
    ok(!otherPatientConversation.response.ok, 'other patient cannot read case chat');
  }

  if (process.exitCode) process.exit(process.exitCode);
  console.log('\nChat/workspace API smoke OK.');
}

runSmoke().catch((error) => {
  console.error(error);
  process.exit(1);
});
