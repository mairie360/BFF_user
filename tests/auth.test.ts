import { AxiosError, AxiosHeaders } from 'axios';
import express from 'express';
import request from 'supertest';
import type { LoginView } from '@mairie360/core-api-openapi/model';
import authRouter from '../src/routes/auth';
import { forceChangeUserPassword, handleUnknownError, keycloakLoginUser, loginUser } from '../src/routes/core_helpers';
import { axiosResponse, loginResponse } from './support/core-fixtures';

jest.mock('../src/routes/core_helpers', () => ({
    forceChangeUserPassword: jest.fn(),
    handleUnknownError: jest.fn(),
    isLoginResponseView: jest.fn((value: unknown) => (
        typeof value === 'object'
        && value !== null
        && 'refresh_token' in value
    )),
    keycloakLoginUser: jest.fn(),
    loginUser: jest.fn(),
    registerUser: jest.fn(),
}));

const mockedLoginUser = jest.mocked(loginUser);
const mockedForceChangePassword = jest.mocked(forceChangeUserPassword);
const mockedKeycloakLogin = jest.mocked(keycloakLoginUser);
const mockedHandleUnknownError = jest.mocked(handleUnknownError);

/** Jeton de première connexion : ForceChangePasswordView.token doit être un UUID. */
const FIRST_CONNECTION_TOKEN = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const credentials: LoginView = { email: 'user@example.com', password: 'password', device_info: 'test' };

const app = express();
app.use(express.json());
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

describe('POST /auth/keycloak', () => {
    const keycloakLogin = {
        code: '7c1e0f5a-2b8d-4f3e-9a61-d4c2b7e8f901.3b5d9e2a-6f14-4c8b-a7d0-1e9f2c4b6a83',
        redirect_uri: 'https://login.mairie360.fr/auth/callback',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        nonce: 'n-0S6_WzA2Mj',
        device_info: 'Firefox',
    };

    const coreError = (status: number, message: string) => new AxiosError(message, undefined, undefined, undefined, {
        data: message, status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('opens the same session as the password login: Bearer header and accessToken cookie', async () => {
        mockedKeycloakLogin.mockResolvedValue(axiosResponse(loginResponse(), 200, { authorization: 'Bearer header.payload.signature' }));

        const response = await request(app).post('/auth/keycloak').send(keycloakLogin);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(loginResponse());
        expect(response.headers.authorization).toBe('Bearer header.payload.signature');
        expect(response.headers['access-control-expose-headers']).toBe('Authorization');
        expect(response.headers['set-cookie'][0]).toContain('accessToken=header.payload.signature');
        expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
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
        expect(response.body).toEqual({ message: 'Invalid Keycloak login payload' });
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
        expect(response.body).toEqual({ message: 'Keycloak sign-in is not configured' });
        expect(mockedHandleUnknownError).not.toHaveBeenCalled();
    });

    it('delegates the other Core errors (401, 403, 502...) to the shared error handler', async () => {
        const error = coreError(403, 'No Mairie 360 account matches this Keycloak e-mail address.');
        mockedKeycloakLogin.mockRejectedValue(error);
        mockedHandleUnknownError.mockImplementation((res) => res.status(403).json({ message: 'forbidden' }));

        const response = await request(app).post('/auth/keycloak').send(keycloakLogin);

        expect(response.status).toBe(403);
        expect(mockedHandleUnknownError).toHaveBeenCalledWith(expect.anything(), error);
        expect(response.headers['set-cookie']).toBeUndefined();
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
        expect(response.body).toEqual({ message: 'Logged out successfully' });
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
        expect(response.body).toEqual({ message: 'Invalid logout payload' });
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('keeps the plain logout when only one of the two Keycloak variables is set', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        process.env.KEYCLOAK_REALM_URL = 'https://auth.mairie360.fr/realms/mairie360';

        const response = await request(app).post('/auth/logout');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged out successfully' });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('KEYCLOAK_REALM_URL and KEYCLOAK_CLIENT_ID'));
        warn.mockRestore();
    });
});
