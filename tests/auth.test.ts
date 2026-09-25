import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { LoginView } from '@mairie360/core-api-openapi/model';
import authRouter, { createAuthRouter } from '../src/routes/auth';
import { forceChangeUserPassword, handleUnknownError, loginUser, refreshSession, revokeSession } from '../src/routes/core_helpers';
import {
    authRateLimitOptionsFromEnv,
    createAuthRateLimiters,
    parseTrustProxy,
    RATE_LIMIT_MESSAGE,
} from '../src/middleware/rateLimit';
import { axiosResponse, loginResponse } from './support/core-fixtures';

jest.mock('../src/routes/core_helpers', () => ({
    forceChangeUserPassword: jest.fn(),
    handleUnknownError: jest.fn(),
    isLoginResponseView: jest.fn((value: unknown) => (
        typeof value === 'object'
        && value !== null
        && 'refresh_token' in value
    )),
    loginUser: jest.fn(),
    refreshSession: jest.fn(),
    revokeSession: jest.fn(),
}));

const mockedLoginUser = jest.mocked(loginUser);
const mockedForceChangePassword = jest.mocked(forceChangeUserPassword);
const mockedRevokeSession = jest.mocked(revokeSession);
const mockedRefreshSession = jest.mocked(refreshSession);

/** Jeton de première connexion : ForceChangePasswordView.token doit être un UUID. */
const FIRST_CONNECTION_TOKEN = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const credentials: LoginView = { email: 'user@example.com', password: 'password', device_info: 'test' };

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRouter);

describe('POST /auth/login', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('transmits the Core JWT as a Bearer header and accessToken cookie', async () => {
        mockedLoginUser.mockResolvedValue(axiosResponse(loginResponse(), 200, { authorization: 'Bearer header.payload.signature' }));

        const response = await request(app).post('/auth/login').send(credentials);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(loginResponse());
        expect(response.headers.authorization).toBe('Bearer header.payload.signature');
        expect(response.headers['access-control-expose-headers']).toBe('Authorization');
        expect(response.headers['set-cookie'][0]).toContain('accessToken=header.payload.signature');
        expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
        expect(mockedLoginUser).toHaveBeenCalledWith(credentials);
    });

    it('returns 502 when the Core omits the Authorization Bearer header', async () => {
        mockedLoginUser.mockResolvedValue(axiosResponse(loginResponse()));

        const response = await request(app).post('/auth/login').send(credentials);

        expect(response.status).toBe(502);
        expect(response.body).toEqual({
            message: 'Core API did not return a Bearer token in the Authorization header',
        });
        expect(response.headers.authorization).toBeUndefined();
        expect(response.headers['set-cookie']).toBeUndefined();
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
        expect(mockedForceChangePassword).not.toHaveBeenCalled();
    });
});

describe('POST /auth/refresh', () => {
    const REFRESH_TOKEN = 'opaque-refresh-token';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the renewed JWT like login: Authorization header and httpOnly cookie', async () => {
        mockedRefreshSession.mockResolvedValue(axiosResponse('JWT refreshed successfully', 200, { authorization: 'Bearer renewed.payload.signature' }));

        const response = await request(app).post('/auth/refresh').send({ refresh_token: REFRESH_TOKEN, role: 'Admin' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'JWT refreshed successfully' });
        expect(response.headers.authorization).toBe('Bearer renewed.payload.signature');
        expect(response.headers['access-control-expose-headers']).toBe('Authorization');
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=renewed\.payload\.signature;.*HttpOnly/);
        expect(mockedRefreshSession).toHaveBeenCalledWith(REFRESH_TOKEN);
    });

    it('returns 502 when Core omits the renewed JWT', async () => {
        mockedRefreshSession.mockResolvedValue(axiosResponse('JWT refreshed successfully'));

        const response = await request(app).post('/auth/refresh').send({ refresh_token: REFRESH_TOKEN });

        expect(response.status).toBe(502);
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it.each([
        ['no refresh token', {}],
        ['an empty refresh token', { refresh_token: '' }],
        ['a non-string refresh token', { refresh_token: 42 }],
    ])('rejects %s with 400 before calling Core API', async (_label, body) => {
        const response = await request(app).post('/auth/refresh').send(body);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: 'Invalid refresh payload' });
        expect(mockedRefreshSession).not.toHaveBeenCalled();
    });
});

