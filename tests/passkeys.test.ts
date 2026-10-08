import { errorHandler } from '@mairie360/bffs-lib';
import { AxiosError, AxiosHeaders } from 'axios';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createAuthRouter } from '../src/routes/auth';
import userRouter from '../src/routes/user';
import {
    deleteUserPasskey,
    fetchPasskeys,
    passkeyLoginOptions,
    passkeyLoginUser,
    passkeyRegistrationOptions,
    registerUserPasskey,
} from '../src/routes/core_helpers';
import { createAuthRateLimiters } from '../src/middleware/rateLimit';
import { axiosResponse, loginResponse, sessionToken } from './support/core-fixtures';

// Passkeys (MAIR-505): the BFF relays the WebAuthn documents between the browser and Core API, which
// validates them, and only types the envelope. Core is mocked at the helper level, like auth.test.ts.
jest.mock('../src/routes/core_helpers', () => ({
    deleteUserPasskey: jest.fn(),
    fetchPasskeys: jest.fn(),
    fetchUserAbout: jest.fn(),
    forceChangeUserPassword: jest.fn(),
    isLoginResponseView: jest.fn((value: unknown) => (
        typeof value === 'object'
        && value !== null
        && 'refresh_token' in value
    )),
    keycloakLoginUser: jest.fn(),
    loginUser: jest.fn(),
    logoutSession: jest.fn(),
    passkeyLoginOptions: jest.fn(),
    passkeyLoginUser: jest.fn(),
    passkeyRegistrationOptions: jest.fn(),
    refreshSession: jest.fn(),
    registerUserPasskey: jest.fn(),
    revokeSession: jest.fn(),
}));

const mockedLoginOptions = jest.mocked(passkeyLoginOptions);
const mockedLogin = jest.mocked(passkeyLoginUser);
const mockedRegistrationOptions = jest.mocked(passkeyRegistrationOptions);
const mockedRegister = jest.mocked(registerUserPasskey);
const mockedList = jest.mocked(fetchPasskeys);
const mockedDelete = jest.mocked(deleteUserPasskey);

/** Core API error as the axios client rejects it. */
const coreError = (status: number, data: unknown = 'Core error') => new AxiosError(`Request failed with status code ${status}`, undefined, undefined, undefined, {
    data, status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
});

const CHALLENGE_ID = '2f9a1c74-5b3e-4d21-9c8a-7e6f0b1d4a35';
/** WebAuthn documents are relayed as is: any JSON object Core returns or the browser produces. */
const requestOptions = { publicKey: { challenge: 'xLqpXkT3oF6Q2oFqaX0S5nHyR8yq9b2N7xG4w0a5r1M', rpId: 'mairie360.fr', allowCredentials: [], userVerification: 'required' } };
const assertion = {
    id: 'vJd5R8m2oA7N_3kQ1eF2hWfYbZcTx9L0',
    rawId: 'vJd5R8m2oA7N_3kQ1eF2hWfYbZcTx9L0',
    type: 'public-key',
    response: { authenticatorData: 'SZYN', clientDataJSON: 'eyJ0', signature: 'MEUC', userHandle: null },
    clientExtensionResults: {},
};
const passkeyLogin = { challenge_id: CHALLENGE_ID, credential: assertion, device_info: 'Safari 26 on iPhone' };
const registration = { challenge_id: CHALLENGE_ID, label: 'iPhone de Jean', credential: { ...assertion, response: { attestationObject: 'o2Nm', clientDataJSON: 'eyJ0' } } };
const summary = { id: 12, label: 'iPhone de Jean', created_at: '2026-10-08T09:30:00Z', last_used_at: null };
const SESSION = { Authorization: `Bearer ${sessionToken(1)}` };

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', createAuthRouter(createAuthRateLimiters({ enabled: false, windowMs: 1000, accountMax: 1, ipMax: 1, perClientIp: false })));
app.use('/user', userRouter);
app.use(errorHandler({ onError: () => undefined }));

beforeEach(() => {
    jest.clearAllMocks();
    process.env.CORE_API_URL = 'http://core.test';
});

