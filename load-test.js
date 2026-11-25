import http from 'k6/http';
import crypto from 'k6/crypto';
import { check, sleep } from 'k6';
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
// - `policy` (1 iteration, alone, after everything else): the operations that need the two-factor policy to be
//   mandatory (MAIR-808: every login of the instance answers 202 meanwhile) or passkeys to be allowed
//  , and that restore the optional policy. Run by `policyCoverage`, so they stay out of `crud`.
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

// Session tokens of the run (MAIR-680): Core alone signs them (EdDSA) and k6 cannot sign Ed25519,
// so performance_test.sh signs them with the run's key (stack_secrets.sh): ADMIN_JWT (sub=1, role
// admin) and a { "<user id>": "<jwt>" } file for user 2 and the seeded agents. Nothing is committed.
const ADMIN_JWT = __ENV.ADMIN_JWT;
if (!ADMIN_JWT) throw new Error('ADMIN_JWT is not set: run ./performance_test.sh, which signs it');
const TOKENS = JSON.parse(open(__ENV.JWT_TOKENS_FILE || '/tokens.json'));
// User role only, seeded by init-test.sql: session reads.
const USER_ID = __ENV.PERF_USER_ID || '2';
// Admin role (seeded by the liquibase migrations): /admin/* and the login flow. ADMIN_JWT is signed
// for user 1: keep PERF_ADMIN_ID on it.
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
// Core refuses a password holding the account's first or last name (CNIL 2022 policy): every account of this script
// is named `Perf <something>`, so the password must not contain `perf`.
const USER_PASSWORD = 'Granite-Tilleul-Horizon';
// Derived from USER_PASSWORD rather than a second literal (Gitleaks reads a new literal as a secret).
const SIGN_IN_PASSWORD = `${USER_PASSWORD}-sign-in`;

// State of the current iteration (module scope is per VU in k6).
let state = {};

