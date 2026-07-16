import express from 'express';
import request from 'supertest';
import authRouter from '../src/routes/auth';
import { forceChangeUserPassword, loginUser } from '../src/routes/core_helpers';
import {
    consumeFirstConnectionToken,
    persistFirstConnectionPassword,
    resolveFirstConnectionUserId,
} from '../src/repositories/firstConnectionRepository';

jest.mock('../src/routes/core_helpers', () => ({
    forceChangeUserPassword: jest.fn(),
    handleUnknownError: jest.fn(),
    isLoginResponseView: jest.fn((value: unknown) => (
        typeof value === 'object'
        && value !== null
        && 'refresh_token' in value
    )),
    loginUser: jest.fn(),
    registerUser: jest.fn(),
}));

jest.mock('../src/repositories/firstConnectionRepository', () => ({
    consumeFirstConnectionToken: jest.fn(),
    persistFirstConnectionPassword: jest.fn(),
    resolveFirstConnectionUserId: jest.fn(),
}));

const mockedLoginUser = jest.mocked(loginUser);
const mockedForceChangePassword = jest.mocked(forceChangeUserPassword);
const mockedConsumeToken = jest.mocked(consumeFirstConnectionToken);
const mockedPersistPassword = jest.mocked(persistFirstConnectionPassword);
const mockedResolveUserId = jest.mocked(resolveFirstConnectionUserId);

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

describe('POST /auth/login', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('transmits the Core JWT as a Bearer header and accessToken cookie', async () => {
        mockedLoginUser.mockResolvedValue({
            data: { refresh_token: 'opaque-refresh-token' },
            headers: { authorization: 'Bearer header.payload.signature' },
            status: 200,
        } as never);

        const response = await request(app)
            .post('/auth/login')
            .send({ email: 'user@example.com', password: 'password', device_info: 'test' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ refresh_token: 'opaque-refresh-token' });
        expect(response.headers.authorization).toBe('Bearer header.payload.signature');
        expect(response.headers['access-control-expose-headers']).toBe('Authorization');
        expect(response.headers['set-cookie'][0]).toContain('accessToken=header.payload.signature');
        expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    });

    it('returns 502 when the Core omits the Authorization Bearer header', async () => {
        mockedLoginUser.mockResolvedValue({
            data: { refresh_token: 'opaque-refresh-token' },
            headers: {},
            status: 200,
        } as never);

        const response = await request(app)
            .post('/auth/login')
            .send({ email: 'user@example.com', password: 'password', device_info: 'test' });

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
        mockedResolveUserId.mockResolvedValue(42);
        mockedForceChangePassword.mockResolvedValue();
        mockedPersistPassword.mockResolvedValue();
        mockedConsumeToken.mockResolvedValue();
    });

    it('persists the new password after the Core validates the token', async () => {
        const response = await request(app)
            .post('/auth/force_change_password')
            .send({ token: 'first-connection-token', new_password: 'Updated-456!' });

        expect(response.status).toBe(204);
        expect(mockedResolveUserId).toHaveBeenCalledWith('first-connection-token');
        expect(mockedForceChangePassword).toHaveBeenCalledWith({
            token: 'first-connection-token',
            new_password: 'Updated-456!',
        });
        expect(mockedPersistPassword).toHaveBeenCalledWith(42, 'Updated-456!');
        expect(mockedConsumeToken).toHaveBeenCalledWith('first-connection-token', 42);
        expect(mockedForceChangePassword.mock.invocationCallOrder[0])
            .toBeLessThan(mockedPersistPassword.mock.invocationCallOrder[0]);
    });

    it('rejects an unknown first-connection token', async () => {
        mockedResolveUserId.mockResolvedValue(null);

        const response = await request(app)
            .post('/auth/force_change_password')
            .send({ token: 'unknown-token', new_password: 'Updated-456!' });

        expect(response.status).toBe(403);
        expect(mockedForceChangePassword).not.toHaveBeenCalled();
        expect(mockedPersistPassword).not.toHaveBeenCalled();
    });
});