describe('POST /auth/passkey/options', () => {
    it('relays the ceremony id and the WebAuthn options Core built', async () => {
        mockedLoginOptions.mockResolvedValue(axiosResponse({ challenge_id: CHALLENGE_ID, public_key: requestOptions, extra: 'dropped' }));

        const response = await request(app).post('/auth/passkey/options');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ challenge_id: CHALLENGE_ID, public_key: requestOptions });
        expect(response.headers['cache-control']).toBe('no-store');
    });

    it('keeps the 503 of an instance without passkeys so the front can fall back to the password login', async () => {
        mockedLoginOptions.mockRejectedValue(coreError(503, 'Passkey sign-in is not configured.'));

        const response = await request(app).post('/auth/passkey/options');

        expect(response.status).toBe(503);
        expect(response.body.error.message).toBe('Passkeys are not configured');
    });

    it('answers 502 on any other Core failure, without relaying its body', async () => {
        mockedLoginOptions.mockRejectedValue(coreError(500, 'Internal Redis error.'));

        const response = await request(app).post('/auth/passkey/options');

        expect(response.status).toBe(502);
        expect(JSON.stringify(response.body)).not.toContain('Redis');
    });
});

describe('POST /auth/passkey', () => {
    it('opens the same session as the password login: HttpOnly cookies only', async () => {
        mockedLogin.mockResolvedValue(axiosResponse(loginResponse(), 200, { authorization: 'Bearer header.payload.signature' }));

        const response = await request(app).post('/auth/passkey').send({ ...passkeyLogin, user_id: 1 });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Logged in successfully' });
        expect(response.headers.authorization).toBeUndefined();
        expect(response.headers['set-cookie'][0]).toContain('accessToken=header.payload.signature');
        expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
        expect(response.headers['set-cookie'][1]).toMatch(/^refreshToken=.*Path=\/auth;.*HttpOnly/);
        // Undeclared fields are stripped, the credential is relayed as the browser produced it.
        expect(mockedLogin).toHaveBeenCalledWith(passkeyLogin);
    });

    it.each([
        ['no challenge id', { ...passkeyLogin, challenge_id: '' }],
        ['a credential that is not an object', { ...passkeyLogin, credential: 'not-a-credential' }],
        ['no device info', { challenge_id: CHALLENGE_ID, credential: assertion }],
    ])('rejects a payload with %s without calling Core API', async (_case, body) => {
        const response = await request(app).post('/auth/passkey').send(body);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('BAD_REQUEST');
        expect(mockedLogin).not.toHaveBeenCalled();
    });

    it('relays the 401 of a refused assertion with a generic message', async () => {
        mockedLogin.mockRejectedValue(coreError(401, 'Passkey authentication failed.'));

        const response = await request(app).post('/auth/passkey').send(passkeyLogin);

        expect(response.status).toBe(401);
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('keeps the 503 of an instance without passkeys', async () => {
        mockedLogin.mockRejectedValue(coreError(503, 'Passkey sign-in is not configured.'));

        const response = await request(app).post('/auth/passkey').send(passkeyLogin);

        expect(response.status).toBe(503);
    });

    it('returns 502 when Core omits the Authorization Bearer header', async () => {
        mockedLogin.mockResolvedValue(axiosResponse(loginResponse()));

        const response = await request(app).post('/auth/passkey').send(passkeyLogin);

        expect(response.status).toBe(502);
        expect(response.headers['set-cookie']).toBeUndefined();
    });
});

describe('/user/me/passkeys', () => {
    it.each([
        ['POST /user/me/passkeys/options', () => request(app).post('/user/me/passkeys/options')],
        ['POST /user/me/passkeys', () => request(app).post('/user/me/passkeys').send(registration)],
        ['GET /user/me/passkeys', () => request(app).get('/user/me/passkeys')],
        ['DELETE /user/me/passkeys/12', () => request(app).delete('/user/me/passkeys/12')],
    ])('%s answers 401 without a Bearer session, before any Core call', async (_route, call) => {
        const response = await call();

        expect(response.status).toBe(401);
        expect(mockedRegistrationOptions).not.toHaveBeenCalled();
        expect(mockedRegister).not.toHaveBeenCalled();
        expect(mockedList).not.toHaveBeenCalled();
        expect(mockedDelete).not.toHaveBeenCalled();
    });

    it('opens a registration ceremony with the caller\'s session', async () => {
        mockedRegistrationOptions.mockResolvedValue(axiosResponse({ challenge_id: CHALLENGE_ID, public_key: { publicKey: { rp: { id: 'mairie360.fr' } } } }));

        const response = await request(app).post('/user/me/passkeys/options').set(SESSION);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ challenge_id: CHALLENGE_ID, public_key: { publicKey: { rp: { id: 'mairie360.fr' } } } });
        expect(mockedRegistrationOptions).toHaveBeenCalledTimes(1);
    });

    it('registers a passkey and answers its summary only', async () => {
        mockedRegister.mockResolvedValue(axiosResponse({ ...summary, passkey: { secret: 'never' } }, 201));

        const response = await request(app).post('/user/me/passkeys').set(SESSION).send(registration);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(summary);
        expect(mockedRegister).toHaveBeenCalledWith(registration, expect.anything());
    });

    it.each([
        ['an empty label', { ...registration, label: '' }],
        ['a label over 100 characters', { ...registration, label: 'x'.repeat(101) }],
        ['no credential', { challenge_id: CHALLENGE_ID, label: 'ok' }],
    ])('refuses a registration with %s without calling Core API', async (_case, body) => {
        const response = await request(app).post('/user/me/passkeys').set(SESSION).send(body);

        expect(response.status).toBe(400);
        expect(mockedRegister).not.toHaveBeenCalled();
    });

    it.each([
        [400, 'Unknown or expired registration challenge.'],
        [409, 'This passkey is already registered.'],
    ])('relays the %s of Core with a generic message', async (status, coreMessage) => {
        mockedRegister.mockRejectedValue(coreError(status, coreMessage));

        const response = await request(app).post('/user/me/passkeys').set(SESSION).send(registration);

        expect(response.status).toBe(status);
        expect(JSON.stringify(response.body)).not.toContain(coreMessage);
    });

    it('keeps the 503 of an instance without passkeys on the registration routes', async () => {
        mockedRegistrationOptions.mockRejectedValue(coreError(503, 'Passkeys are not configured.'));
        mockedRegister.mockRejectedValue(coreError(503, 'Passkeys are not configured.'));

        expect((await request(app).post('/user/me/passkeys/options').set(SESSION)).status).toBe(503);
        expect((await request(app).post('/user/me/passkeys').set(SESSION).send(registration)).status).toBe(503);
    });

    it('lists the passkeys with the contract fields only', async () => {
        mockedList.mockResolvedValue({ passkeys: [{ ...summary, last_used_at: '2026-10-08T14:02:11Z', credential_id: 'abcd' } as typeof summary] });

        const response = await request(app).get('/user/me/passkeys').set(SESSION);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ passkeys: [{ ...summary, last_used_at: '2026-10-08T14:02:11Z' }] });
    });

    it('answers 502 when Core lists something that is not a passkey', async () => {
        mockedList.mockResolvedValue({ passkeys: [{ id: 'twelve' } as unknown as typeof summary] });

        const response = await request(app).get('/user/me/passkeys').set(SESSION);

        expect(response.status).toBe(502);
    });

    it('deletes a passkey of the caller', async () => {
        mockedDelete.mockResolvedValue(undefined);

        const response = await request(app).delete('/user/me/passkeys/12').set(SESSION);

        expect(response.status).toBe(204);
        expect(mockedDelete).toHaveBeenCalledWith(12, expect.anything());
    });

    it('refuses an invalid passkey id without calling Core API', async () => {
        const response = await request(app).delete('/user/me/passkeys/twelve').set(SESSION);

        expect(response.status).toBe(400);
        expect(mockedDelete).not.toHaveBeenCalled();
    });
});
