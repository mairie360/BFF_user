import type { Express } from 'express';
import request from 'supertest';
import { assertStartupConfiguration } from '../src/index';
import { ContractMockServer } from './support/contract-mock-server';
import { adminUsersPage, group, groupsResult, loadCoreApiContract, meResponse } from './support/core-fixtures';
import { captureLogs } from './support/logs';
import { JWT_PUBLIC_KEY, eddsaToken, hs256Token, useSessionPublicKey } from './support/session-keys';

// MAIR-680 (audit A1): Core is the only signer of the session JWTs (Ed25519, EdDSA). The BFF verifies them with
// Core's public key (`JWT_PUBLIC_KEY`) and no longer needs the shared `JWT_SECRET`: once it is removed, a token
// signed with any HMAC secret (the historical HS256 tokens, or one forged by a compromised service) is refused.

const coreApi = new ContractMockServer('CORE_API', loadCoreApiContract());
const CORE = { me: '/api/v1/user/me/', groups: '/api/v1/groups/', adminUsers: '/api/v1/admin/users/' } as const;
const TRANSITION_SECRET = 'mair-680-transition-secret-of-the-tests';
const saved = { publicKey: process.env.JWT_PUBLIC_KEY, secret: process.env.JWT_SECRET, url: process.env.CORE_API_URL };

let app: Express;

beforeAll(async () => {
  await coreApi.start();
  ({ app } = await import('../src/app'));
});

afterAll(async () => {
  await coreApi.stop();
  for (const [name, value] of [['JWT_PUBLIC_KEY', saved.publicKey], ['JWT_SECRET', saved.secret], ['CORE_API_URL', saved.url]] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

beforeEach(() => {
  captureLogs();
  coreApi.reset();
  process.env.CORE_API_URL = coreApi.url;
  useSessionPublicKey();
  coreApi.on('get', CORE.me, { body: meResponse({ role: 'admin' }) });
  coreApi.on('get', CORE.groups, { body: groupsResult([group(1)]) });
  coreApi.on('get', CORE.adminUsers, { body: adminUsersPage([]) });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('MAIR-680 startup with the session public key', () => {
  it('MAIR-680 starts with JWT_PUBLIC_KEY alone, without JWT_SECRET', () => {
    expect(process.env.JWT_SECRET).toBeUndefined();

    expect(() => assertStartupConfiguration()).not.toThrow();
  });

  it('MAIR-680 refuses to start without JWT_PUBLIC_KEY nor JWT_SECRET', () => {
    delete process.env.JWT_PUBLIC_KEY;

    expect(() => assertStartupConfiguration()).toThrow('Missing configuration: JWT_PUBLIC_KEY');
  });

  it('MAIR-680 refuses to start with a malformed JWT_PUBLIC_KEY', () => {
    process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nnot a key\n-----END PUBLIC KEY-----';

    expect(() => assertStartupConfiguration()).toThrow('Invalid configuration: JWT_PUBLIC_KEY');
  });

  it('MAIR-680 accepts the key with escaped line breaks, as environment files hold it', () => {
    process.env.JWT_PUBLIC_KEY = JWT_PUBLIC_KEY.trim().replace(/\n/g, '\\n');

    expect(() => assertStartupConfiguration()).not.toThrow();
  });
});

describe('MAIR-680 session tokens signed by Core with its Ed25519 key', () => {
  const routes = [['GET /me', '/me'], ['GET /session/me', '/session/me'], ['GET /admin/users', '/admin/users']] as const;

  it.each(routes)('MAIR-680 %s accepts an EdDSA token and forwards it to Core API', async (_label, path) => {
    const token = eddsaToken(1, { claims: { role: 'admin' } });

    const response = await request(app).get(path).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(coreApi.requests.length).toBeGreaterThan(0);
    for (const call of coreApi.requests) expect(call.headers.authorization).toBe(`Bearer ${token}`);
  });

  it.each(routes)('MAIR-680 %s refuses an HS256 token with 401 when JWT_SECRET is unset, without calling Core API', async (_label, path) => {
    const response = await request(app).get(path).set('Authorization', `Bearer ${hs256Token(1, TRANSITION_SECRET)}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: 'UNAUTHORIZED', message: expect.any(String), details: [] } });
    expect(coreApi.requests).toHaveLength(0);
  });

  it.each(routes)('MAIR-680 %s still accepts an HS256 token while JWT_SECRET is set (transition)', async (_label, path) => {
    process.env.JWT_SECRET = TRANSITION_SECRET;

    const response = await request(app).get(path).set('Authorization', `Bearer ${hs256Token(1, TRANSITION_SECRET)}`);

    expect(response.status).toBe(200);
  });

  it.each(routes)('MAIR-680 %s answers 503 without calling Core API when no session key is configured', async (_label, path) => {
    delete process.env.JWT_PUBLIC_KEY;

    const response = await request(app).get(path).set('Authorization', `Bearer ${eddsaToken(1)}`);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toMatch(/JWT_(PUBLIC_KEY|SECRET)/);
    expect(coreApi.requests).toHaveLength(0);
  });

  it.each(routes)('MAIR-680 %s answers 503 without calling Core API when JWT_PUBLIC_KEY is malformed', async (_label, path) => {
    process.env.JWT_PUBLIC_KEY = 'not a PEM key';

    const response = await request(app).get(path).set('Authorization', `Bearer ${eddsaToken(1)}`);

    expect(response.status).toBe(503);
    expect(coreApi.requests).toHaveLength(0);
  });
});
