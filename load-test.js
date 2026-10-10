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
// - `me_rush`: `GET /me` as seeded agents at a fixed arrival rate (MAIR-474), failing if k6 has to
//   drop iterations because the BFF (and Core behind it) no longer keeps up.
// Every operation gets a p(95) threshold, whose budget depends on its family (`budgetOf`).
//
// MAIR-474: the stack also runs init-perf.sql (10 000 agents in 2 000 groups, their sessions), the
// session reads run as a random seeded agent, the admin listings read random pages, every read
// checks that it got the seeded rows, and the thresholds are strict (every check passes, no failed
// request, no dropped iteration). K6_PROFILE sizes the load: `ci` (default) is what the 4 vCPU CI
// runner holds, `stress` is the high load, run by hand to find the breaking point.
// ---------------------------------------------------------------------------

// The JWT_SECRET of the core-api / bff-user services of the test stack: random per run, generated
// by stack_secrets.sh (MAIR-474). No default: nothing is signed with a committed secret.
const JWT_SECRET = __ENV.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set: run ./performance_test.sh, which generates it');
// User role only, seeded by init-test.sql: session reads.
const USER_ID = __ENV.PERF_USER_ID || '2';
// Admin role (seeded by the liquibase migrations): /bff/admin/* and the login flow.
const ADMIN_ID = __ENV.PERF_ADMIN_ID || '1';
// Rows of init-perf.sql: agents 500001..510000, groups 50000..51999 of 20 members each.
const AGENTS = { first: 500001, count: 10000 };
const PERF_GROUPS = { first: 50000, count: 2000, members: 20 };
const ADMIN_PAGE_SIZE = 20;
// The Admin is a member of the first 300 perf groups (plus the scan groups): its group listing.
const ADMIN_GROUPS = 300;

const PROFILES = {
  ci: { readVus: 30, crudVus: 2, rushRate: 30 },
  stress: { readVus: 100, crudVus: 4, rushRate: 100 },
};
const PROFILE = PROFILES[__ENV.K6_PROFILE || 'ci'];
if (!PROFILE) throw new Error(`Unknown K6_PROFILE ${__ENV.K6_PROFILE}: ${Object.keys(PROFILES).join(', ')}`);

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

const randomInt = (max) => Math.floor(Math.random() * max);
const agentTokens = {};