/** EdDSA JWT of seeded user `id` (role user), signed by performance_test.sh. */
function userJwt(id) {
  const token = TOKENS[String(id)];
  if (!token) throw new Error(`No token for user ${id}: sign it in performance_test.sh`);
  return token;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

const randomInt = (max) => Math.floor(Math.random() * max);
const agentTokens = {};

/** A random seeded agent: its id and `Authorization` header (one token per agent and VU). */
function randomAgent() {
  const id = AGENTS.first + randomInt(AGENTS.count);
  if (!agentTokens[id]) agentTokens[id] = bearer(userJwt(id));
  return { id, headers: agentTokens[id] };
}

// `__ITER` only exists inside an iteration: setup() (VU 0) has none and k6 throws a ReferenceError on it.
function unique(prefix) {
  const iteration = typeof __ITER === 'undefined' ? 'setup' : __ITER;
  return `${prefix}-${__VU}-${iteration}-${Date.now()}`;
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

// ---------------------------------------------------------------------------
// Two-factor policy and passkeys (MAIR-805, MAIR-808, MAIR-810)
// ---------------------------------------------------------------------------
// The operations of the `policy` scenario: a mandatory policy answers every login of the instance 202, so they
// cannot share the stage with the others.
const isPolicy = (path) =>
  path.startsWith('/admin/two-factor-policy') || path.startsWith('/auth/2fa/') || path === '/auth/login/2fa' || path.startsWith('/auth/passkey') || path.startsWith('/user/me/passkeys');
const OPTIONAL_POLICY = { required: false, totp_allowed: true, passkey_allowed: false, backup_codes_allowed: true };

function specSubset(spec, keep) {
  const paths = {};
  for (const path of Object.keys(spec.paths)) if (keep(path)) paths[path] = spec.paths[path];
  return Object.assign({}, spec, { paths });
}

// RFC 6238 code of `secret` (base32) at the current step, as an authenticator application computes it.
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function totp(secret) {
  let bits = '';
  for (const ch of secret) bits += BASE32.indexOf(ch).toString(2).padStart(5, '0');
  const key = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < key.length; i += 1) key[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const counter = new Uint8Array(8);
  for (let i = 7, n = Math.floor(Date.now() / 30000); i >= 0; i -= 1, n = Math.floor(n / 256)) counter[i] = n % 256;
  const mac = new Uint8Array(crypto.hmac('sha1', key.buffer, counter.buffer, 'binary'));
  const o = mac[19] & 0x0f;
  const n = (((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3]) % 1000000;
  return String(n).padStart(6, '0');
}

/** A request that is not the operation under test (set-up and clean-up): untagged, it must answer `expected`. */
function fixture(method, url, body, headers, expected = [200, 201, 202, 204]) {
  const response = http.request(method, url, body === undefined ? null : JSON.stringify(body), {
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    responseCallback: http.expectedStatuses(...expected),
  });
  if (!expected.includes(response.status)) throw new Error(`${method} ${url} fixture answered ${response.status}`);
  return response;
}

const setPolicy = (data, policy) => fixture('PUT', policyCoverage.url('PUT /admin/two-factor-policy'), policy, data.admin);

/** Runs `fn` with the policy replaced, then puts the optional one back whatever happens. */
function withPolicy(data, policy, fn) {
  setPolicy(data, policy);
  try {
    return fn();
  } finally {
    setPolicy(data, OPTIONAL_POLICY);
  }
}

/** A fresh account of the first sign-in already done (password `USER_PASSWORD-2`), to delete with `dropAccount`. */
function freshAccount(data) {
  const email = `${unique('perf-2fa')}@perf.mairie360.fr`;
  fixture('POST', coverage.url('POST /admin/users'), { email, first_name: 'Perf', last_name: 'TwoFactor', password: USER_PASSWORD }, data.admin);
  const first = fixture('POST', coverage.url('POST /auth/login'), { email, password: USER_PASSWORD, device_info: 'k6' }, {}, [412]);
  fixture('POST', coverage.url('POST /auth/force_change_password'), { token: first.json('token'), new_password: `${USER_PASSWORD}-2` }, {}, [204]);
  return { email, userId: findUserId(email, data) };
}

const loginOf = (account) =>
  fixture('POST', coverage.url('POST /auth/login'), { email: account.email, password: `${USER_PASSWORD}-2`, device_info: 'k6' }, {}, [200, 202]);

function dropAccount(account, data) {
  if (account.userId !== undefined) http.del(coverage.url('DELETE /admin/users/{userId}', { userId: account.userId }), null, { headers: data.admin });
}

/** The enrolment token of a login that the mandatory policy answers `2fa_setup_required`. */
function setupToken(data, account) {
  return withPolicy(data, Object.assign({}, OPTIONAL_POLICY, { required: true }), () => loginOf(account).json('token'));
}

/** An account whose second factor is on: the token of its next login (`2fa_required`) and one backup code. */
function protectedAccount(data) {
  const account = freshAccount(data);
  const token = setupToken(data, account);
  const secret = fixture('POST', policyCoverage.url('POST /auth/2fa/setup'), { token }, {}).json('secret');
  const codes = fixture('POST', policyCoverage.url('POST /auth/2fa/confirm'), { token, code: totp(secret) }, {}, [200]).json('backup_codes');
  return { account, codes };
}

// What a browser would send: nothing here is a real authenticator answer, so Core refuses it.
const FORGED_SIGN_IN = {
  id: 'AAAA', rawId: 'AAAA', type: 'public-key',
  response: { authenticatorData: 'AAAA', clientDataJSON: 'AAAA', signature: 'AAAA', userHandle: null }, extensions: {},
};

// Same for a registration (`navigator.credentials.create`).
const FORGED_REGISTRATION = {
  id: 'AAAA', rawId: 'AAAA', type: 'public-key',
  response: { attestationObject: 'AAAA', clientDataJSON: 'AAAA' }, extensions: {},
};
const PASSKEYS_ALLOWED = Object.assign({}, OPTIONAL_POLICY, { passkey_allowed: true });
const PASSKEYS_MANDATORY = Object.assign({}, PASSKEYS_ALLOWED, { required: true });

/** Runs `fn(token)` with an enrolment token of an account without factor, under a mandatory policy that allows passkeys. */
function withPasskeyEnrolment(data, fn) {
  const account = freshAccount(data);
  try {
    return withPolicy(data, PASSKEYS_MANDATORY, () => fn(loginOf(account).json('token')));
  } finally {
    dropAccount(account, data);
  }
}

const policyHandlers = {
  'GET /admin/two-factor-policy': ({ request, data }) =>
    check(request({ headers: data.admin }), {
      'policy 200': (r) => r.status === 200 && r.json('required') === false && r.json('totp_allowed') === true,
    }),
  'PUT /admin/two-factor-policy': ({ request, data }) =>
    check(request({ body: OPTIONAL_POLICY, headers: data.admin }), {
      'policy put 200': (r) => r.status === 200 && r.json('required') === false && r.json('passkey_allowed') === false,
    }),
  // The mandatory policy, an account without a factor: its login answers 202 `2fa_setup_required` and enrols.
  'POST /auth/2fa/setup': ({ request, data }) => {
    const account = freshAccount(data);
    try {
      check(request({ body: { token: setupToken(data, account) } }), {
        '2fa enrolment setup 200': (r) => r.status === 200 && !!r.json('secret') && `${r.json('otpauth_uri')}`.startsWith('otpauth://'),
      });
    } finally {
      dropAccount(account, data);
    }
  },
  'POST /auth/2fa/confirm': ({ request, data }) => {
    const account = freshAccount(data);
    try {
      const token = setupToken(data, account);
      const secret = fixture('POST', policyCoverage.url('POST /auth/2fa/setup'), { token }, {}).json('secret');
      check(request({ body: { token, code: totp(secret) } }), {
        '2fa enrolment confirm 200': (r) => r.status === 200 && !!r.cookies.accessToken && r.json('backup_codes').length === 10,
      });
    } finally {
      dropAccount(account, data);
    }
  },
  // The second step of a login: password (202 `2fa_required`), then one backup code.
  'POST /auth/login/2fa': ({ request, data }) => {
    const { account, codes } = protectedAccount(data);
    try {
      const login = loginOf(account);
      check(request({ body: { token: login.json('token'), code: codes[0] } }), {
        '2fa login 200': (r) => r.status === 200 && !!r.cookies.accessToken && !!r.cookies.refreshToken,
      });
    } finally {
      dropAccount(account, data);
    }
  },
  // Passkeys are refused until the administrator allows them; nothing here can sign a WebAuthn answer, so
  // the sign-in is answered with the single 401 of a forged one (the success is Core's and the jest mocks').
  'POST /auth/passkey/options': ({ request, data }) =>
    withPolicy(data, Object.assign({}, OPTIONAL_POLICY, { passkey_allowed: true }), () =>
      check(request({ body: {} }), {
        'passkey sign-in options 200': (r) => r.status === 200 && !!r.json('id') && !!r.json('options.publicKey.challenge'),
      })),
  'POST /auth/passkey': ({ request, data }) =>
    withPolicy(data, Object.assign({}, OPTIONAL_POLICY, { passkey_allowed: true }), () => {
      const ceremony = fixture('POST', policyCoverage.url('POST /auth/passkey/options'), {}, {}).json('id');
      return check(
        request({ body: { id: ceremony, credential: FORGED_SIGN_IN, device_info: 'k6' }, params: { responseCallback: http.expectedStatuses(401) } }),
        { 'forged passkey 401, no cookie': (r) => r.status === 401 && !r.cookies.accessToken },
      );
    }),
  // Creation of a passkey, with the enrolment token (no session yet) or with the session of the agent. Nothing here can
  // create a real credential: the challenge is the success, the forged answer the refusal (Core's, and the jest mocks').
  'POST /auth/passkey/setup/options': ({ request, data }) =>
    withPasskeyEnrolment(data, (token) =>
      check(request({ body: { token } }), {
        'passkey enrolment options 200': (r) => r.status === 200 && r.json('options.publicKey.authenticatorSelection.residentKey') === 'required',
      })),
  'POST /auth/passkey/setup': ({ request, data }) =>
    withPasskeyEnrolment(data, (token) => {
      fixture('POST', policyCoverage.url('POST /auth/passkey/setup/options'), { token }, {});
      return check(
        request({ body: { token, label: 'k6', credential: FORGED_REGISTRATION }, params: { responseCallback: http.expectedStatuses(400) } }),
        { 'forged passkey creation 400, no cookie': (r) => r.status === 400 && !r.cookies.accessToken },
      );
    }),
  'POST /user/me/passkeys/options': ({ request, data }) =>
    withPolicy(data, PASSKEYS_ALLOWED, () =>
      check(request({ headers: data.admin, body: {} }), {
        'passkey creation options 200': (r) => r.status === 200 && !!r.json('options.publicKey.challenge'),
      })),
  // MAIR-811: k6 holds no real passkey: an unknown id answers the 404 of Core, relayed.
  'PATCH /user/me/passkeys/{passkeyId}': ({ request, data }) =>
    check(
      request({ path: { passkeyId: 999999999 }, headers: data.admin, body: { label: 'k6' }, params: { responseCallback: http.expectedStatuses(404) } }),
      { 'rename unknown passkey 404': (r) => r.status === 404 },
    ),
  'POST /user/me/passkeys': ({ request, data }) =>
    withPolicy(data, PASSKEYS_ALLOWED, () => {
      fixture('POST', policyCoverage.url('POST /user/me/passkeys/options'), {}, data.admin);
      return check(
        request({ headers: data.admin, body: { label: 'k6', credential: FORGED_REGISTRATION }, params: { responseCallback: http.expectedStatuses(400) } }),
        { 'forged passkey creation 400': (r) => r.status === 400 },
      );
    }),
};

const handlers = {
  // --- Connectivity (public) ---
  'GET /health': ({ request }) =>
    check(request(), { 'health 200': (r) => r.status === 200 }),
  'GET /check_apis': ({ request }) =>
    check(request(), { 'check_apis 200': (r) => r.status === 200 }),

  // --- Authentication (public) ---
  // Signs the account of setup() in: the refresh token (HttpOnly refreshToken cookie, never in the body)
  // feeds POST /auth/logout.
  'POST /auth/login': ({ request, data }) => {
    const res = request({ body: { email: data.signInEmail, password: SIGN_IN_PASSWORD, device_info: 'k6' } });
    check(res, { 'login 200': (r) => r.status === 200 });
    state.refreshToken = ((res.cookies.refreshToken || [])[0] || {}).value;
    state.signInJwt = ((res.cookies.accessToken || [])[0] || {}).value;
  },
  // Accounts created by an admin start with first_connect = true: their first sign-in answers 412
  // with the one-time token. The account is created here (outside the coverage of
  // POST /admin/users, which runs later) and deleted by DELETE /admin/users/{userId}.
  'POST /auth/force_change_password': ({ request, data }) => {
    state.firstConnectEmail = `${unique('perf-first-connect')}@perf.mairie360.fr`;
    const created = http.post(
      coverage.url('POST /admin/users'),
      JSON.stringify({ email: state.firstConnectEmail, first_name: 'Perf', last_name: 'FirstConnect', password: USER_PASSWORD }),
      { headers: Object.assign({ 'Content-Type': 'application/json' }, data.admin), tags: { op: 'POST /admin/users' } },
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
  // must stay valid for POST /admin/sessions/revoke.
  'POST /auth/refresh': ({ request, data }) => {
    const login = http.post(
      coverage.url('POST /auth/login'),
      JSON.stringify({ email: data.signInEmail, password: SIGN_IN_PASSWORD, device_info: 'k6-refresh' }),
      { headers: { 'Content-Type': 'application/json' }, tags: { op: 'POST /auth/login' } },
    );
    const refreshToken = ((login.cookies.refreshToken || [])[0] || {}).value;
    const res = request({ body: { refresh_token: need(refreshToken, 'refresh token of the second login') } });
    check(res, { 'refresh 200': (r) => r.status === 200 });
  },
  'POST /auth/logout': ({ request }) =>
    check(request(), { 'logout 200': (r) => r.status === 200 }),
  // An address matching no account: Core answers the same empty 200 as for a known one, without
  // sending any e-mail (the stack has no mail delivery to read the reset token back from).
  'POST /auth/forgot_password': ({ request }) =>
    check(request({ body: { email: `${unique('perf-forgot')}@perf.mairie360.fr` } }), {
      'forgot_password 200': (r) => r.status === 200,
    }),
  // A well-formed token Core never issued: the reset reaches Core, which refuses it with the declared 401.
  'POST /auth/reset_password': ({ request }) =>
    check(
      request({
        body: { token: '00000000-0000-4000-8000-000000000000', new_password: `${USER_PASSWORD}-reset`, device_info: 'k6' },
        params: { responseCallback: http.expectedStatuses(401) },
      }),
      { 'reset_password 401 (unknown token)': (r) => r.status === 401 },
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
  'GET /admin/users': ({ request, data }) => {
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
  'POST /admin/users': ({ request, data }) => {
    const email = `${unique('perf-admin-user')}@perf.mairie360.fr`;
    const res = request({
      body: { email, first_name: 'Perf', last_name: 'Managed', password: USER_PASSWORD },
      headers: data.admin,
    });
    check(res, { 'create user 201 with its id': (r) => r.status === 201 && Number.isInteger(r.json('id')) });
    state.userId = res.status === 201 ? res.json('id') : undefined;
  },
  'PATCH /admin/users/{userId}': ({ request, data }) =>
    check(request({ path: { userId: need(state.userId, 'created user') }, body: { first_name: 'Patched' }, headers: data.admin }), {
      'patch user 200': (r) => r.status === 200,
    }),
  // Deletes the first-connect user of POST /auth/force_change_password, the created one is still needed below.
  'DELETE /admin/users/{userId}': ({ request, data }) => {
    const userId = findUserId(need(state.firstConnectEmail, 'first-connect user'), data);
    check(request({ path: { userId: need(userId, 'first-connect user id') }, headers: data.admin }), {
      'delete user 2xx': (r) => r.status === 200 || r.status === 204,
    });
  },
  'POST /admin/users/{userId}/roles': ({ request, data }) =>
    check(request({ path: { userId: need(state.userId, 'created user') }, body: { role_id: FIXTURE_ROLE_ID }, headers: data.admin }), {
      'add role 200': (r) => r.status === 200,
    }),
  'DELETE /admin/users/{userId}/roles/{roleId}': ({ request, data }) =>
    check(request({ path: { userId: need(state.userId, 'created user'), roleId: FIXTURE_ROLE_ID }, headers: data.admin }), {
      'remove role 204': (r) => r.status === 204,
    }),

  // --- Admin: projects without a group (read through BFF_Project) ---
  'GET /admin/projects-without-group': ({ request, data }) =>
    check(request({ headers: data.admin }), {
      'projects without group 200': (r) => r.status === 200,
      // init-test.sql seeds project 900 without a group.
      'seeded project without group listed': (r) => {
        const body = json(r) || {};
        return Array.isArray(body.projects) && body.total === body.projects.length && body.projects.some((p) => p.id === 'project-900');
      },
    }),

  // --- Admin: services of the mairie (MAIR-923) ---
  // Each write handler creates and deletes its own service, so the path order of `crud` does not matter.
  'GET /admin/services': ({ request, data }) =>
    check(request({ headers: data.admin }), {
      'services 200': (r) => r.status === 200 && Array.isArray((json(r) || {}).services),
    }),
  'POST /admin/services': ({ request, data }) => {
    const response = request({ body: { name: unique('perf-service') }, headers: data.admin });
    check(response, { 'create service 201': (r) => r.status === 201 });
    const id = (json(response) || {}).id;
    if (id !== undefined) fixture('DELETE', coverage.url('DELETE /admin/services/{serviceId}', { serviceId: id }), undefined, data.admin);
  },
  'PATCH /admin/services/{serviceId}': ({ request, data }) => {
    const id = json(fixture('POST', coverage.url('POST /admin/services'), { name: unique('perf-service-rename') }, data.admin)).id;
    check(request({ path: { serviceId: id }, body: { name: unique('perf-service-renamed') }, headers: data.admin }), {
      'rename service 200': (r) => r.status === 200,
    });
    fixture('DELETE', coverage.url('DELETE /admin/services/{serviceId}', { serviceId: id }), undefined, data.admin);
  },
  'DELETE /admin/services/{serviceId}': ({ request, data }) => {
    const id = json(fixture('POST', coverage.url('POST /admin/services'), { name: unique('perf-service-delete') }, data.admin)).id;
    check(request({ path: { serviceId: id }, headers: data.admin }), { 'delete service 204': (r) => r.status === 204 });
  },
  'PUT /admin/users/{userId}/service': ({ request, data }) => {
    const email = `${unique('perf-service-agent')}@perf.mairie360.fr`;
    fixture('POST', coverage.url('POST /admin/users'), { email, first_name: 'Perf', last_name: 'Service', password: USER_PASSWORD }, data.admin);
    const userId = findUserId(email, data);
    const id = json(fixture('POST', coverage.url('POST /admin/services'), { name: unique('perf-service-agent') }, data.admin)).id;
    check(request({ path: { userId: need(userId, 'agent of the service') }, body: { service_id: id }, headers: data.admin }), {
      'set user service 204': (r) => r.status === 204,
    });
    fixture('DELETE', coverage.url('DELETE /admin/services/{serviceId}', { serviceId: id }), undefined, data.admin);
    dropAccount({ userId }, data);
  },

  // --- Admin: roles ---
  'GET /admin/roles': ({ request, data }) =>
    check(request({ headers: data.admin }), { 'roles 200': (r) => r.status === 200 }),
  // Two roles: one kept for PUT/PATCH, one for DELETE (which runs before PATCH). Core answers
  // without the id: both are read back from the role listing.
  'POST /admin/roles': ({ request, data }) => {
    const names = [unique('perf-role'), unique('perf-role-deleted')];
    for (const name of names) {
      check(request({ body: { name, description: 'k6 role' }, headers: data.admin }), {
        'create role 200': (r) => r.status === 200,
      });
    }
    const listing = http.get(coverage.url('GET /admin/roles'), {
      headers: data.admin,
      tags: { op: 'GET /admin/roles' },
    });
    const roles = (json(listing) || {}).roles || [];
    [state.roleId, state.disposableRoleId] = names.map((name) => {
      const role = roles.find((r) => r.name === name);
      return role ? role.id : undefined;
    });
  },
  'PUT /admin/roles/{roleId}': ({ request, data }) =>
    check(request({ path: { roleId: need(state.roleId, 'created role') }, body: { name: unique('perf-role-put'), description: 'k6 role, replaced' }, headers: data.admin }), {
      'put role 200': (r) => r.status === 200,
    }),
  'PATCH /admin/roles/{roleId}': ({ request, data }) =>
    check(request({ path: { roleId: need(state.roleId, 'created role') }, body: { description: 'k6 role, patched' }, headers: data.admin }), {
      'patch role 200': (r) => r.status === 200,
    }),
  'DELETE /admin/roles/{roleId}': ({ request, data }) =>
    check(request({ path: { roleId: need(state.disposableRoleId, 'disposable role') }, headers: data.admin }), {
      'delete role 204': (r) => r.status === 204,
    }),

  // --- Admin: groups ---
  'GET /admin/groups': ({ request, data }) =>
    check(request({ query: { limit: 100, offset: randomInt(ADMIN_GROUPS - 100) }, headers: data.admin }), {
      'groups 200': (r) => r.status === 200,
      'groups reads the seed': (r) => r.status === 200 && r.json('groups').length === 100,
    }),
  // Two groups: one kept for GET/PATCH, one for DELETE (which runs before PATCH).
  'POST /admin/groups': ({ request, data }) => {
    [state.groupId, state.disposableGroupId] = [unique('perf-group'), unique('perf-group-deleted')].map((name) => {
      const res = request({ body: { name, description: 'k6 group' }, headers: data.admin });
      check(res, { 'create group 200': (r) => r.status === 200 });
      return (json(res) || {}).id;
    });
  },
  'GET /admin/groups/{groupId}': ({ request, data }) =>
    check(request({ path: { groupId: FIXTURE_GROUP_ID }, headers: data.admin }), {
      'group 200': (r) => r.status === 200,
    }),
  'PATCH /admin/groups/{groupId}': ({ request, data }) =>
    check(request({ path: { groupId: need(state.groupId, 'created group') }, body: { description: 'k6 group, patched' }, headers: data.admin }), {
      'patch group 200': (r) => r.status === 200,
    }),
  'DELETE /admin/groups/{groupId}': ({ request, data }) =>
    check(request({ path: { groupId: need(state.disposableGroupId, 'disposable group') }, headers: data.admin }), {
      'delete group 204': (r) => r.status === 204,
    }),
  'GET /admin/groups/{groupId}/users': ({ request, data }) =>
    check(request({ path: { groupId: PERF_GROUPS.first + randomInt(PERF_GROUPS.count) }, headers: data.admin }), {
      'group members 200': (r) => r.status === 200,
      'group members reads the seed': (r) => r.status === 200 && r.json('users').length >= PERF_GROUPS.members,
    }),
  'POST /admin/groups/{groupId}/users': ({ request, data }) =>
    check(request({ path: { groupId: FIXTURE_GROUP_ID }, body: { user_id: need(state.userId, 'created user') }, headers: data.admin }), {
      'add member 201': (r) => r.status === 201,
    }),
  'DELETE /admin/groups/{groupId}/users/{userId}': ({ request, data }) =>
    check(request({ path: { groupId: FIXTURE_GROUP_ID, userId: need(state.userId, 'created user') }, headers: data.admin }), {
      'remove member 204': (r) => r.status === 204,
    }),

  // --- Admin: sessions ---
  'GET /admin/sessions': ({ request, data }) =>
    check(request({ headers: data.admin }), { 'sessions 200': (r) => r.status === 200 }),
  'GET /admin/sessions/history': ({ request, data }) =>
    check(request({ query: { limit: 100, offset: randomInt(900) }, headers: data.admin }), {
      'sessions history 200': (r) => r.status === 200,
      'sessions history reads the seed': (r) => r.status === 200 && r.json('sessions').length === 100,
    }),
  // The refresh token of POST /auth/login is revoked with the JWT of that sign-in (Core API only revokes the
  // caller's own sessions, hence the administrator of setup()).
  'POST /admin/sessions/revoke': ({ request }) =>
    check(request({ body: { refresh_token: need(state.refreshToken, 'sign-in refresh token') }, headers: bearer(need(state.signInJwt, 'sign-in JWT')) }), {
      'revoke 200': (r) => r.status === 200,
    }),

  // MAIR-805: idempotent, 204 whether or not the account had a factor; a disposable account, because the
  // reset revokes the sessions of the account it targets.
  'DELETE /admin/users/{userId}/2fa': ({ request, data }) => {
    const email = `${unique('perf-reset-2fa')}@perf.mairie360.fr`;
    fixture('POST', coverage.url('POST /admin/users'), { email, first_name: 'Perf', last_name: 'Reset', password: USER_PASSWORD }, data.admin);
    const userId = findUserId(email, data);
    check(request({ path: { userId: need(userId, 'account to reset') }, headers: data.admin }), {
      'admin reset 2fa 204': (r) => r.status === 204,
    });
    dropAccount({ userId }, data);
  },

  // MAIR-584 / MAIR-904: sessions of a user and suspension, each on its own throwaway account.
  // --- Stolen sessions (MAIR-773) ---
  // The front proxies report the session they checked: a fresh account signs in, and its session is reported as
  // possibly stolen, which closes it (`revoked: true`).
  'POST /user/me/sessions/report': ({ request, data }) => {
    const account = freshAccount(data);
    try {
      const jwt = ((loginOf(account).cookies.accessToken || [])[0] || {}).value;
      check(request({ body: { level: 'possible', ip_address: '203.0.113.7', device_info: 'k6' }, headers: bearer(need(jwt, 'session to report')) }), {
        'report session 200': (r) => r.status === 200,
        'report session closes it': (r) => r.status === 200 && r.json('revoked') === true,
      });
    } finally {
      dropAccount(account, data);
    }
  },
  // The seeded administrator has no unread alert: 204, the Login screen shows nothing.
  'GET /user/me/security-alert': ({ request, data }) =>
    check(request({ headers: data.admin, params: { responseCallback: http.expectedStatuses(200, 204) } }), {
      'security alert 200 or 204': (r) => r.status === 200 || r.status === 204,
    }),
  // An alert of nobody: Core answers 404, the route and the proxying are what is measured.
  'POST /user/me/security-alert/{alertId}/acknowledge': ({ request, data }) =>
    check(request({ path: { alertId: 2147483000 }, headers: data.admin, params: { responseCallback: http.expectedStatuses(404) } }), {
      'acknowledge unknown alert 404': (r) => r.status === 404,
    }),
  'GET /admin/security-alerts': ({ request, data }) =>
    check(request({ headers: data.admin }), {
      'security alerts 200': (r) => r.status === 200 && Array.isArray(r.json()),
    }),
  'GET /admin/users/{userId}/connection-logs': ({ request, data }) =>
    check(request({ path: { userId: 1 }, headers: data.admin }), {
      'connection logs 200': (r) => r.status === 200 && Array.isArray(r.json()),
    }),

  'GET /admin/users/{userId}/sessions': ({ request, data }) => {
    check(request({ path: { userId: 2 }, headers: data.admin }), {
      'admin user sessions 200': (r) => r.status === 200 && Array.isArray(r.json('sessions')),
    });
  },

  'DELETE /admin/users/{userId}/sessions': ({ request, data }) => {
    const email = `${unique('perf-close-all')}@perf.mairie360.fr`;
    fixture('POST', coverage.url('POST /admin/users'), { email, first_name: 'Perf', last_name: 'Close', password: USER_PASSWORD }, data.admin);
    const userId = findUserId(email, data);
    check(request({ path: { userId: need(userId, 'account to sign out') }, headers: data.admin }), {
      'admin close sessions 204': (r) => r.status === 204,
    });
    dropAccount({ userId }, data);
  },

  'DELETE /admin/users/{userId}/sessions/{sessionId}': ({ request, data }) => {
    // A session of nobody: Core answers 404, the route and the proxying are what is measured.
    const res = request({ path: { userId: 1, sessionId: '00000000-0000-4000-8000-000000000000' }, headers: data.admin, params: { responseCallback: http.expectedStatuses(404) } });
    check(res, { 'admin close one session 404': (r) => r.status === 404 });
  },

  'POST /admin/users/{userId}/suspend': ({ request, data }) => {
    const email = `${unique('perf-suspend')}@perf.mairie360.fr`;
    fixture('POST', coverage.url('POST /admin/users'), { email, first_name: 'Perf', last_name: 'Suspend', password: USER_PASSWORD }, data.admin);
    const userId = findUserId(email, data);
    check(request({ path: { userId: need(userId, 'account to suspend') }, headers: data.admin }), {
      'admin suspend 204': (r) => r.status === 204,
    });
    dropAccount({ userId }, data);
  },

  'POST /admin/users/{userId}/reactivate': ({ request, data }) => {
    const email = `${unique('perf-reactivate')}@perf.mairie360.fr`;
    fixture('POST', coverage.url('POST /admin/users'), { email, first_name: 'Perf', last_name: 'Reactivate', password: USER_PASSWORD }, data.admin);
    const userId = findUserId(email, data);
    fixture('POST', `${coverage.url('POST /admin/users')}/${userId}/suspend`, undefined, data.admin);
    check(request({ path: { userId: need(userId, 'account to reactivate') }, headers: data.admin }), {
      'admin reactivate 204': (r) => r.status === 204,
    });
    dropAccount({ userId }, data);
  },

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

const spec = JSON.parse(open(__ENV.OPENAPI_SPEC || '/openapi.json'));
const coverage = createCoverage(handlers, { spec: specSubset(spec, (path) => !isPolicy(path)) });
const policyCoverage = createCoverage(policyHandlers, { spec: specSubset(spec, (path) => isPolicy(path)) });
const readOperations = coverage.operations.filter((o) => o.method === 'GET');

// Deletes the resources kept by the handlers, so that the listings do not grow during the test.
function cleanup(data) {
  const kept = [
    ['DELETE /admin/users/{userId}', { userId: state.userId }],
    ['DELETE /admin/roles/{roleId}', { roleId: state.roleId }],
    ['DELETE /admin/groups/{groupId}', { groupId: state.groupId }],
  ];
  for (const [op, pathParams] of kept) {
    if (Object.values(pathParams).some((id) => id === undefined || id === null)) continue;
    http.del(coverage.url(op, pathParams), null, { headers: data.admin, tags: { op } });
  }
}

function findUserId(email, data) {
  const listing = http.get(coverage.url('GET /admin/users', {}, { search: email }), {
    headers: data.admin,
    tags: { op: 'GET /admin/users' },
  });
  const user = ((json(listing) || {}).users || []).find((u) => u.email === email);
  return user ? user.id : undefined;
}

// p(95) budget of an operation, per family.
function budgetOf({ op, method, path }) {
  if (op === 'GET /health') return 50; // process probe
  if (op === 'GET /check_apis') return 150; // -> Core /health
  if (op === 'POST /auth/2fa/confirm') return 1200; // activates the factor: ten backup codes hashed with argon2
  if (path.startsWith('/auth/')) return 800; // sign-in flow, Core writes the session
  if (method === 'GET') return 500; // BFF aggregation + Core reads
  return 800; // admin writes
}

const perOperationThresholds = {};
for (const operation of [...coverage.operations, ...policyCoverage.operations]) {
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
    // MAIR-808, MAIR-810: alone, once everything else is over (a mandatory policy makes every login answer 202).
    policy: {
      executor: 'shared-iterations',
      exec: 'policyScenario',
      vus: 1,
      iterations: 1,
      startTime: '3m30s',
      maxDuration: '1m',
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

// The sign-in handlers use an administrator of their own with a known password: created by the admin, made
// Admin (POST /admin/sessions/revoke needs an administrator revoking its own session), its first sign-in done
// through force_change_password (an administrator never sets the password of an account).
export function setup() {
  const admin = bearer(ADMIN_JWT);
  const signInEmail = `${unique('perf-sign-in')}@perf.mairie360.fr`;
  fixture('POST', coverage.url('POST /admin/users'), { email: signInEmail, first_name: 'Perf', last_name: 'SignIn', password: USER_PASSWORD }, admin);
  const roles = (json(fixture('GET', coverage.url('GET /admin/roles'), undefined, admin)) || {}).roles || [];
  const adminRole = roles.find((role) => role.name === 'Admin');
  const signInId = findUserId(signInEmail, { admin });
  if (!adminRole || signInId === undefined) throw new Error('setup: cannot find the Admin role or the sign-in account');
  fixture('POST', coverage.url('POST /admin/users/{userId}/roles', { userId: signInId }), { role_id: adminRole.id }, admin);
  const first = fixture('POST', coverage.url('POST /auth/login'), { email: signInEmail, password: USER_PASSWORD, device_info: 'k6' }, {}, [412]);
  fixture('POST', coverage.url('POST /auth/force_change_password'), { token: first.json('token'), new_password: SIGN_IN_PASSWORD }, {}, [204]);
  return { signInEmail, admin, user: bearer(userJwt(USER_ID)) };
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

/** Once, alone: the two-factor policy, the enrolment, the second step and the passkey sign-in. */
export function policyScenario(data) {
  policyCoverage.run({ data });
}

export function crud(data) {
  state = {};
  // User token by default; the /admin/* handlers pass the admin one.
  coverage.run({ headers: data.user, data });
  cleanup(data);
  sleep(1);
}
