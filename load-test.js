import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import { createCoverage } from '/coverage.js';

// ---------------------------------------------------------------------------
// k6 load test of the BFF User.
//
// Every operation of the contract (contracts/openapi.json, mounted as /openapi.json) has one
// handler below: the shared OpenAPI coverage module (mairie360/CICD tests/k6/coverage.js, see
// performance_test.sh) aborts at init when an operation has no handler, and fails the
// `operations_uncovered` threshold when a handler ends without sending its request. Adding a route
// to the BFF therefore means adding its handler here.
//
// Two scenarios share the handlers:
// - `crud` (2 VUs): `coverage.run()` calls every handler once per iteration, reads and writes, so
//   it carries the coverage gate. Handlers run path by path in contract order and, for one path,
//   in the order get, put, post, delete, options, head, patch, trace (so DELETE runs before PATCH).
//   Each iteration is one self-contained admin scenario: the resources a handler creates (users,
//   roles, groups, refresh token) are kept in `state` for the handlers that follow. The DELETE
//   handlers remove a disposable resource, the kept ones are removed by `cleanup()` at the end of
//   the iteration.
// - `reads` (up to 20 VUs): replays only the GET handlers, which read seeded fixtures and never
//   depend on `state`.
// Every operation gets a p(95) threshold, whose budget depends on its family (`budgetOf`).
// ---------------------------------------------------------------------------

// Must match the JWT_SECRET of the core-api / bff-user services of the test stack.
const JWT_SECRET = __ENV.JWT_SECRET || 'b"secret"';
// User role only, seeded by init-test.sql: session reads.
const USER_ID = __ENV.PERF_USER_ID || '2';
// Admin role (seeded by the liquibase migrations): /bff/admin/* and the login flow.
const ADMIN_ID = __ENV.PERF_ADMIN_ID || '1';
// Role and group seeded by init-test.sql, used by the role and group membership operations.
const FIXTURE_ROLE_ID = 10;
const FIXTURE_GROUP_ID = 10;
const ADMIN_PASSWORD = 'Perf-Admin-Passw0rd';
const USER_PASSWORD = 'Perf-User-Passw0rd';

// State of the current iteration (module scope is per VU in k6).
let state = {};

function b64url(value) {
  return encoding.b64encode(value, 'rawurl');
}

// Minimal HS256 JWT accepted by Core API (sub + role + exp claims).
function mintJwt(sub, role) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub, role, exp: now + 3600 }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.hmac('sha256', JWT_SECRET, signingInput, 'base64rawurl');
  return `${signingInput}.${signature}`;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

function unique(prefix) {
  return `${prefix}-${__VU}-${__ITER}-${Date.now()}`;
}

function need(value, what) {
  if (value === undefined || value === null) {
    throw new Error(`${what} is missing, an earlier handler of this iteration failed`);
  }
  return value;
}

function json(response) {
  try {
    return response.json();
  } catch (_) {
    return null;
  }
}

// Core API bug (core-api 1.2.0): POST /api/v1/groups/{id}/users/ swaps user_id and group_id in
// its INSERT, so adding a member answers 404 "Unknow user." (foreign key violation) and removing
// it answers 404 as well. Both are accepted until Core API is fixed; any other status still fails.
const memberStatuses = { responseCallback: http.expectedStatuses(200, 201, 204, 404) };

