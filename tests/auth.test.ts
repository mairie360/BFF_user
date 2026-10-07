import { errorHandler } from '@mairie360/bffs-lib';
import { AxiosError, AxiosHeaders } from 'axios';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { LoginView } from '@mairie360/core-api-openapi/model';
import authRouter, { createAuthRouter } from '../src/routes/auth';
import { forceChangeUserPassword, keycloakLoginUser, loginUser, logoutSession, refreshSession, revokeSession } from '../src/routes/core_helpers';
import {
    authRateLimitOptionsFromEnv,
    createAuthRateLimiters,
    RATE_LIMIT_MESSAGE,
} from '../src/middleware/rateLimit';
import { axiosResponse, loginResponse } from './support/core-fixtures';

jest.mock('../src/routes/core_helpers', () => ({
    forceChangeUserPassword: jest.fn(),
    isLoginResponseView: jest.fn((value: unknown) => (
        typeof value === 'object'
        && value !== null
        && 'refresh_token' in value
    )),
    keycloakLoginUser: jest.fn(),
    loginUser: jest.fn(),
    logoutSession: jest.fn(),
    refreshSession: jest.fn(),
    revokeSession: jest.fn(),
}));

const mockedLoginUser = jest.mocked(loginUser);
const mockedForceChangePassword = jest.mocked(forceChangeUserPassword);
const mockedRevokeSession = jest.mocked(revokeSession);
const mockedLogoutSession = jest.mocked(logoutSession);
const mockedRefreshSession = jest.mocked(refreshSession);
const mockedKeycloakLogin = jest.mocked(keycloakLoginUser);

/** Jeton de première connexion : ForceChangePasswordView.token doit être un UUID. */
const FIRST_CONNECTION_TOKEN = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const credentials: LoginView = { email: 'user@example.com', password: 'password', device_info: 'test' };

/** Core API error as the generated axios client rejects it. */
const coreError = (status: number, data: unknown = 'Core error') => new AxiosError(`Request failed with status code ${status}`, undefined, undefined, undefined, {
    data, status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
});

/** 400 envelope of a Zod validation failure: the message of the route, one detail per invalid field. */
const invalidPayload = (message: string) => ({
    error: { code: 'BAD_REQUEST', message, details: expect.arrayContaining([expect.objectContaining({ path: expect.stringMatching(/^body/) })]) },
});

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRouter);
app.use(errorHandler({ onError: () => undefined }));

describe('POST /auth/login', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('only delivers the Core JWT and refresh token in HttpOnly cookies', async () => {
        mockedLoginUser.mockResolvedValue(axiosResponse(loginResponse(), 200, { authorization: 'Bearer header.payload.signature' }));

        const response = await request(app).post('/auth/login').send(credentials);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged in successfully' });
        expect(JSON.stringify(response.body)).not.toContain(loginResponse().refresh_token);
        expect(response.headers.authorization).toBeUndefined();
        expect(response.headers['access-control-expose-headers']).toBeUndefined();
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=header\.payload\.signature;.*Path=\/;.*HttpOnly;.*SameSite=Strict/);
        expect(response.headers['set-cookie'][1]).toMatch(new RegExp(`^refreshToken=${loginResponse().refresh_token};.*Path=/auth;.*HttpOnly;.*SameSite=Strict`));
        expect(mockedLoginUser).toHaveBeenCalledWith(credentials);
    });

    it('returns 502 when the Core omits the Authorization Bearer header', async () => {
        mockedLoginUser.mockResolvedValue(axiosResponse(loginResponse()));

        const response = await request(app).post('/auth/login').send(credentials);

        expect(response.status).toBe(502);
        expect(response.body).toEqual({ error: { code: 'BAD_GATEWAY', message: 'Core API did not return a Bearer token in the Authorization header', details: [] } });
        expect(response.headers.authorization).toBeUndefined();
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('relays only the one-time token of a first sign-in (Core 412)', async () => {
        mockedLoginUser.mockRejectedValue(coreError(412, { token: FIRST_CONNECTION_TOKEN, internal: 'hidden' }));

        const response = await request(app).post('/auth/login').send(credentials);

        expect(response.status).toBe(412);
        expect(response.body).toEqual({ token: FIRST_CONNECTION_TOKEN });
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('answers 502 for a Core 412 without a one-time token', async () => {
        mockedLoginUser.mockRejectedValue(coreError(412, 'First connection'));

        const response = await request(app).post('/auth/login').send(credentials);

        expect(response.status).toBe(502);
        expect(response.body.error.code).toBe('BAD_GATEWAY');
    });

    it('keeps a Core 401 with a generic message, without relaying the Core body', async () => {
        mockedLoginUser.mockRejectedValue(coreError(401, 'Invalid credentials provided.'));

        const response = await request(app).post('/auth/login').send(credentials);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: [] } });
    });

    it.each([403, 404, 409])('turns an undeclared Core %i into a 502', async (status) => {
        mockedLoginUser.mockRejectedValue(coreError(status, 'Core detail'));

        const response = await request(app).post('/auth/login').send(credentials);

        expect(response.status).toBe(502);
        expect(response.body).toEqual({ error: { code: 'BAD_GATEWAY', message: 'Upstream service error', details: [] } });
    });

    it('answers 400 with one detail per invalid field', async () => {
        const response = await request(app).post('/auth/login').send({ email: 'not-an-email', device_info: 'test' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('BAD_REQUEST');
        expect(response.body.error.message).toBe('Validation failed');
        expect(response.body.error.details.map((detail: { path: string }) => detail.path).sort()).toEqual(['body.email', 'body.password']);
        expect(mockedLoginUser).not.toHaveBeenCalled();
    });
});

describe('POST /auth/force_change_password', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedForceChangePassword.mockResolvedValue();
    });

    it('delegates the one-time token and the new password to Core API', async () => {
        const response = await request(app)
            .post('/auth/force_change_password')
            .send({ token: FIRST_CONNECTION_TOKEN, new_password: 'Updated-456!' });

        expect(response.status).toBe(204);
        expect(mockedForceChangePassword).toHaveBeenCalledWith({
            token: FIRST_CONNECTION_TOKEN,
            new_password: 'Updated-456!',
        });
    });

    it('rejects an invalid payload without calling Core API', async () => {
        const response = await request(app)
            .post('/auth/force_change_password')
            .send({ token: '' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual(invalidPayload('Validation failed'));
        expect(mockedForceChangePassword).not.toHaveBeenCalled();
    });

    it.each([
        [401, 'UNAUTHORIZED'],
        [403, 'FORBIDDEN'],
    ])('keeps a declared Core %i', async (status, code) => {
        mockedForceChangePassword.mockRejectedValue(coreError(status));

        const response = await request(app)
            .post('/auth/force_change_password')
            .send({ token: FIRST_CONNECTION_TOKEN, new_password: 'Updated-456!' });

        expect(response.status).toBe(status);
        expect(response.body.error.code).toBe(code);
    });

    it('turns a Core 404 into a 502', async () => {
        mockedForceChangePassword.mockRejectedValue(coreError(404));

        const response = await request(app)
            .post('/auth/force_change_password')
            .send({ token: FIRST_CONNECTION_TOKEN, new_password: 'Updated-456!' });

        expect(response.status).toBe(502);
    });
});