describe('POST /auth/logout', () => {
    const REFRESH_TOKEN = 'opaque-refresh-token';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        mockedRevokeSession.mockResolvedValue();
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
        expect(mockedRevokeSession).toHaveBeenCalledWith(REFRESH_TOKEN, 'Bearer header.payload.signature');
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
    });

    it('reads the session from the accessToken cookie', async () => {
        const response = await request(app)
            .post('/auth/logout')
            .set('Cookie', 'accessToken=cookie.payload.signature')
            .send({ refresh_token: REFRESH_TOKEN });

        expect(response.body.session_revoked).toBe(true);
        expect(mockedRevokeSession).toHaveBeenCalledWith(REFRESH_TOKEN, 'Bearer cookie.payload.signature');
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
        ['no refresh token', (call: request.Test) => call.set('Authorization', 'Bearer header.payload.signature')],
        ['no session', (call: request.Test) => call.send({ refresh_token: REFRESH_TOKEN })],
        ['an empty body', (call: request.Test) => call],
    ])('only clears the cookie with %s', async (_label, prepare) => {
        const response = await prepare(request(app).post('/auth/logout'));

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged out successfully', session_revoked: false });
        expect(response.headers['set-cookie'][0]).toMatch(/^accessToken=;/);
        expect(mockedRevokeSession).not.toHaveBeenCalled();
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
        expect(blocked.body).toEqual({ message: RATE_LIMIT_MESSAGE });
        expect(blocked.headers['retry-after']).toBeDefined();
        expect(blocked.headers.ratelimit).toBeDefined();
        expect(mockedLoginUser).not.toHaveBeenCalled();
        // Another account from the same client is still allowed.
        expect((await failedLogin(target, 'bob@example.com')).status).toBe(400);
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
        // Core answers 412 as an error, relayed by handleUnknownError.
        mockedLoginUser.mockRejectedValue(new Error('412'));
        jest.mocked(handleUnknownError).mockImplementation((res) => res.status(412).json({ token: FIRST_CONNECTION_TOKEN }));
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
        mockedRefreshSession.mockRejectedValue(new Error('401'));
        jest.mocked(handleUnknownError).mockImplementation((res) => res.status(401).json({ message: 'Session not found' }));
        return request(target).post('/auth/refresh').set('X-Forwarded-For', clientIp).send({ refresh_token: refreshToken });
    };

    it('limits the failed refreshes of one refresh token, whatever the client IP, without TRUST_PROXY', async () => {
        const target = limitedApp({ perClientIp: false, accountMax: 2, ipMax: 1 });

        expect((await failedRefresh(target, 'stolen-token', '203.0.113.1')).status).toBe(401);
        expect((await failedRefresh(target, 'stolen-token', '198.51.100.7')).status).toBe(401);
        const blocked = await failedRefresh(target, 'stolen-token', '192.0.2.44');

        expect(blocked.status).toBe(429);
        expect(blocked.body).toEqual({ message: RATE_LIMIT_MESSAGE });
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
        mockedRefreshSession.mockResolvedValue(axiosResponse('JWT refreshed successfully', 200, { authorization: 'Bearer renewed.payload.signature' }));
        const target = limitedApp({ accountMax: 1, ipMax: 1 });

        for (let attempt = 0; attempt < 3; attempt += 1) {
            expect((await request(target).post('/auth/refresh').send({ refresh_token: 'valid-token' })).status).toBe(200);
        }
    });

    it('keys the per-IP and per-account limits on the client IP when TRUST_PROXY is set', async () => {
        const target = limitedApp({ accountMax: 2, ipMax: 2 });

        await failedLogin(target, 'alice@example.com', '203.0.113.1');
        await failedLogin(target, 'bob@example.com', '203.0.113.1');

        // The first client is blocked, another client is not, even for the same account.
        expect((await failedLogin(target, 'carol@example.com', '203.0.113.1')).status).toBe(429);
        expect((await failedLogin(target, 'alice@example.com', '198.51.100.7')).status).toBe(400);
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

    it.each([
        [undefined, false],
        ['', false],
        ['false', false],
        ['true', true],
        ['1', 1],
        ['loopback, 10.0.0.0/8', 'loopback, 10.0.0.0/8'],
    ])('parses TRUST_PROXY=%p as %p', (value, expected) => {
        expect(parseTrustProxy(value)).toBe(expected);
    });
});