const handlers = {
  // --- Connectivity (public) ---
  'GET /health': ({ request }) =>
    check(request(), { 'health 200': (r) => r.status === 200 }),
  'GET /check_apis': ({ request }) =>
    check(request(), { 'check_apis 200': (r) => r.status === 200 }),

  // --- Authentication (public) ---
  // Logs the admin in: the refresh token feeds /bff/admin/sessions/refresh and /revoke.
  'POST /auth/login': ({ request, data }) => {
    const res = request({ body: { email: data.adminEmail, password: ADMIN_PASSWORD, device_info: 'k6' } });
    check(res, { 'login 200': (r) => r.status === 200 });
    state.refreshToken = (json(res) || {}).refresh_token;
  },
  'POST /auth/register': ({ request }) => {
    state.registeredEmail = `${unique('perf-register')}@perf.mairie360.fr`;
    const res = request({
      body: { email: state.registeredEmail, first_name: 'Perf', last_name: 'Register', password: USER_PASSWORD },
    });
    check(res, { 'register 201': (r) => r.status === 201 });
  },
  // The first sign-in of the user registered above answers 412 with the one-time token.
  'POST /auth/force_change_password': ({ request }) => {
    const firstLogin = http.post(
      coverage.url('POST /auth/login'),
      JSON.stringify({ email: need(state.registeredEmail, 'registered user'), password: USER_PASSWORD, device_info: 'k6' }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { op: 'POST /auth/login' },
        responseCallback: http.expectedStatuses(412),
      },
    );
    check(firstLogin, { 'first login 412': (r) => r.status === 412 });
    const res = request({ body: { token: need((json(firstLogin) || {}).token, 'one-time token'), new_password: `${USER_PASSWORD}-2` } });
    check(res, { 'force_change_password 204': (r) => r.status === 204 });
  },
  'POST /auth/logout': ({ request }) =>
    check(request(), { 'logout 200': (r) => r.status === 200 }),

  // --- User ---
  'GET /user/{userId}/about': ({ request }) =>
    check(request({ path: { userId: USER_ID } }), { 'about 200': (r) => r.status === 200 }),

  // --- Admin: users ---
  'GET /bff/admin/users': ({ request, data }) =>
    check(request({ query: { page: 1, page_size: 20 }, headers: data.admin }), {
      'admin users 200': (r) => r.status === 200,
    }),
  // Core answers without the id: it is read back from the admin listing.
  'POST /bff/admin/users': ({ request, data }) => {
    const email = `${unique('perf-admin-user')}@perf.mairie360.fr`;
    const res = request({
      body: { email, first_name: 'Perf', last_name: 'Managed', password: USER_PASSWORD },
      headers: data.admin,
    });
    check(res, { 'create user 201': (r) => r.status === 201 });
    state.userId = findUserId(email, data);
  },
  'PATCH /bff/admin/users/{userId}': ({ request, data }) =>
    check(request({ path: { userId: need(state.userId, 'created user') }, body: { first_name: 'Patched' }, headers: data.admin }), {
      'patch user 200': (r) => r.status === 200,
    }),
  // Deletes the user registered by POST /auth/register, the created one is still needed below.
  'DELETE /bff/admin/users/{userId}': ({ request, data }) => {
    const userId = findUserId(need(state.registeredEmail, 'registered user'), data);
    check(request({ path: { userId: need(userId, 'registered user id') }, headers: data.admin }), {
      'delete user 2xx': (r) => r.status === 200 || r.status === 204,
    });
  },
  'PATCH /bff/admin/users/{userId}/password': ({ request, data }) =>
    check(request({ path: { userId: need(state.userId, 'created user') }, body: { new_password: `${USER_PASSWORD}-3` }, headers: data.admin }), {
      'reset password 204': (r) => r.status === 204,
    }),
  'POST /bff/admin/users/{userId}/roles': ({ request, data }) =>
    check(request({ path: { userId: need(state.userId, 'created user') }, body: { role_id: FIXTURE_ROLE_ID }, headers: data.admin }), {
      'add role 200': (r) => r.status === 200,
    }),
  'DELETE /bff/admin/users/{userId}/roles/{roleId}': ({ request, data }) =>
    check(request({ path: { userId: need(state.userId, 'created user'), roleId: FIXTURE_ROLE_ID }, headers: data.admin }), {
      'remove role 204': (r) => r.status === 204,
    }),

  // --- Admin: roles ---
  'GET /bff/admin/roles': ({ request, data }) =>
    check(request({ headers: data.admin }), { 'roles 200': (r) => r.status === 200 }),
  // Two roles: one kept for PUT/PATCH, one for DELETE (which runs before PATCH). Core answers
  // without the id: both are read back from the role listing.
  'POST /bff/admin/roles': ({ request, data }) => {
    const names = [unique('perf-role'), unique('perf-role-deleted')];
    for (const name of names) {
      check(request({ body: { name, description: 'k6 role' }, headers: data.admin }), {
        'create role 200': (r) => r.status === 200,
      });
    }
    const listing = http.get(coverage.url('GET /bff/admin/roles'), {
      headers: data.admin,
      tags: { op: 'GET /bff/admin/roles' },
    });
    const roles = (json(listing) || {}).roles || [];
    [state.roleId, state.disposableRoleId] = names.map((name) => {
      const role = roles.find((r) => r.name === name);
      return role ? role.id : undefined;
    });
  },
  'PUT /bff/admin/roles/{roleId}': ({ request, data }) =>
    check(request({ path: { roleId: need(state.roleId, 'created role') }, body: { name: unique('perf-role-put'), description: 'k6 role, replaced' }, headers: data.admin }), {
      'put role 200': (r) => r.status === 200,
    }),
  'PATCH /bff/admin/roles/{roleId}': ({ request, data }) =>
    check(request({ path: { roleId: need(state.roleId, 'created role') }, body: { description: 'k6 role, patched' }, headers: data.admin }), {
      'patch role 200': (r) => r.status === 200,
    }),
  'DELETE /bff/admin/roles/{roleId}': ({ request, data }) =>
    check(request({ path: { roleId: need(state.disposableRoleId, 'disposable role') }, headers: data.admin }), {
      'delete role 204': (r) => r.status === 204,
    }),

  // --- Admin: groups ---
  'GET /bff/admin/groups': ({ request, data }) =>
    check(request({ headers: data.admin }), { 'groups 200': (r) => r.status === 200 }),
  // Two groups: one kept for GET/PATCH, one for DELETE (which runs before PATCH).
  'POST /bff/admin/groups': ({ request, data }) => {
    [state.groupId, state.disposableGroupId] = [unique('perf-group'), unique('perf-group-deleted')].map((name) => {
      const res = request({ body: { name, description: 'k6 group' }, headers: data.admin });
      check(res, { 'create group 200': (r) => r.status === 200 });
      return (json(res) || {}).id;
    });
  },
  'GET /bff/admin/groups/{groupId}': ({ request, data }) =>
    check(request({ path: { groupId: FIXTURE_GROUP_ID }, headers: data.admin }), {
      'group 200': (r) => r.status === 200,
    }),
  'PATCH /bff/admin/groups/{groupId}': ({ request, data }) =>
    check(request({ path: { groupId: need(state.groupId, 'created group') }, body: { description: 'k6 group, patched' }, headers: data.admin }), {
      'patch group 200': (r) => r.status === 200,
    }),
  'DELETE /bff/admin/groups/{groupId}': ({ request, data }) =>
    check(request({ path: { groupId: need(state.disposableGroupId, 'disposable group') }, headers: data.admin }), {
      'delete group 204': (r) => r.status === 204,
    }),
  'GET /bff/admin/groups/{groupId}/users': ({ request, data }) =>
    check(request({ path: { groupId: FIXTURE_GROUP_ID }, headers: data.admin }), {
      'group members 200': (r) => r.status === 200,
    }),
  'POST /bff/admin/groups/{groupId}/users': ({ request, data }) =>
    check(request({ path: { groupId: FIXTURE_GROUP_ID }, body: { user_id: need(state.userId, 'created user') }, headers: data.admin, params: memberStatuses }), {
      'add member 201 (404: Core bug)': (r) => r.status === 201 || r.status === 404,
    }),
  'DELETE /bff/admin/groups/{groupId}/users/{userId}': ({ request, data }) =>
    check(request({ path: { groupId: FIXTURE_GROUP_ID, userId: need(state.userId, 'created user') }, headers: data.admin, params: memberStatuses }), {
      'remove member 204 (404: Core bug)': (r) => r.status === 204 || r.status === 404,
    }),

  // --- Admin: sessions ---
  'GET /bff/admin/sessions': ({ request, data }) =>
    check(request({ headers: data.admin }), { 'sessions 200': (r) => r.status === 200 }),
  'GET /bff/admin/sessions/history': ({ request, data }) =>
    check(request({ headers: data.admin }), { 'sessions history 200': (r) => r.status === 200 }),
  // Core API does not rotate the refresh token: the one of POST /auth/login is refreshed, then
  // revoked (Core API only revokes the caller's own sessions, hence the admin login).
  'POST /bff/admin/sessions/refresh': ({ request, data }) =>
    check(request({ body: { refresh_token: need(state.refreshToken, 'admin refresh token') }, headers: data.admin }), {
      'refresh 200': (r) => r.status === 200,
    }),
  'POST /bff/admin/sessions/revoke': ({ request, data }) =>
    check(request({ body: { refresh_token: need(state.refreshToken, 'admin refresh token') }, headers: data.admin }), {
      'revoke 200': (r) => r.status === 200,
    }),

  // --- Session reads ---
  'GET /me': ({ request }) =>
    check(request(), { 'me 200': (r) => r.status === 200 }),
  'GET /session/me': ({ request }) =>
    check(request(), { 'session/me 200': (r) => r.status === 200 }),
};