describe('POST /auth/refresh', () => {
    const REFRESH_TOKEN = 'opaque-refresh-token';
    const ROTATED_REFRESH_TOKEN = 'rotated-refresh-token';
    const refreshed = { refresh_token: ROTATED_REFRESH_TOKEN };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('delivers the renewed JWT like login: HttpOnly cookie only', async () => {
        mockedRefreshSession.mockResolvedValue(axiosResponse(refreshed, 200, { authorization: 'Bearer renewed.payload.signature' }));

        const response = await request(app).post('/auth/refresh').send({ refresh_token: REFRESH_TOKEN, role: 'Admin' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'JWT refreshed successfully' });
        expect(response.headers.authorization).toBeUndefined();
        expect(response.headers['access-control-expose-headers']).toBeUndefined();
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=renewed\.payload\.signature;.*HttpOnly/);
        expect(mockedRefreshSession).toHaveBeenCalledWith(REFRESH_TOKEN);
    });

    it('replaces the refreshToken cookie with the token rotated by Core', async () => {
        mockedRefreshSession.mockResolvedValue(axiosResponse(refreshed, 200, { authorization: 'Bearer renewed.payload.signature' }));

        const response = await request(app).post('/auth/refresh').set('Cookie', `refreshToken=${REFRESH_TOKEN}`);

        expect(response.status).toBe(200);
        expect(JSON.stringify(response.body)).not.toContain(ROTATED_REFRESH_TOKEN);
        const refreshCookie = (response.headers['set-cookie'] as unknown as string[]).find((cookie) => cookie.startsWith('refreshToken='));
        expect(refreshCookie).toMatch(/^refreshToken=rotated-refresh-token;.*Path=\/auth;.*HttpOnly/);
    });

    it('returns 502 when Core omits the rotated refresh token', async () => {
        mockedRefreshSession.mockResolvedValue(axiosResponse({} as typeof refreshed, 200, { authorization: 'Bearer renewed.payload.signature' }));

        const response = await request(app).post('/auth/refresh').send({ refresh_token: REFRESH_TOKEN });

        expect(response.status).toBe(502);
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('returns 502 when Core omits the renewed JWT', async () => {
        mockedRefreshSession.mockResolvedValue(axiosResponse(refreshed));

        const response = await request(app).post('/auth/refresh').send({ refresh_token: REFRESH_TOKEN });

        expect(response.status).toBe(502);
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('reads the refresh token from the refreshToken cookie when the body has none', async () => {
        mockedRefreshSession.mockResolvedValue(axiosResponse(refreshed, 200, { authorization: 'Bearer renewed.payload.signature' }));

        const response = await request(app).post('/auth/refresh').set('Cookie', `refreshToken=${REFRESH_TOKEN}`);

        expect(response.status).toBe(200);
        expect(mockedRefreshSession).toHaveBeenCalledWith(REFRESH_TOKEN);
    });

    it('prefers the body refresh token over the cookie', async () => {
        mockedRefreshSession.mockResolvedValue(axiosResponse(refreshed, 200, { authorization: 'Bearer renewed.payload.signature' }));

        await request(app).post('/auth/refresh').set('Cookie', 'refreshToken=cookie-token').send({ refresh_token: REFRESH_TOKEN });

        expect(mockedRefreshSession).toHaveBeenCalledWith(REFRESH_TOKEN);
    });

    it('rejects a request without refresh token in the body nor the cookie with 400', async () => {
        const response = await request(app).post('/auth/refresh').send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Missing refresh token', details: [] } });
        expect(mockedRefreshSession).not.toHaveBeenCalled();
    });

    it.each([
        ['an empty refresh token', { refresh_token: '' }],
        ['a non-string refresh token', { refresh_token: 42 }],
    ])('rejects %s with 400 before calling Core API', async (_label, body) => {
        const response = await request(app).post('/auth/refresh').send(body);

        expect(response.status).toBe(400);
        expect(response.body).toEqual(invalidPayload('Validation failed'));
        expect(mockedRefreshSession).not.toHaveBeenCalled();
    });
});

describe('POST /auth/logout', () => {
    const REFRESH_TOKEN = 'opaque-refresh-token';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        mockedRevokeSession.mockResolvedValue();
        mockedLogoutSession.mockResolvedValue();
        process.env.CORE_API_URL = 'http://core.test';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('revokes the Core session with the Bearer header and clears the cookie', async () => {
        const response = await request(app)
            .post('/auth/logout')
            .set('Authorization', 'Bearer header.payload.signature')
            .send({ refresh_token: REFRESH_TOKEN });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: true });
        expect(mockedRevokeSession).toHaveBeenCalledWith(REFRESH_TOKEN, {
            baseURL: 'http://core.test', timeout: 10_000, headers: { Authorization: 'Bearer header.payload.signature' },
        });
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
    });

    it.each([
        ['the accessToken cookie', (call: request.Test) => call.set('Cookie', 'accessToken=cookie.payload.signature')],
        ['the x-session-token header', (call: request.Test) => call.set('x-session-token', 'cookie.payload.signature')],
        ['another scheme', (call: request.Test) => call.set('Authorization', 'Token cookie.payload.signature')],
    ])('ignores a session sent in %s: only clears the cookies', async (_label, prepare) => {
        const response = await prepare(request(app).post('/auth/logout')).send({ refresh_token: REFRESH_TOKEN });

        expect(response.status).toBe(200);
        expect(response.body.session_revoked).toBe(false);
        expect(mockedRevokeSession).not.toHaveBeenCalled();
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
    });

    it('still clears the cookies, without revoking, when CORE_API_URL is not set', async () => {
        delete process.env.CORE_API_URL;

        const response = await request(app)
            .post('/auth/logout')
            .set('Authorization', 'Bearer header.payload.signature')
            .send({ refresh_token: REFRESH_TOKEN });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: false });
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
        expect(mockedRevokeSession).not.toHaveBeenCalled();
    });

    it('marks every /auth answer as not cacheable', async () => {
        const response = await request(app).post('/auth/logout');

        expect(response.headers['cache-control']).toBe('no-store');
    });

    it('still clears the cookie when Core API fails, without logging the tokens', async () => {
        mockedRevokeSession.mockRejectedValue(new Error('connect ECONNREFUSED'));

        const response = await request(app)
            .post('/auth/logout')
            .set('Authorization', 'Bearer header.payload.signature')
            .send({ refresh_token: REFRESH_TOKEN });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: false });
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
        const logged = JSON.stringify(jest.mocked(console.warn).mock.calls);
        expect(logged).not.toContain(REFRESH_TOKEN);
        expect(logged).not.toContain('header.payload.signature');
    });

    it.each([
        ['no session', (call: request.Test) => call.send({ refresh_token: REFRESH_TOKEN })],
        ['an empty body', (call: request.Test) => call],
    ])('only clears the cookie with %s', async (_label, prepare) => {
        const response = await prepare(request(app).post('/auth/logout'));

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: false });
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
        expect(mockedRevokeSession).not.toHaveBeenCalled();
        expect(mockedLogoutSession).not.toHaveBeenCalled();
    });

    it('revokes the session from the JWT alone when no refresh token is available', async () => {
        const response = await request(app)
            .post('/auth/logout')
            .set('Authorization', 'Bearer header.payload.signature');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: true });
        expect(mockedLogoutSession).toHaveBeenCalledWith({
            baseURL: 'http://core.test', timeout: 10_000, headers: { Authorization: 'Bearer header.payload.signature' },
        });
        expect(mockedRevokeSession).not.toHaveBeenCalled();
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
        expect(response.headers['set-cookie'][1]).toMatch(/^refreshToken=;/);
    });

    it('keeps the refresh-token revocation when the refreshToken cookie is present', async () => {
        const response = await request(app)
            .post('/auth/logout')
            .set('Authorization', 'Bearer header.payload.signature')
            .set('Cookie', `refreshToken=${REFRESH_TOKEN}`);

        expect(response.body.session_revoked).toBe(true);
        expect(mockedRevokeSession).toHaveBeenCalledWith(REFRESH_TOKEN, expect.anything());
        expect(mockedLogoutSession).not.toHaveBeenCalled();
    });

    it('still clears the cookies when Core API refuses the JWT-only logout', async () => {
        mockedLogoutSession.mockRejectedValue(new Error('Request failed with status code 401'));

        const response = await request(app)
            .post('/auth/logout')
            .set('Authorization', 'Bearer header.payload.signature');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: false });
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
        expect(JSON.stringify(jest.mocked(console.warn).mock.calls)).not.toContain('header.payload.signature');
    });
});

