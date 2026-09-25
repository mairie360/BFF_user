import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import type { GetUserResponseView } from '@mairie360/core-api-openapi/model';

// Toute l'application est testée contre un vrai serveur HTTP simulant Core API, piloté par le contrat
// reconstruit depuis le paquet @mairie360/core-api-openapi installé (tests/support/orval-contract.ts) :
// le BFF n'a plus d'accès direct à PostgreSQL ni à Redis. Les corps simulés sont typés par les modèles générés
// et les chemins attendus viennent des helpers d'URL du client généré.

import { ContractMockServer, unreachableUrl, type MockReply } from './support/contract-mock-server';
import { OpenApiContract } from './support/openapi-contract';
import {
  JWT_SECRET, adminUsersPage, coreApiUrls, expiredToken, group, groupResult, groupsResult, historyResult, loadCoreApiContract,
  loginResponse, meResponse, postGroupResult, role, rolesResult, session, sessionToken, sessionsResult, userResponse,
} from './support/core-fixtures';

const coreApi = new ContractMockServer('CORE_API', loadCoreApiContract());
// Gabarits du contrat Core API (clés des mocks) ; les chemins concrets attendus viennent de coreApiUrls.
const CORE = {
  login: '/api/v1/auth/login', forceChangePassword: '/api/v1/auth/force_change_password',
  me: '/api/v1/user/me/', user: '/api/v1/user/{id}/',
  adminUsers: '/api/v1/admin/users/', adminUser: '/api/v1/admin/users/{userId}/', adminUserRoles: '/api/v1/admin/users/{userId}/roles/',
  adminUserRole: '/api/v1/admin/users/{userId}/roles/{roleId}', adminRoles: '/api/v1/admin/roles/', adminRole: '/api/v1/admin/roles/{id}',
  groups: '/api/v1/groups/', group: '/api/v1/groups/{groupId}/',
  sessions: '/api/v1/sessions/', sessionsHistory: '/api/v1/sessions/history', sessionsRefresh: '/api/v1/sessions/refresh', sessionsRevoke: '/api/v1/sessions/revoke',
  health: '/health',
} as const;
const bffContract = OpenApiContract.load(path.join(__dirname, '..', 'contracts', 'openapi.json'));

const ADMIN_ID = 1;
/** Jeton de première connexion : ForceChangePasswordView.token doit être un UUID. */
const FIRST_CONNECTION_TOKEN = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const SESSION = sessionToken(ADMIN_ID);

let app: Express;

beforeAll(async () => {
  await coreApi.start();
  // coreClient lit CORE_API_URL au chargement : l'application est importée après.
  process.env.CORE_API_URL = coreApi.url;
  delete process.env.CORE_API_PORT;
  process.env.JWT_SECRET = JWT_SECRET;
  ({ app } = await import('../src/index'));
});
afterAll(async () => { await coreApi.stop(); });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CORE_API_URL = coreApi.url;
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  coreApi.reset();
  // Le rôle de l'appelant est lu dans Core API avant toute route d'administration.
  coreApi.on('get', CORE.me, { body: meResponse({ role: 'Admin' }) });
});

afterEach(() => {
  jest.restoreAllMocks();
  expect(coreApi.violations).toEqual([]);
});

function expectBffContract(method: string, pathname: string, response: request.Response) {
  const match = bffContract.match(method, pathname);
  expect(match?.template).toBeDefined();
  const { documented, schema } = bffContract.responseSchema(match!, response.status);
  expect({ status: response.status, documented }).toEqual({ status: response.status, documented: true });
  if (schema && response.type === 'application/json') expect(bffContract.validate(schema, response.body)).toEqual([]);
}

/** Appels reçus par Core API, sous la forme `MÉTHODE chemin` (chemin tel que le construit le client généré). */
const upstreamSequence = () => coreApi.requests.map((call) => `${call.method} ${call.url.pathname}`);
const called = (method: string, url: string) => `${method} ${url}`;

/** Erreur Core API : actix renvoie un corps texte, et orval ne type pas les erreurs. */
const coreError = (status: number, message: string): MockReply => ({ status, raw: message, contentType: 'text/plain', outOfContract: true });