const coverage = createCoverage(handlers);
const readOperations = coverage.operations.filter((o) => o.method === 'GET');

// Deletes the resources kept by the handlers, so that the listings do not grow during the test.
function cleanup(data) {
  const kept = [
    ['DELETE /bff/admin/users/{userId}', { userId: state.userId }],
    ['DELETE /bff/admin/roles/{roleId}', { roleId: state.roleId }],
    ['DELETE /bff/admin/groups/{groupId}', { groupId: state.groupId }],
  ];
  for (const [op, pathParams] of kept) {
    if (Object.values(pathParams).some((id) => id === undefined || id === null)) continue;
    http.del(coverage.url(op, pathParams), null, { headers: data.admin, tags: { op } });
  }
}

function findUserId(email, data) {
  const listing = http.get(coverage.url('GET /bff/admin/users', {}, { search: email }), {
    headers: data.admin,
    tags: { op: 'GET /bff/admin/users' },
  });
  const user = ((json(listing) || {}).users || []).find((u) => u.email === email);
  return user ? user.id : undefined;
}

// p(95) budget of an operation, per family.
function budgetOf({ op, method, path }) {
  if (op === 'GET /health') return 50; // process probe
  if (op === 'GET /check_apis') return 150; // -> Core /health
  if (path.startsWith('/auth/')) return 800; // sign-in flow, Core writes the session
  if (method === 'GET') return 500; // BFF aggregation + Core reads
  return 800; // admin writes
}