describe('authentication rate limiting', () => {
    const limitedApp = (options: Partial<Parameters<typeof createAuthRateLimiters>[0]> = {}) => {
        const limited = express();
        limited.use(express.json());
        // Clients are told apart by X-Forwarded-For, as behind the ingress.
        limited.set('trust proxy', true);
        limited.use('/auth', createAuthRouter(createAuthRateLimiters({
            enabled: true, windowMs: 60_000, accountMax: 2, ipMax: 4, perClientIp: true, ...options,
        })));
        limited.use(errorHandler({ onError: () => undefined }));
        return limited;
    };
    // Missing password: a 400 that counts as a failed attempt without any Core call.
    const failedLogin = (target: express.Express, email: string, clientIp = '203.0.113.1') => request(target)
        .post('/auth/login')
        .set('X-Forwarded-For', clientIp)
        .send({ email, device_info: 'test' });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('answers 429 with Retry-After once an account exceeds its failed logins', async () => {
        const target = limitedApp();

        expect((await failedLogin(target, 'alice@example.com')).status).toBe(400);
        expect((await failedLogin(target, 'ALICE@example.com ')).status).toBe(400);
        const blocked = await request(target).post('/auth/login').set('X-Forwarded-For', '203.0.113.1').send({ ...credentials, email: 'alice@example.com' });

        expect(blocked.status).toBe(429);
        expect(blocked.body).toEqual({ error: { code: 'TOO_MANY_REQUESTS', message: RATE_LIMIT_MESSAGE, details: [] } });
        expect(blocked.headers['retry-after']).toMatch(/^\d+$/);
        expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
        expect(blocked.headers.ratelimit).toBeDefined();
        expect(mockedLoginUser).not.toHaveBeenCalled();
        // Another account from the same client is still allowed.
        expect((await failedLogin(target, 'bob@example.com')).status).toBe(400);
    });

    // The production budget (MAIR-474): the limiters built from the default environment, behind a trusted proxy.
    it('enforces the production budget: 10 failed logins per account, 100 failed attempts per client IP', async () => {
        const production = express();
        production.use(express.json());
        production.set('trust proxy', true);
        production.use('/auth', createAuthRouter(createAuthRateLimiters(authRateLimitOptionsFromEnv({ TRUST_PROXY: 'true' }))));
        production.use(errorHandler({ onError: () => undefined }));
        const retryAfter = (response: request.Response) => {
            // A usable wait: whole seconds, at least 1, at most the 15-minute window.
            expect(response.headers['retry-after']).toMatch(/^\d+$/);
            const seconds = Number(response.headers['retry-after']);
            expect(seconds).toBeGreaterThanOrEqual(1);
            expect(seconds).toBeLessThanOrEqual(900);
        };

        for (let attempt = 1; attempt <= 10; attempt += 1) {
            expect((await failedLogin(production, 'budget@example.com')).status).toBe(400);
        }
        const accountBlocked = await failedLogin(production, 'budget@example.com', '198.51.100.20');
        expect(accountBlocked.status).toBe(429);
        retryAfter(accountBlocked);

        // 89 more failures from the first client on other accounts: 99 in all for that IP, the 100th passes, the 101st is refused.
        for (let attempt = 1; attempt <= 89; attempt += 1) {
            expect((await failedLogin(production, `ip-${attempt}@example.com`)).status).toBe(400);
        }
        expect((await failedLogin(production, 'ip-last@example.com')).status).toBe(400);
        const ipBlocked = await failedLogin(production, 'fresh@example.com');
        expect(ipBlocked.status).toBe(429);
        retryAfter(ipBlocked);
        // Another client is not affected.
        expect((await failedLogin(production, 'fresh@example.com', '198.51.100.21')).status).toBe(400);
        expect(mockedLoginUser).not.toHaveBeenCalled();
    });

    it('limits failed attempts per client IP across accounts and routes', async () => {
        const target = limitedApp({ accountMax: 100, ipMax: 3 });

        await failedLogin(target, 'a@example.com');
        await failedLogin(target, 'b@example.com');
        await request(target).post('/auth/force_change_password').set('X-Forwarded-For', '203.0.113.1').send({ token: '' });

        const login = await failedLogin(target, 'c@example.com');
        const forceChange = await request(target)
            .post('/auth/force_change_password')
            .set('X-Forwarded-For', '203.0.113.1')
            .send({ token: FIRST_CONNECTION_TOKEN, new_password: 'Updated-456!' });

        expect(login.status).toBe(429);
        expect(forceChange.status).toBe(429);
        expect(mockedForceChangePassword).not.toHaveBeenCalled();
    });

    it('does not count successful sign-ins', async () => {
        mockedLoginUser.mockResolvedValue(axiosResponse(loginResponse(), 200, { authorization: 'Bearer header.payload.signature' }));
        const target = limitedApp({ accountMax: 1, ipMax: 1 });

        for (let attempt = 0; attempt < 3; attempt += 1) {
            expect((await request(target).post('/auth/login').send(credentials)).status).toBe(200);
        }
    });

    it('does not count a first sign-in that asks for a password change (412)', async () => {
        // Core answers 412 as an error; the route relays it with the one-time token.
        mockedLoginUser.mockRejectedValue(coreError(412, { token: FIRST_CONNECTION_TOKEN }));
        const target = limitedApp({ accountMax: 1, ipMax: 1 });

        for (let attempt = 0; attempt < 3; attempt += 1) {
            expect((await request(target).post('/auth/login').send(credentials)).status).toBe(412);
        }
    });

    it('never limits when disabled', async () => {
        const target = limitedApp({ enabled: false, accountMax: 1, ipMax: 1 });

        for (let attempt = 0; attempt < 4; attempt += 1) {
            expect((await failedLogin(target, 'alice@example.com')).status).toBe(400);
        }
    });

    const failedRefresh = (target: express.Express, refreshToken: string, clientIp = '203.0.113.1') => {
        mockedRefreshSession.mockRejectedValue(coreError(401, 'Session not found'));
        return request(target).post('/auth/refresh').set('X-Forwarded-For', clientIp).send({ refresh_token: refreshToken });
    };

    it('limits the failed refreshes of one refresh token, whatever the client IP, without TRUST_PROXY', async () => {
        const target = limitedApp({ perClientIp: false, accountMax: 2, ipMax: 1 });

        expect((await failedRefresh(target, 'stolen-token', '203.0.113.1')).status).toBe(401);
        expect((await failedRefresh(target, 'stolen-token', '198.51.100.7')).status).toBe(401);
        const blocked = await failedRefresh(target, 'stolen-token', '192.0.2.44');

        expect(blocked.status).toBe(429);
        expect(blocked.body).toEqual({ error: { code: 'TOO_MANY_REQUESTS', message: RATE_LIMIT_MESSAGE, details: [] } });
        expect(blocked.headers['retry-after']).toBeDefined();
        // No per-IP lockout: another token from the same (shared) IP still reaches Core.
        expect((await failedRefresh(target, 'other-token', '192.0.2.44')).status).toBe(401);
    });

    it('also limits failed refreshes per client IP when TRUST_PROXY is set', async () => {
        const target = limitedApp({ accountMax: 100, ipMax: 2 });

        await failedRefresh(target, 'token-1');
        await failedLogin(target, 'alice@example.com');

        expect((await failedRefresh(target, 'token-2')).status).toBe(429);
        expect((await failedRefresh(target, 'token-3', '198.51.100.7')).status).toBe(401);
    });

    it('does not count successful refreshes', async () => {
        mockedRefreshSession.mockResolvedValue(axiosResponse({ refresh_token: 'rotated-token' }, 200, { authorization: 'Bearer renewed.payload.signature' }));
        const target = limitedApp({ accountMax: 1, ipMax: 1 });

        for (let attempt = 0; attempt < 3; attempt += 1) {
            expect((await request(target).post('/auth/refresh').send({ refresh_token: 'valid-token' })).status).toBe(200);
        }
    });

    it('keys the per-IP limit on the client IP when TRUST_PROXY is set', async () => {
        const target = limitedApp({ accountMax: 100, ipMax: 2 });

        await failedLogin(target, 'alice@example.com', '203.0.113.1');
        await failedLogin(target, 'bob@example.com', '203.0.113.1');

        // The first client is blocked, another client is not.
        expect((await failedLogin(target, 'carol@example.com', '203.0.113.1')).status).toBe(429);
        expect((await failedLogin(target, 'alice@example.com', '198.51.100.7')).status).toBe(400);
    });

    it('limits the failed logins of one e-mail across client IPs when TRUST_PROXY is set', async () => {
        const target = limitedApp({ accountMax: 2, ipMax: 100 });

        await failedLogin(target, 'alice@example.com', '203.0.113.1');
        await failedLogin(target, 'alice@example.com', '198.51.100.7');

        expect((await failedLogin(target, 'Alice@example.com', '192.0.2.44')).status).toBe(429);
        expect((await failedLogin(target, 'bob@example.com', '192.0.2.44')).status).toBe(400);
    });

    it('limits the failed refreshes of one refresh token across client IPs when TRUST_PROXY is set', async () => {
        const target = limitedApp({ accountMax: 2, ipMax: 100 });

        expect((await failedRefresh(target, 'stolen-token', '203.0.113.1')).status).toBe(401);
        expect((await failedRefresh(target, 'stolen-token', '198.51.100.7')).status).toBe(401);

        expect((await failedRefresh(target, 'stolen-token', '192.0.2.44')).status).toBe(429);
        expect((await failedRefresh(target, 'other-token', '192.0.2.44')).status).toBe(401);
    });

    describe('with no proxy information at all (Express trusts no proxy, no X-Forwarded-For)', () => {
        const directApp = () => {
            const direct = express();
            direct.use(express.json());
            direct.use('/auth', createAuthRouter(createAuthRateLimiters({
                enabled: true, windowMs: 60_000, accountMax: 2, ipMax: 1, perClientIp: false,
            })));
            direct.use(errorHandler({ onError: () => undefined }));
            return direct;
        };

        it('still limits the failed logins of one e-mail', async () => {
            const target = directApp();
            const attempt = (email: string) => request(target).post('/auth/login').send({ email, device_info: 'test' });

            await attempt('alice@example.com');
            await attempt('alice@example.com');

            expect((await attempt('alice@example.com')).status).toBe(429);
            expect((await attempt('bob@example.com')).status).toBe(400);
        });

        it('still limits the failed refreshes of one refresh token', async () => {
            const target = directApp();
            mockedRefreshSession.mockRejectedValue(coreError(401, 'Session not found'));
            const attempt = (token: string) => request(target).post('/auth/refresh').send({ refresh_token: token });

            await attempt('stolen-token');
            await attempt('stolen-token');

            expect((await attempt('stolen-token')).status).toBe(429);
            expect((await attempt('other-token')).status).toBe(401);
        });
    });

    describe('with TRUST_PROXY but no X-Forwarded-For (a front calling server side, e.g. the Login pod)', () => {
        // Every user then shares the front pod IP: keying on it would be a global lockout (MAIR-397).
        const fromFrontPod = (target: express.Express, email: string) => request(target)
            .post('/auth/login')
            .send({ email, device_info: 'test' });

        it('skips the per-IP limit, so failed logins of many accounts never lock the other users out', async () => {
            const target = limitedApp({ accountMax: 100, ipMax: 2 });

            for (const email of ['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com']) {
                expect((await fromFrontPod(target, email)).status).toBe(400);
            }
            for (let attempt = 0; attempt < 3; attempt += 1) {
                expect((await request(target).post('/auth/force_change_password').send({ token: '' })).status).toBe(400);
            }
            mockedRefreshSession.mockRejectedValue(coreError(401, 'Session not found'));
            for (const token of ['token-1', 'token-2', 'token-3']) {
                expect((await request(target).post('/auth/refresh').send({ refresh_token: token })).status).toBe(401);
            }
            mockedLoginUser.mockResolvedValue(axiosResponse(loginResponse(), 200, { authorization: 'Bearer header.payload.signature' }));
            expect((await request(target).post('/auth/login').send(credentials)).status).toBe(200);
        });

        it('still limits the failed logins of one e-mail', async () => {
            const target = limitedApp({ accountMax: 2, ipMax: 100 });

            await fromFrontPod(target, 'alice@example.com');
            await fromFrontPod(target, 'alice@example.com');

            expect((await fromFrontPod(target, 'Alice@example.com')).status).toBe(429);
            expect((await fromFrontPod(target, 'bob@example.com')).status).toBe(400);
        });

        it('keeps the per-IP limit for the requests that carry X-Forwarded-For', async () => {
            const target = limitedApp({ accountMax: 100, ipMax: 2 });

            await fromFrontPod(target, 'a@example.com');
            await fromFrontPod(target, 'b@example.com');
            await failedLogin(target, 'c@example.com');
            await failedLogin(target, 'd@example.com');

            expect((await failedLogin(target, 'e@example.com')).status).toBe(429);
            expect((await fromFrontPod(target, 'f@example.com')).status).toBe(400);
        });
    });

    describe('without TRUST_PROXY (every client shares the front pod IP)', () => {
        const sharedIpApp = () => limitedApp({ perClientIp: false, accountMax: 2, ipMax: 1 });

        it('does not apply any per-IP limit, so one attacker cannot lock every user out', async () => {
            const target = sharedIpApp();

            for (const email of ['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com']) {
                expect((await failedLogin(target, email)).status).toBe(400);
            }
            for (let attempt = 0; attempt < 3; attempt += 1) {
                expect((await request(target).post('/auth/force_change_password').send({ token: '' })).status).toBe(400);
            }
        });

        it('still limits the failed logins of one e-mail, whatever the client IP', async () => {
            const target = sharedIpApp();

            await failedLogin(target, 'alice@example.com', '203.0.113.1');
            await failedLogin(target, 'alice@example.com', '198.51.100.7');

            expect((await failedLogin(target, 'Alice@example.com', '192.0.2.44')).status).toBe(429);
            expect((await failedLogin(target, 'bob@example.com', '192.0.2.44')).status).toBe(400);
        });

        it('logs a single startup warning that per-IP limiting is disabled', () => {
            jest.isolateModules(() => {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const isolated = require('../src/middleware/rateLimit') as typeof import('../src/middleware/rateLimit');
                const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
                const base = { windowMs: 60_000, accountMax: 10, ipMax: 100 };

                isolated.createAuthRateLimiters({ ...base, enabled: true, perClientIp: true });
                isolated.createAuthRateLimiters({ ...base, enabled: false, perClientIp: false });
                expect(warn).not.toHaveBeenCalled();

                isolated.createAuthRateLimiters({ ...base, enabled: true, perClientIp: false });
                isolated.createAuthRateLimiters({ ...base, enabled: true, perClientIp: false });
                expect(warn).toHaveBeenCalledTimes(1);
                expect(warn.mock.calls[0][0]).toContain('TRUST_PROXY is not set');
                warn.mockRestore();
            });
        });
    });

    it('reads its settings from the environment with safe defaults', () => {
        expect(authRateLimitOptionsFromEnv({})).toEqual({ enabled: true, windowMs: 900_000, accountMax: 10, ipMax: 100, perClientIp: false });
        expect(authRateLimitOptionsFromEnv({
            AUTH_RATE_LIMIT_ENABLED: 'false', AUTH_RATE_LIMIT_WINDOW_MS: '60000', AUTH_RATE_LIMIT_MAX: '5', AUTH_RATE_LIMIT_IP_MAX: '50', TRUST_PROXY: '1',
        })).toEqual({ enabled: false, windowMs: 60_000, accountMax: 5, ipMax: 50, perClientIp: true });
        expect(authRateLimitOptionsFromEnv({ AUTH_RATE_LIMIT_MAX: '0', AUTH_RATE_LIMIT_IP_MAX: 'abc', TRUST_PROXY: 'false' }))
            .toEqual({ enabled: true, windowMs: 900_000, accountMax: 10, ipMax: 100, perClientIp: false });
    });
});