describe('BFF User with a contract-driven Core API mock', () => {
  describe('POST /auth/login', () => {
    const credentials = { email: 'alice@mairie.test', password: 'MotDePasse123', device_info: 'Firefox' };

    test('sends an anonymous contract-valid login and turns the Core JWT into a Bearer header and httpOnly cookie', async () => {
      coreApi.on('post', CORE.login, { body: loginResponse(), headers: { Authorization: 'Bearer core.jwt.token' } });

      const response = await request(app).post('/auth/login').send(credentials);

      expect(response.status).toBe(200);
      expectBffContract('post', '/auth/login', response);
      expect(response.body).toEqual(loginResponse());
      expect(response.headers.authorization).toBe('Bearer core.jwt.token');
      expect(response.headers['access-control-expose-headers']).toBe('Authorization');
      expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=core\.jwt\.token;.*HttpOnly/);
      const [login] = coreApi.calls(CORE.login);
      expect(login.body).toEqual(credentials);
      // Le login reste anonyme, même si le client envoie une session.
      expect(login.headers.authorization).toBeUndefined();
    });

    test.each([
      ['a missing password', { email: 'alice@mairie.test', device_info: 'Firefox' }],
      ['an invalid email', { ...credentials, email: 'alice' }],
    ])('rejects %s with 400 before calling Core API', async (_label, body) => {
      const response = await request(app).post('/auth/login').send(body);

      expect(response.status).toBe(400);
      expectBffContract('post', '/auth/login', response);
      expect(response.body).toEqual({ message: 'Invalid login payload' });
      expect(coreApi.requests).toHaveLength(0);
    });

    test('only forwards the declared login fields to Core API', async () => {
      coreApi.on('post', CORE.login, { body: loginResponse(), headers: { Authorization: 'Bearer core.jwt.token' } });

      await request(app).post('/auth/login').send({ ...credentials, device_info: '', role: 'Admin' });

      expect(coreApi.calls(CORE.login)[0].body).toEqual({ ...credentials, device_info: '' });
    });

    test('relays invalid credentials as a JSON 401', async () => {
      coreApi.on('post', CORE.login, coreError(401, 'Invalid credentials provided.'));

      const response = await request(app).post('/auth/login').send(credentials);

      expect(response.status).toBe(401);
      expectBffContract('post', '/auth/login', response);
      expect(response.body).toEqual({ message: 'Invalid credentials provided.' });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    test('relays the first-connection 412 with its one-time token and sets no cookie', async () => {
      coreApi.on('post', CORE.login, { status: 412, body: { token: FIRST_CONNECTION_TOKEN }, outOfContract: true });

      const response = await request(app).post('/auth/login').send(credentials);

      expect(response.status).toBe(412);
      expectBffContract('post', '/auth/login', response);
      expect(response.body).toEqual({ token: FIRST_CONNECTION_TOKEN });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    test('returns 502 when Core API answers 200 without the Authorization header', async () => {
      coreApi.on('post', CORE.login, { body: loginResponse() });

      const response = await request(app).post('/auth/login').send(credentials);

      expect(response.status).toBe(502);
      expectBffContract('post', '/auth/login', response);
      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('POST /auth/register (removed)', () => {
    test('is no longer served and never reaches Core API', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ email: 'bob@mairie.test', first_name: 'Bob', last_name: 'Durand', password: 'MotDePasse123' });

      expect(response.status).toBe(404);
      expect(coreApi.requests).toHaveLength(0);
    });
  });

  describe('POST /auth/force_change_password', () => {
    const payload = { token: FIRST_CONNECTION_TOKEN, new_password: 'Updated-456!' };

    test('calls Core API without the generated trailing slash, then persists and consumes the token', async () => {
      coreApi.on('post', CORE.forceChangePassword, { status: 200 });

      const response = await request(app).post('/auth/force_change_password').send(payload);

      expect(response.status).toBe(204);
      expectBffContract('post', '/auth/force_change_password', response);
      expect(upstreamSequence()).toEqual([called('POST', coreApiUrls.getForceChangePasswordUrl())]);
      expect(coreApi.requests[0].body).toEqual(payload);
      expect(coreApi.requests[0].headers.authorization).toBeUndefined();
    });

    test('forwards the Core API refusal of an unknown token', async () => {
      coreApi.on('post', CORE.forceChangePassword, coreError(401, 'Unauthorized'));

      const response = await request(app).post('/auth/force_change_password').send(payload);

      expect(response.status).toBe(401);
      expectBffContract('post', '/auth/force_change_password', response);
      expect(response.body).toEqual({ message: 'Unauthorized' });
    });

    test.each([
      ['an invalid payload', { token: '' }, 400],
      ['an empty password', { token: FIRST_CONNECTION_TOKEN, new_password: '' }, 400],
    ])('rejects %s before calling Core API', async (_label, body, status) => {
      const response = await request(app).post('/auth/force_change_password').send(body);

      expect(response.status).toBe(status);
      expectBffContract('post', '/auth/force_change_password', response);
      expect(coreApi.requests).toHaveLength(0);
    });
  });

  describe('POST /auth/refresh', () => {
    const payload = { refresh_token: 'opaque-refresh-token' };

    test('renews the JWT through the public Core refresh without forwarding any session', async () => {
      coreApi.on('post', CORE.sessionsRefresh, { raw: 'JWT refreshed successfully', contentType: 'text/plain', headers: { Authorization: 'Bearer refreshed.jwt.token' } });

      const response = await request(app).post('/auth/refresh').set('Cookie', `accessToken=${SESSION}`).send(payload);

      expect(response.status).toBe(200);
      expectBffContract('post', '/auth/refresh', response);
      expect(response.body).toEqual({ message: 'JWT refreshed successfully' });
      expect(response.headers.authorization).toBe('Bearer refreshed.jwt.token');
      expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=refreshed\.jwt\.token;.*HttpOnly/);
      expect(upstreamSequence()).toEqual([called('POST', coreApiUrls.getRefreshUrl())]);
      expect(coreApi.requests[0].body).toEqual(payload);
      // The refresh token alone identifies the session: an (expired) JWT is never forwarded.
      expect(coreApi.requests[0].headers.authorization).toBeUndefined();
    });

    test('relays an unknown, revoked or expired refresh token as a JSON 401', async () => {
      coreApi.on('post', CORE.sessionsRefresh, coreError(401, 'Session not found'));

      const response = await request(app).post('/auth/refresh').send(payload);

      expect(response.status).toBe(401);
      expectBffContract('post', '/auth/refresh', response);
      expect(response.body).toEqual({ message: 'Session not found' });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    test.each([
      ['a Core API 500', coreError(500, 'An error occurred while accessing the database.')],
      ['a dropped connection', { dropConnection: true }],
    ] as Array<[string, MockReply]>)('maps %s to a documented 502 without upstream details', async (_label, reply) => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      coreApi.on('post', CORE.sessionsRefresh, reply);

      const response = await request(app).post('/auth/refresh').send(payload);

      expect(response.status).toBe(502);
      expectBffContract('post', '/auth/refresh', response);
      expect(JSON.stringify(response.body)).not.toContain('database');
    });

    test('returns 502 when Core API omits the renewed JWT', async () => {
      coreApi.on('post', CORE.sessionsRefresh, { raw: 'JWT refreshed successfully', contentType: 'text/plain' });

      const response = await request(app).post('/auth/refresh').send(payload);

      expect(response.status).toBe(502);
      expectBffContract('post', '/auth/refresh', response);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    test('rejects an invalid payload with 400 before calling Core API', async () => {
      const response = await request(app).post('/auth/refresh').send({ refresh_token: '' });

      expect(response.status).toBe(400);
      expectBffContract('post', '/auth/refresh', response);
      expect(coreApi.requests).toHaveLength(0);
    });
  });

  describe('POST /auth/logout', () => {
    test('clears the cookie without calling Core API when no refresh token is sent', async () => {
      const response = await request(app).post('/auth/logout').set('Cookie', `accessToken=${SESSION}`);

      expect(response.status).toBe(200);
      expectBffContract('post', '/auth/logout', response);
      expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: false });
      expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
      expect(coreApi.requests).toHaveLength(0);
    });

    test('revokes the Core session with the caller session and refresh token', async () => {
      coreApi.on('post', CORE.sessionsRevoke, { status: 200, raw: 'Session revoked', contentType: 'text/plain' });

      const response = await request(app).post('/auth/logout').set('Cookie', `accessToken=${SESSION}`).send({ refresh_token: 'opaque-refresh-token' });

      expect(response.status).toBe(200);
      expectBffContract('post', '/auth/logout', response);
      expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: true });
      expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
      expect(upstreamSequence()).toEqual([called('POST', coreApiUrls.getRevokeUrl())]);
      expect(coreApi.requests[0]).toMatchObject({ body: { refresh_token: 'opaque-refresh-token' }, headers: { authorization: `Bearer ${SESSION}` } });
    });

    test.each([
      ['a Core API 401', coreError(401, 'Invalid refresh token')],
      ['a Core API 500', coreError(500, 'An error occurred while accessing the database.')],
      ['a dropped connection', { dropConnection: true }],
    ] as Array<[string, MockReply]>)('still clears the cookie on %s', async (_label, reply) => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      coreApi.on('post', CORE.sessionsRevoke, reply);

      const response = await request(app).post('/auth/logout').set('Authorization', `Bearer ${SESSION}`).send({ refresh_token: 'opaque-refresh-token' });

      expect(response.status).toBe(200);
      expectBffContract('post', '/auth/logout', response);
      expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: false });
      expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
    });
  });

  describe('GET /session/me and /me', () => {
    beforeEach(() => {
      coreApi.on('get', CORE.me, { body: meResponse({ role: 'Responsable' }) });
      coreApi.on('get', CORE.groups, { body: groupsResult([group(1), group(2, { description: null })]) });
    });

    test.each([
      ['/session/me', 'the accessToken cookie', (call: request.Test) => call.set('Cookie', `accessToken=${SESSION}`)],
      ['/me', 'the x-session-token header', (call: request.Test) => call.set('x-session-token', SESSION)],
    ])('%s reads the session from %s and aggregates Core user and groups', async (pathname, _source, authenticate) => {
      const response = await authenticate(request(app).get(pathname));

      expect(response.status).toBe(200);
      expectBffContract('get', pathname, response);
      expect(response.body).toEqual({
        user: meResponse({ role: 'Responsable' }),
        groups: [group(1), group(2, { description: null })],
        roles: ['Responsable'],
      });
      expect(upstreamSequence().sort()).toEqual([called('GET', coreApiUrls.getGetGroupsUrl()), called('GET', coreApiUrls.getGetMeUrl())]);
      for (const call of coreApi.requests) expect(call.headers.authorization).toBe(`Bearer ${SESSION}`);
    });

    test('rejects a request without session before calling Core API', async () => {
      const response = await request(app).get('/session/me');

      expect(response.status).toBe(401);
      expectBffContract('get', '/session/me', response);
      expect(coreApi.requests).toHaveLength(0);
    });

    test('relays a session rejected by Core API as 401', async () => {
      coreApi.on('get', CORE.me, coreError(401, 'Unauthorized'));

      const response = await request(app).get('/me').set('Authorization', `Bearer ${SESSION}`);

      expect(response.status).toBe(401);
      expectBffContract('get', '/me', response);
      expect(response.body).toEqual({ message: 'Unauthorized' });
    });
  });

  describe('GET /user/:userId/about', () => {
    test('forwards the session cookie to GET /api/v1/user/{id}/ and only returns public fields', async () => {
      coreApi.on('get', CORE.user, { body: userResponse({ is_archived: true }) });

      const response = await request(app).get('/user/7/about').set('Cookie', `accessToken=${SESSION}`);

      expect(response.status).toBe(200);
      expectBffContract('get', '/user/7/about', response);
      expect(response.body).toEqual({ email: 'alice@mairie.test', first_name: 'Alice', last_name: 'Martin', phone: '+33123456789', status: 'active' });
      expect(coreApi.calls(CORE.user)[0]).toMatchObject({ url: expect.objectContaining({ pathname: coreApiUrls.getGetUserUrl(7) }), headers: { authorization: `Bearer ${SESSION}` } });
    });

    test.each([
      ['null', null],
      ['absent', undefined],
    ])('returns phone null when Core API sends it %s', async (_label, phone) => {
      const user: Partial<GetUserResponseView> = userResponse({ phone });
      if (phone === undefined) delete user.phone;
      coreApi.on('get', CORE.user, { body: user });

      const response = await request(app).get('/user/7/about').set('Authorization', `Bearer ${SESSION}`);

      expect(response.status).toBe(200);
      expectBffContract('get', '/user/7/about', response);
      expect(response.body.phone).toBeNull();
    });

    test.each([
      ['a non numeric user id', '/user/abc/about', `Bearer ${SESSION}`, 400],
      ['a request without session', '/user/7/about', undefined, 401],
    ])('rejects %s before calling Core API', async (_label, url, authorization, status) => {
      const call = request(app).get(url);
      const response = await (authorization ? call.set('Authorization', authorization) : call);

      expect(response.status).toBe(status);
      expectBffContract('get', url, response);
      expect(response.body).not.toHaveProperty('error');
      expect(coreApi.requests).toHaveLength(0);
    });

    test('relays a Core API 401', async () => {
      coreApi.on('get', CORE.user, coreError(401, 'Unauthorized'));

      const response = await request(app).get('/user/7/about').set('x-session-token', SESSION);

      expect(response.status).toBe(401);
      expectBffContract('get', '/user/7/about', response);
    });
  });

  describe('/bff/admin routes proxied to Core API', () => {
    type ProxyCase = {
      route: string; body?: object;
      upstream: string; template: string; reply: MockReply;
      status: number; responseBody?: unknown;
    };
    const cases: ProxyCase[] = [
      {
        route: 'POST /bff/admin/users', body: { email: 'bob@mairie.test', first_name: 'Bob', last_name: 'Durand', password: 'MotDePasse123' },
        upstream: called('POST', coreApiUrls.getAdminPostUserUrl()), template: CORE.adminUsers, reply: { status: 201, raw: 'User created successfully!', contentType: 'text/plain' },
        status: 201, responseBody: { message: 'User created successfully!' },
      },
      { route: 'PATCH /bff/admin/users/7', body: { first_name: 'Alicia', phone_number: null }, upstream: called('PATCH', coreApiUrls.getAdminPatchUserUrl(7)), template: CORE.adminUser, reply: { status: 200 }, status: 200 },
      { route: 'POST /bff/admin/users/7/roles', body: { user_id: 7, role_id: 3 }, upstream: called('POST', coreApiUrls.getAdminAddRoleToUserUrl(7)), template: CORE.adminUserRoles, reply: { status: 200 }, status: 200 },
      { route: 'DELETE /bff/admin/users/7/roles/3', upstream: called('DELETE', coreApiUrls.getAdminDeleteUserRoleUrl(7, 3)), template: CORE.adminUserRole, reply: { status: 204 }, status: 204 },
      { route: 'GET /bff/admin/roles', upstream: called('GET', coreApiUrls.getAdminGetRoleUrl()), template: CORE.adminRoles, reply: { body: rolesResult([role(1), role(3)]) }, status: 200, responseBody: rolesResult([role(1), role(3)]) },
      { route: 'POST /bff/admin/roles', body: { name: 'Agent', description: 'Agent municipal' }, upstream: called('POST', coreApiUrls.getAdminPostRoleUrl()), template: CORE.adminRoles, reply: { status: 200 }, status: 200 },
      { route: 'PUT /bff/admin/roles/3', body: { name: 'Agent', description: 'Agent municipal', can_be_deleted: true }, upstream: called('PUT', coreApiUrls.getAdminPutRoleUrl(3)), template: CORE.adminRole, reply: { status: 200 }, status: 200 },
      { route: 'PATCH /bff/admin/roles/3', body: { description: 'Agent de mairie' }, upstream: called('PATCH', coreApiUrls.getAdminPatchRoleUrl(3)), template: CORE.adminRole, reply: { status: 200 }, status: 200 },
      { route: 'DELETE /bff/admin/roles/3', upstream: called('DELETE', coreApiUrls.getAdminDeleteRoleUrl(3)), template: CORE.adminRole, reply: { status: 204 }, status: 204 },
      { route: 'GET /bff/admin/groups', upstream: called('GET', coreApiUrls.getGetGroupsUrl()), template: CORE.groups, reply: { body: groupsResult([group(1)]) }, status: 200, responseBody: groupsResult([group(1)]) },
      { route: 'POST /bff/admin/groups', body: { name: 'Culture', description: 'Service culture' }, upstream: called('POST', coreApiUrls.getPostGroupUrl()), template: CORE.groups, reply: { body: postGroupResult(5) }, status: 200, responseBody: postGroupResult(5) },
      { route: 'GET /bff/admin/groups/5', upstream: called('GET', coreApiUrls.getGetGroupUrl(5)), template: CORE.group, reply: { body: groupResult(group(5)) }, status: 200, responseBody: groupResult(group(5)) },
      { route: 'DELETE /bff/admin/groups/5', upstream: called('DELETE', coreApiUrls.getDeleteGroupUrl(5)), template: CORE.group, reply: { status: 204 }, status: 204 },
      { route: 'GET /bff/admin/sessions', upstream: called('GET', coreApiUrls.getGetActiveSessionsUrl()), template: CORE.sessions, reply: { body: sessionsResult([session('s-1')]) }, status: 200, responseBody: sessionsResult([session('s-1')]) },
      {
        route: 'GET /bff/admin/sessions/history', upstream: called('GET', coreApiUrls.getHistoryUrl()), template: CORE.sessionsHistory,
        reply: { body: historyResult([session('s-1', { revoked_at: '2026-09-16T08:00:00Z' })]) }, status: 200, responseBody: historyResult([session('s-1', { revoked_at: '2026-09-16T08:00:00Z' })]),
      },
      { route: 'POST /bff/admin/sessions/revoke', body: { refresh_token: 'opaque-refresh-token' }, upstream: called('POST', coreApiUrls.getRevokeUrl()), template: CORE.sessionsRevoke, reply: { status: 200 }, status: 200 },
    ];

    test.each(cases)('$route checks the admin role then calls $upstream with the session', async ({ route, body, upstream, template, reply, status, responseBody }) => {
      const [method, pathname] = route.split(' ');
      coreApi.on(upstream.split(' ')[0], template, reply);
      let call = request(app)[method.toLowerCase() as 'get'](pathname).set('Cookie', `accessToken=${SESSION}`);
      if (body) call = call.send(body);

      const response = await call;

      expect(response.status).toBe(status);
      expectBffContract(method, pathname, response);
      if (responseBody !== undefined) expect(response.body).toEqual(responseBody);
      // Le rôle est lu dans Core API avant l'appel proxifié.
      expect(upstreamSequence()).toEqual([called('GET', coreApiUrls.getGetMeUrl()), upstream]);
      const proxied = coreApi.requests[1];
      expect(proxied.headers.authorization).toBe(`Bearer ${SESSION}`);
      if (body) expect(proxied.body).toEqual(body);
    });

    test.each(cases)('$route is refused to a non-admin session, whose role is the only Core API call', async ({ route, body }) => {
      const [method, pathname] = route.split(' ');
      coreApi.on('get', CORE.me, { body: meResponse({ role: 'User' }) });
      let call = request(app)[method.toLowerCase() as 'get'](pathname).set('Cookie', `accessToken=${sessionToken(7)}`);
      if (body) call = call.send(body);

      const response = await call;

      expect(response.status).toBe(403);
      expectBffContract(method, pathname, response);
      expect(response.body).toEqual({ message: 'Administrator role required' });
      expect(upstreamSequence()).toEqual([called('GET', coreApiUrls.getGetMeUrl())]);
    });

    test('POST /bff/admin/sessions/refresh relays the refreshed JWT as Bearer header and httpOnly cookie', async () => {
      coreApi.on('post', CORE.sessionsRefresh, { raw: 'JWT refreshed successfully', contentType: 'text/plain', headers: { Authorization: 'Bearer refreshed.jwt.token' } });

      const response = await request(app).post('/bff/admin/sessions/refresh').set('Cookie', `accessToken=${SESSION}`).send({ refresh_token: 'opaque-refresh-token' });

      expect(response.status).toBe(200);
      expectBffContract('post', '/bff/admin/sessions/refresh', response);
      expect(response.body).toEqual({ message: 'JWT refreshed successfully' });
      expect(response.headers.authorization).toBe('Bearer refreshed.jwt.token');
      expect(response.headers['access-control-expose-headers']).toBe('Authorization');
      expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=refreshed\.jwt\.token;.*HttpOnly/);
      expect(coreApi.requests[1]).toMatchObject({ body: { refresh_token: 'opaque-refresh-token' }, headers: { authorization: `Bearer ${SESSION}` } });
    });

    test('POST /bff/admin/sessions/refresh returns 502 when Core API omits the refreshed JWT', async () => {
      coreApi.on('post', CORE.sessionsRefresh, { raw: 'JWT refreshed successfully', contentType: 'text/plain' });

      const response = await request(app).post('/bff/admin/sessions/refresh').set('Cookie', `accessToken=${SESSION}`).send({ refresh_token: 'opaque-refresh-token' });

      expect(response.status).toBe(502);
      expectBffContract('post', '/bff/admin/sessions/refresh', response);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    test.each([
      ['the Authorization header', (call: request.Test) => call.set('Authorization', `Bearer ${SESSION}`)],
      ['the x-session-token header', (call: request.Test) => call.set('x-session-token', SESSION)],
      ['the accessToken cookie', (call: request.Test) => call.set('Cookie', `accessToken=${SESSION}`)],
      ['the legacy session cookie', (call: request.Test) => call.set('Cookie', `session=${SESSION}`)],
    ])('forwards %s to Core API as a Bearer token', async (_source, authenticate) => {
      coreApi.on('get', CORE.groups, { body: groupsResult([]) });

      const response = await authenticate(request(app).get('/bff/admin/groups'));

      expect(response.status).toBe(200);
      expect(coreApi.requests[0].headers.authorization).toBe(`Bearer ${SESSION}`);
    });

    test.each([
      ['no credential', undefined],
      ['an unsigned token', 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.'],
      ['a malformed token', 'Bearer not-a-jwt'],
      ['an expired token', `Bearer ${expiredToken(ADMIN_ID)}`],
    ])('answers %s with a generic 401 and never calls Core API', async (_label, authorization) => {
      const call = request(app).get('/bff/admin/groups');
      const response = await (authorization ? call.set('Authorization', authorization) : call);

      expect(response.status).toBe(401);
      expectBffContract('get', '/bff/admin/groups', response);
      expect(response.body).toEqual({ message: expect.stringMatching(/^Invalid (or missing|or expired) session token$/) });
      expect(coreApi.requests).toHaveLength(0);
    });

    test.each([
      ['PUT /bff/admin/roles/abc', 'roleId'],
      ['DELETE /bff/admin/users/7/roles/0', 'roleId'],
      ['GET /bff/admin/groups/-1', 'groupId'],
      ['PATCH /bff/admin/users/1.5', 'userId'],
    ])('%s is rejected with 400 before calling Core API', async (route, name) => {
      const [method, pathname] = route.split(' ');

      const response = await request(app)[method.toLowerCase() as 'get'](pathname).set('Cookie', `accessToken=${SESSION}`).send({});

      expect(response.status).toBe(400);
      expectBffContract(method, pathname, response);
      expect(response.body).toEqual({ message: `Invalid ${name}` });
      // Le rôle est vérifié avant les paramètres, pour ne rien révéler à un appelant non autorisé.
      expect(upstreamSequence()).toEqual([called('GET', coreApiUrls.getGetMeUrl())]);
    });
  });

  describe('DELETE /bff/admin/users/:userId', () => {
    test('checks the admin role locally, then deletes the user in Core API', async () => {
      coreApi.on('delete', CORE.adminUser, { status: 204 });

      const response = await request(app).delete('/bff/admin/users/7').set('Authorization', `Bearer ${SESSION}`);

      expect(response.status).toBe(204);
      expectBffContract('delete', '/bff/admin/users/7', response);
      expect(upstreamSequence()).toEqual([called('GET', coreApiUrls.getGetMeUrl()), called('DELETE', coreApiUrls.getAdminDeleteUserUrl(7))]);
      expect(coreApi.requests[0].headers.authorization).toBe(`Bearer ${SESSION}`);
    });

    test('refuses a non-admin user after reading their role, without deleting anything', async () => {
      coreApi.on('get', CORE.me, { body: meResponse({ role: 'User' }) });

      const response = await request(app).delete('/bff/admin/users/7').set('Authorization', `Bearer ${SESSION}`);

      expect(response.status).toBe(403);
      expectBffContract('delete', '/bff/admin/users/7', response);
      expect(upstreamSequence()).toEqual([called('GET', coreApiUrls.getGetMeUrl())]);
    });

    test('refuses a token signed with another secret without calling Core API', async () => {
      const response = await request(app).delete('/bff/admin/users/7')
        .set('Authorization', `Bearer ${sessionToken(ADMIN_ID, 'other-secret')}`);

      expect(response.status).toBe(401);
      expectBffContract('delete', '/bff/admin/users/7', response);
      expect(coreApi.requests).toHaveLength(0);
    });
  });

  test.each([
    ['GET /bff/admin/users?page=2&page_size=5', { page: 2, page_size: 5 }],
    ['GET /bff/admin/groups/5/users', { group_id: 5, page_size: 500 }],
  ])('%s is served by the Core API administration listing', async (route, query) => {
    coreApi.on('get', CORE.adminUsers, { body: adminUsersPage([], { page: 2, page_size: 5, total: 5, total_pages: 1 }) });
    const [, url] = route.split(' ');

    const response = await request(app).get(url).set('Authorization', `Bearer ${SESSION}`);

    expect(response.status).toBe(200);
    expectBffContract('get', url.split('?')[0], response);
    expect(`${coreApi.requests[1].url.pathname}${coreApi.requests[1].url.search}`).toBe(coreApiUrls.getAdminListUsersUrl(query));
  });

  describe('Core API failures', () => {
    test.each([
      ['400', coreError(400, 'Bad request'), 400, { message: 'Bad request' }],
      ['403', coreError(403, 'Forbidden: User is not an admin.'), 403, { message: 'Forbidden: User is not an admin.' }],
      ['404', coreError(404, 'Not found'), 404, { message: 'Not found' }],
      ['500', coreError(500, 'An error occurred while accessing the database.'), 502, { message: 'Upstream service error' }],
      ['dropped connection', { dropConnection: true }, 502, { message: 'Upstream service error' }],
    ] as Array<[string, MockReply, number, object]>)('maps a Core API %s on an admin proxy route without leaking upstream details', async (_label, reply, status, body) => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      coreApi.on('get', CORE.group, reply);

      const response = await request(app).get('/bff/admin/groups/5').set('Authorization', `Bearer ${SESSION}`);

      expect(response.status).toBe(status);
      expectBffContract('get', '/bff/admin/groups/5', response);
      expect(response.body).toEqual(body);
    });

    test.each([
      ['POST /auth/login', CORE.login, { email: 'alice@mairie.test', password: 'MotDePasse123', device_info: 'Firefox' }],
      ['POST /auth/force_change_password', CORE.forceChangePassword, { token: FIRST_CONNECTION_TOKEN, new_password: 'Updated-456!' }],
      ['GET /user/7/about', CORE.user, undefined],
      ['GET /me', CORE.me, undefined],
    ])('%s maps a Core API 500 to a documented 502', async (route, template, body) => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const [method, pathname] = route.split(' ');
      coreApi.on(body ? 'post' : 'get', template, coreError(500, 'An error occurred while accessing the database.'));
      if (pathname === '/me') coreApi.on('get', CORE.groups, { body: groupsResult([]) });

      let call = request(app)[method.toLowerCase() as 'get'](pathname).set('Authorization', `Bearer ${SESSION}`);
      if (body) call = call.send(body);
      const response = await call;

      expect(response.status).toBe(502);
      expectBffContract(method, pathname, response);
      expect(response.body).toEqual({ message: 'Upstream service error' });
    });

    test('hides the details of a Core API failure on the administration listing', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      coreApi.on('get', CORE.adminUsers, coreError(500, 'An error occurred while accessing the database.'));

      const response = await request(app).get('/bff/admin/users').set('Authorization', `Bearer ${SESSION}`);

      expect(response.status).toBe(502);
      expect(response.body).toEqual({ message: 'Upstream service error' });
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('GET /check_apis', () => {
    test('reports Core API connected through its /health operation', async () => {
      coreApi.on('get', CORE.health, { raw: 'OK', contentType: 'text/plain' });

      const response = await request(app).get('/check_apis');

      expect(response.status).toBe(200);
      expectBffContract('get', '/check_apis', response);
      expect(response.body).toEqual({ status: 'OK', core_api: 'Connected' });
      expect(upstreamSequence()).toEqual([called('GET', coreApiUrls.getHealthUrl())]);
    });

    test('builds the health URL from CORE_API_URL and CORE_API_PORT like the Core client', async () => {
      coreApi.on('get', CORE.health, { raw: 'OK', contentType: 'text/plain' });
      const { hostname, port } = new URL(coreApi.url);
      process.env.CORE_API_URL = hostname;
      process.env.CORE_API_PORT = port;

      const response = await request(app).get('/check_apis');
      delete process.env.CORE_API_PORT;

      expect(response.status).toBe(200);
      expect(upstreamSequence()).toEqual([called('GET', coreApiUrls.getHealthUrl())]);
    });

    test.each([
      ['/health fails', async () => { coreApi.on('get', CORE.health, coreError(500, 'KO')); }],
      ['nothing listens on CORE_API_URL', async () => { process.env.CORE_API_URL = await unreachableUrl(); }],
    ])('reports Core API unreachable without leaking network details when %s', async (_label, arrange) => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await arrange();

      const response = await request(app).get('/check_apis');

      expect(response.status).toBe(502);
      expectBffContract('get', '/check_apis', response);
      expect(response.body).toEqual({ status: 'Error', core_api: 'Unreachable' });
      expect(consoleError).toHaveBeenCalled();
    });
  });
});
