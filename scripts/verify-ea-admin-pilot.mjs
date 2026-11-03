#!/usr/bin/env node
// Read-only E&A early-access operational gate; never uses credentials or writes leads.
import assert from 'node:assert/strict';

const DEFAULT_BASE = 'https://enchev-auctions.vercel.app';

export async function auditEaAdmin(baseUrl, request = fetch) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new Error('Audit requires HTTPS');
  const problems = [];
  const get = async (path) => {
    const url = new URL(path, base);
    if (url.origin !== base.origin) throw new Error('Cross-origin audit not allowed');
    const response = await request(url.toString(), {
      method: 'GET', redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    let json = null;
    try { json = await response.json(); } catch { /* invalid response recorded below */ }
    return { status: response.status, json };
  };

  const publicSignup = await get('/api/ea-early-access');
  if (publicSignup.status !== 200 || publicSignup.json?.ok !== true ||
      !Number.isSafeInteger(publicSignup.json?.count) || publicSignup.json.count < 0) {
    problems.push('PUBLIC_SIGNUP_COUNT_UNAVAILABLE');
  }
  if (publicSignup.json && ('rows' in publicSignup.json || 'emails' in publicSignup.json)) {
    problems.push('PUBLIC_SIGNUP_PERSONAL_DATA_EXPOSED');
  }

  const adminSession = await get('/api/ea-early-access/admin/session');
  if (adminSession.status !== 200 || adminSession.json?.authenticated !== false ||
      typeof adminSession.json?.configured !== 'boolean') {
    problems.push('ADMIN_SESSION_UNEXPECTED_RESPONSE');
  }

  const protectedList = await get('/api/ea-early-access/admin');
  if (protectedList.status !== 401) problems.push('ADMIN_LIST_NOT_REJECTING_UNAUTHENTICATED');
  if (protectedList.json && ('rows' in protectedList.json || 'emails' in protectedList.json)) {
    problems.push('ADMIN_LIST_PERSONAL_DATA_EXPOSED');
  }

  return {
    target: base.origin,
    check: problems.length === 0 ? 'PASS' : 'FAIL',
    state: problems.length ? 'RED_RUNTIME_CONTRACT' :
      adminSession.json?.configured === false ? 'YELLOW_ADMIN_CONFIGURATION_PENDING' :
      'YELLOW_ADMIN_LOGIN_AND_DB_UNVERIFIED',
    signup_count: publicSignup.json?.ok === true ? publicSignup.json.count : null,
    admin_configured: adminSession.json?.configured ?? null,
    unauthenticated_admin_http: protectedList.status,
    problems,
    note: 'An unauthenticated read-only audit cannot certify admin login or database listing GREEN.',
  };
}

async function selfTest() {
  const mock = (configured, listStatus = 401) => async (url) => {
    const path = new URL(url).pathname;
    const data = path === '/api/ea-early-access' ? { ok: true, count: 2 } :
      path === '/api/ea-early-access/admin/session' ? { authenticated: false, configured } :
      { ok: false, message: 'Unauthorized' };
    return { status: path === '/api/ea-early-access/admin' ? listStatus : 200, json: async () => data };
  };
  const pending = await auditEaAdmin(DEFAULT_BASE, mock(false));
  assert.equal(pending.check, 'PASS');
  assert.equal(pending.state, 'YELLOW_ADMIN_CONFIGURATION_PENDING');
  const configured = await auditEaAdmin(DEFAULT_BASE, mock(true));
  assert.equal(configured.check, 'PASS');
  assert.equal(configured.state, 'YELLOW_ADMIN_LOGIN_AND_DB_UNVERIFIED');
  const insecure = await auditEaAdmin(DEFAULT_BASE, mock(true, 200));
  assert.equal(insecure.check, 'FAIL');
  assert(insecure.problems.includes('ADMIN_LIST_NOT_REJECTING_UNAUTHENTICATED'));
  console.log('EA ADMIN PILOT AUDIT self-test PASS (3 scenarios)');
}

if (process.argv.includes('--self-test')) {
  await selfTest();
} else {
  try {
    const result = await auditEaAdmin(process.env.ENCHEV_AUDIT_BASE_URL || DEFAULT_BASE);
    console.log(JSON.stringify(result, null, 2));
    if (result.check !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({check:'FAIL',state:'RED_AUDIT_UNAVAILABLE',message:error instanceof Error?error.message:'Audit failed'}));
    process.exitCode = 1;
  }
}