describe('POST /auth/keycloak', () => {
    const keycloakLogin = {
        code: '7c1e0f5a-2b8d-4f3e-9a61-d4c2b7e8f901.3b5d9e2a-6f14-4c8b-a7d0-1e9f2c4b6a83',
        redirect_uri: 'https://login.mairie360.fr/auth/callback',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        nonce: 'n-0S6_WzA2Mj',
        device_info: 'Firefox',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('opens the same session as the password login: HttpOnly cookies only', async () => {
        mockedKeycloakLogin.mockResolvedValue(axiosResponse(loginResponse(), 200, { authorization: 'Bearer header.payload.signature' }));

        const response = await request(app).post('/auth/keycloak').send(keycloakLogin);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged in successfully' });
        expect(response.headers.authorization).toBeUndefined();
        expect(response.headers['set-cookie'][0]).toContain('accessToken=header.payload.signature');
        expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
        expect(response.headers['set-cookie'][1]).toMatch(/^refreshToken=.*Path=\/auth;.*HttpOnly/);
        expect(mockedKeycloakLogin).toHaveBeenCalledWith(keycloakLogin);
    });

    it('accepts a request without PKCE verifier nor nonce and strips undeclared fields', async () => {
        mockedKeycloakLogin.mockResolvedValue(axiosResponse(loginResponse(), 200, { authorization: 'Bearer header.payload.signature' }));
        const { code, redirect_uri, device_info } = keycloakLogin;

        const response = await request(app).post('/auth/keycloak').send({ code, redirect_uri, device_info, user_id: 1 });

        expect(response.status).toBe(200);
        expect(mockedKeycloakLogin).toHaveBeenCalledWith({ code, redirect_uri, device_info });
    });

    it.each([
        ['no code', { ...keycloakLogin, code: '' }],
        ['an invalid redirect URI', { ...keycloakLogin, redirect_uri: 'not a uri' }],
        ['no device info', { code: keycloakLogin.code, redirect_uri: keycloakLogin.redirect_uri }],
    ])('rejects a payload with %s without calling Core API', async (_case, body) => {
        const response = await request(app).post('/auth/keycloak').send(body);

        expect(response.status).toBe(400);
        expect(response.body).toEqual(invalidPayload('Validation failed'));
        expect(mockedKeycloakLogin).not.toHaveBeenCalled();
    });

    it('returns 502 when the Core omits the Authorization Bearer header', async () => {
        mockedKeycloakLogin.mockResolvedValue(axiosResponse(loginResponse()));

        const response = await request(app).post('/auth/keycloak').send(keycloakLogin);

        expect(response.status).toBe(502);
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('keeps the 503 of an instance without Keycloak so the front can fall back to the password login', async () => {
        mockedKeycloakLogin.mockRejectedValue(coreError(503, 'Keycloak sign-in is not configured.'));

        const response = await request(app).post('/auth/keycloak').send(keycloakLogin);

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Keycloak sign-in is not configured', details: [] } });
    });

    it.each([
        [401, 'UNAUTHORIZED'],
        [403, 'FORBIDDEN'],
    ])('keeps a declared Core %i without relaying the Core message', async (status, code) => {
        mockedKeycloakLogin.mockRejectedValue(coreError(status, 'No Mairie 360 account matches this Keycloak e-mail address.'));

        const response = await request(app).post('/auth/keycloak').send(keycloakLogin);

        expect(response.status).toBe(status);
        expect(response.body.error.code).toBe(code);
        expect(JSON.stringify(response.body)).not.toContain('Keycloak e-mail');
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it.each([404, 500])('turns a Core %i into a 502', async (status) => {
        mockedKeycloakLogin.mockRejectedValue(coreError(status));

        const response = await request(app).post('/auth/keycloak').send(keycloakLogin);

        expect(response.status).toBe(502);
        expect(response.body.error.code).toBe('BAD_GATEWAY');
    });
});

describe('POST /auth/logout', () => {
    const KEYCLOAK_ENV = ['KEYCLOAK_REALM_URL', 'KEYCLOAK_CLIENT_ID', 'KEYCLOAK_POST_LOGOUT_REDIRECT_URI'] as const;
    const END_SESSION = 'https://auth.mairie360.fr/realms/mairie360/protocol/openid-connect/logout';

    beforeEach(() => {
        for (const name of KEYCLOAK_ENV) delete process.env[name];
    });

    afterAll(() => {
        for (const name of KEYCLOAK_ENV) delete process.env[name];
    });

    it('clears the accessToken cookie and stops there when Keycloak is not configured', async () => {
        const response = await request(app).post('/auth/logout');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: false });
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
    });

    it('returns the Keycloak end-session URL so the browser closes the single sign-on session', async () => {
        process.env.KEYCLOAK_REALM_URL = 'https://auth.mairie360.fr/realms/mairie360/';
        process.env.KEYCLOAK_CLIENT_ID = 'mairie360';
        process.env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI = 'https://login.mairie360.fr/';

        const response = await request(app).post('/auth/logout');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Logged out successfully');
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
        const logoutUrl = new URL(response.body.logout_url);
        expect(`${logoutUrl.origin}${logoutUrl.pathname}`).toBe(END_SESSION);
        expect(logoutUrl.searchParams.get('client_id')).toBe('mairie360');
        expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe('https://login.mairie360.fr/');
        expect(logoutUrl.searchParams.has('id_token_hint')).toBe(false);
    });

    it('lets the front choose where Keycloak sends the browser afterwards', async () => {
        process.env.KEYCLOAK_REALM_URL = 'https://auth.mairie360.fr/realms/mairie360';
        process.env.KEYCLOAK_CLIENT_ID = 'mairie360';
        process.env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI = 'https://login.mairie360.fr/';

        const response = await request(app)
            .post('/auth/logout')
            .send({ post_logout_redirect_uri: 'https://projects.mairie360.fr/login', ignored: true });

        expect(response.status).toBe(200);
        expect(new URL(response.body.logout_url).searchParams.get('post_logout_redirect_uri'))
            .toBe('https://projects.mairie360.fr/login');
    });

    it('omits post_logout_redirect_uri when neither the front nor the environment provides one', async () => {
        process.env.KEYCLOAK_REALM_URL = 'https://auth.mairie360.fr/realms/mairie360';
        process.env.KEYCLOAK_CLIENT_ID = 'mairie360';

        const response = await request(app).post('/auth/logout');

        expect(response.status).toBe(200);
        expect(response.body.logout_url).toBe(`${END_SESSION}?client_id=mairie360`);
    });

    it('rejects a post_logout_redirect_uri that is not a URL without clearing the cookie', async () => {
        process.env.KEYCLOAK_REALM_URL = 'https://auth.mairie360.fr/realms/mairie360';
        process.env.KEYCLOAK_CLIENT_ID = 'mairie360';

        const response = await request(app).post('/auth/logout').send({ post_logout_redirect_uri: 'not a url' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual(invalidPayload('Validation failed'));
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('keeps the plain logout when only one of the two Keycloak variables is set', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        process.env.KEYCLOAK_REALM_URL = 'https://auth.mairie360.fr/realms/mairie360';

        const response = await request(app).post('/auth/logout');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: false });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('KEYCLOAK_REALM_URL and KEYCLOAK_CLIENT_ID'));
        warn.mockRestore();
    });
});