const perOperationThresholds = {};
for (const operation of coverage.operations) {
  perOperationThresholds[`http_req_duration{op:${operation.op}}`] = [`p(95)<${budgetOf(operation)}`];
}

export const options = {
  scenarios: {
    reads: {
      executor: 'ramping-vus',
      exec: 'reads',
      stages: [
        { duration: '30s', target: 20 }, // ramp-up
        { duration: '1m', target: 20 }, // steady load
        { duration: '10s', target: 0 }, // ramp-down
      ],
    },
    crud: {
      executor: 'constant-vus',
      exec: 'crud',
      vus: 2,
      duration: '1m40s',
    },
  },
  thresholds: {
    ...coverage.thresholds,
    ...perOperationThresholds,
    http_req_failed: ['rate<0.01'], // < 1% errors
    checks: ['rate>0.99'],
  },
};

// The admin signs in with a known password, set once through the admin password reset.
export function setup() {
  const admin = bearer(mintJwt(ADMIN_ID, 'admin'));
  const about = http.get(coverage.url('GET /user/{userId}/about', { userId: ADMIN_ID }), { headers: admin });
  const adminEmail = (json(about) || {}).email;
  const reset = http.patch(
    coverage.url('PATCH /bff/admin/users/{userId}/password', { userId: ADMIN_ID }),
    JSON.stringify({ new_password: ADMIN_PASSWORD }),
    { headers: Object.assign({ 'Content-Type': 'application/json' }, admin) },
  );
  if (!adminEmail || reset.status !== 204) {
    throw new Error(`setup: cannot prepare the admin sign-in (about ${about.status}, password reset ${reset.status})`);
  }
  return { adminEmail, admin, user: bearer(mintJwt(USER_ID, 'user')) };
}

// Every GET handler, with a plain request() (no coverage accounting: `crud` owns the gate).
export function reads(data) {
  for (const operation of readOperations) {
    const request = (call = {}) =>
      http.get(coverage.url(operation.op, call.path, call.query), {
        headers: Object.assign({}, data.user, call.headers),
        tags: { op: operation.op },
      });
    handlers[operation.op]({ request, data, op: operation.op, method: operation.method, path: operation.path });
  }
  sleep(1);
}

export function crud(data) {
  state = {};
  // User token by default; the /bff/admin/* handlers pass the admin one.
  coverage.run({ headers: data.user, data });
  cleanup(data);
  sleep(1);
}