/** A random seeded agent: its id and `Authorization` header (one token per agent and VU). */
function randomAgent() {
  const id = AGENTS.first + randomInt(AGENTS.count);
  if (!agentTokens[id]) agentTokens[id] = bearer(mintJwt(String(id), 'user'));
  return { id, headers: agentTokens[id] };
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

const handlers = {
  // --- Connectivity (public) ---
  'GET /health': ({ request }) =>
    check(request(), { 'health 200': (r) => r.status === 200 }),
  'GET /check_apis': ({ request }) =>
    check(request(), { 'check_apis 200': (r) => r.status === 200 }),

  // --- Authentication (public) ---
  // Logs the admin in: the refresh token (HttpOnly refreshToken cookie, never in the body) feeds
  // /bff/admin/sessions/revoke.
  'POST /auth/login': ({ request, data }) => {
    const res = request({ body: { email: data.adminEmail, password: ADMIN_PASSWORD, device_info: 'k6' } });
    check(res, { 'login 200': (r) => r.status === 200 });
    state.refreshToken = ((res.cookies.refreshToken || [])[0] || {}).value;
  },
  // Accounts created by an admin start with first_connect = true: their first sign-in answers 412
  // with the one-time token. The account is created here (outside the coverage of
  // POST /bff/admin/users, which runs later) and deleted by DELETE /bff/admin/users/{userId}.
  'POST /auth/force_change_password': ({ request, data }) => {
    state.firstConnectEmail = `${unique('perf-first-connect')}@perf.mairie360.fr`;
    const created = http.post(
      coverage.url('POST /bff/admin/users'),
      JSON.stringify({ email: state.firstConnectEmail, first_name: 'Perf', last_name: 'FirstConnect', password: USER_PASSWORD }),
      { headers: Object.assign({ 'Content-Type': 'application/json' }, data.admin), tags: { op: 'POST /bff/admin/users' } },
    );
    check(created, { 'first-connect user 201': (r) => r.status === 201 });
    const firstLogin = http.post(
      coverage.url('POST /auth/login'),
      JSON.stringify({ email: state.firstConnectEmail, password: USER_PASSWORD, device_info: 'k6' }),
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
  // Refreshes a session of its own: Core rotates the refresh token, and the one of POST /auth/login
  // must stay valid for /bff/admin/sessions/revoke.
  'POST /auth/refresh': ({ request, data }) => {
    const login = http.post(
      coverage.url('POST /auth/login'),
      JSON.stringify({ email: data.adminEmail, password: ADMIN_PASSWORD, device_info: 'k6-refresh' }),
      { headers: { 'Content-Type': 'application/json' }, tags: { op: 'POST /auth/login' } },
    );
    const refreshToken = ((login.cookies.refreshToken || [])[0] || {}).value;
    const res = request({ body: { refresh_token: need(refreshToken, 'refresh token of the second login') } });
    check(res, { 'refresh 200': (r) => r.status === 200 });
  },
  'POST /auth/logout': ({ request }) =>
    check(request(), { 'logout 200': (r) => r.status === 200 }),
  // The test stack has no Keycloak: the BFF answers its declared 503 without calling Core.
  'POST /auth/keycloak': ({ request }) =>
    check(
      request({
        // Contract examples: a well-formed sign-in that only fails because Keycloak is not configured.
        body: { code: '7c1e0f5a-2b8d-4f3e-9a61-d4c2b7e8f901.3b5d9e2a-6f14-4c8b-a7d0-1e9f2c4b6a83', redirect_uri: 'https://login.mairie360.fr/auth/callback', code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', nonce: 'n-0S6_WzA2Mj', device_info: 'Firefox 142 on Ubuntu 24.04' },
        params: { responseCallback: http.expectedStatuses(503) },
      }),
      { 'keycloak 503 (not configured)': (r) => r.status === 503 },
    ),

  // --- User ---
  'GET /user/{userId}/about': ({ request }) => {
    const agent = randomAgent();
    check(request({ path: { userId: agent.id }, headers: agent.headers }), {
      'about 200': (r) => r.status === 200,
      'about reads the seeded agent': (r) => r.status === 200 && r.json('email') === `perf.agent.${agent.id}@mairie360.fr`,
    });
  },

  // --- Admin: users ---
  // Any page of the 10 000 seeded agents, deep ones included (Core >= MAIR-477 reads them through the name
  // index), or a search by e-mail that matches a handful of them (the trigram index of the search text).
  'GET /bff/admin/users': ({ request, data }) => {
    if (Math.random() < 0.5) {
      const pages = Math.floor(AGENTS.count / ADMIN_PAGE_SIZE);
      check(request({ query: { page: 1 + randomInt(pages), page_size: ADMIN_PAGE_SIZE }, headers: data.admin }), {
        'admin users 200': (r) => r.status === 200,
        'admin users reads the seed': (r) =>
          r.status === 200 && r.json('total') >= AGENTS.count && r.json('users').length === ADMIN_PAGE_SIZE,
      });
      return;
    }
    const agent = randomAgent();
    check(request({ query: { page: 1, page_size: ADMIN_PAGE_SIZE, search: `perf.agent.${agent.id}@` }, headers: data.admin }), {
      'admin users search 200': (r) => r.status === 200,
      'admin users search finds the agent': (r) =>
        r.status === 200 && r.json('total') === 1 && r.json('users.0.email') === `perf.agent.${agent.id}@mairie360.fr`,
    });
  },
  // Core (MAIR-474) answers the id of the created account.
  'POST /bff/admin/users': ({ request, data }) => {
    const email = `${unique('perf-admin-user')}@perf.mairie360.fr`;
    const res = request({
      body: { email, first_name: 'Perf', last_name: 'Managed', password: USER_PASSWORD },
      headers: data.admin,
    });
    check(res, { 'create user 201 with its id': (r) => r.status === 201 && Number.isInteger(r.json('id')) });
    state.userId = res.status === 201 ? res.json('id') : undefined;
  },
  'PATCH /bff/admin/users/{userId}': ({ request, data }) =>
    check(request({ path: { userId: need(state.userId, 'created user') }, body: { first_name: 'Patched' }, headers: data.admin }), {
      'patch user 200': (r) => r.status === 200,
    }),
  // Deletes the first-connect user of POST /auth/force_change_password, the created one is still needed below.
  'DELETE /bff/admin/users/{userId}': ({ request, data }) => {
    const userId = findUserId(need(state.firstConnectEmail, 'first-connect user'), data);
    check(request({ path: { userId: need(userId, 'first-connect user id') }, headers: data.admin }), {
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
    check(request({ query: { limit: 100, offset: randomInt(ADMIN_GROUPS - 100) }, headers: data.admin }), {
      'groups 200': (r) => r.status === 200,
      'groups reads the seed': (r) => r.status === 200 && r.json('groups').length === 100,
    }),
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
    check(request({ path: { groupId: PERF_GROUPS.first + randomInt(PERF_GROUPS.count) }, headers: data.admin }), {
      'group members 200': (r) => r.status === 200,
      'group members reads the seed': (r) => r.status === 200 && r.json('users').length >= PERF_GROUPS.members,
    }),
  'POST /bff/admin/groups/{groupId}/users': ({ request, data }) =>
    check(request({ path: { groupId: FIXTURE_GROUP_ID }, body: { user_id: need(state.userId, 'created user') }, headers: data.admin }), {
      'add member 201': (r) => r.status === 201,
    }),
  'DELETE /bff/admin/groups/{groupId}/users/{userId}': ({ request, data }) =>
    check(request({ path: { groupId: FIXTURE_GROUP_ID, userId: need(state.userId, 'created user') }, headers: data.admin }), {
      'remove member 204': (r) => r.status === 204,
    }),

  // --- Admin: sessions ---
  'GET /bff/admin/sessions': ({ request, data }) =>
    check(request({ headers: data.admin }), { 'sessions 200': (r) => r.status === 200 }),
  'GET /bff/admin/sessions/history': ({ request, data }) =>
    check(request({ query: { limit: 100, offset: randomInt(900) }, headers: data.admin }), {
      'sessions history 200': (r) => r.status === 200,
      'sessions history reads the seed': (r) => r.status === 200 && r.json('sessions').length === 100,
    }),
  // The refresh token of POST /auth/login is revoked (Core API only revokes the caller's own
  // sessions, hence the admin login).
  'POST /bff/admin/sessions/revoke': ({ request, data }) =>
    check(request({ body: { refresh_token: need(state.refreshToken, 'admin refresh token') }, headers: data.admin }), {
      'revoke 200': (r) => r.status === 200,
    }),

  // --- Session reads ---
  // A random seeded agent, member of 4 perf groups.
  'GET /me': ({ request }) =>
    check(request({ headers: randomAgent().headers }), {
      'me 200': (r) => r.status === 200,
      'me reads the seeded groups': (r) => r.status === 200 && r.json('groups').length >= 1,
    }),
  'GET /session/me': ({ request }) =>
    check(request({ headers: randomAgent().headers }), {
      'session/me 200': (r) => r.status === 200,
      'session/me reads the seeded groups': (r) => r.status === 200 && r.json('groups').length >= 1,
    }),
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
        { duration: '30s', target: Math.ceil(PROFILE.readVus / 2) }, // ramp-up
        { duration: '30s', target: PROFILE.readVus },
        { duration: '2m', target: PROFILE.readVus }, // steady load
        { duration: '20s', target: 0 }, // ramp-down
      ],
    },
    crud: {
      executor: 'constant-vus',
      exec: 'crud',
      vus: PROFILE.crudVus,
      duration: '3m20s',
    },
    me_rush: {
      executor: 'constant-arrival-rate',
      exec: 'meRush',
      startTime: '1m', // once the reads are at their peak
      rate: PROFILE.rushRate,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 30,
      maxVUs: 200,
    },
  },
  thresholds: {
    ...coverage.thresholds,
    ...perOperationThresholds,
    'http_req_duration{op:me_rush}': ['p(95)<500'],
    dropped_iterations: ['count==0'], // the rush kept its rate
    // Strict (MAIR-474): one wrong status, one missing seeded row or one failed request fails the run.
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],
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

export function meRush() {
  const agent = randomAgent();
  const res = http.get(coverage.url('GET /me'), { headers: agent.headers, tags: { op: 'me_rush' } });
  check(res, {
    'me rush 200': (r) => r.status === 200,
    'me rush reads the seeded groups': (r) => r.status === 200 && r.json('groups').length >= 1,
  });
}

export function crud(data) {
  state = {};
  // User token by default; the /bff/admin/* handlers pass the admin one.
  coverage.run({ headers: data.user, data });
  cleanup(data);
  sleep(1);
}
