import express from 'express';
import request from 'supertest';
import sessionRouter, { getJwtUserId } from '../src/routes/session';
import { coreClient, coreGroupsClient, coreUsersClient } from '../src/clients/coreClient';

jest.mock('../src/clients/coreClient', () => ({
    coreClient: { get: jest.fn() },
    coreGroupsClient: { getGroups: jest.fn() },
    coreUsersClient: { getMe: jest.fn() },
}));

const mockedGetMe = jest.mocked(coreUsersClient.getMe);
const mockedGetGroups = jest.mocked(coreGroupsClient.getGroups);
const mockedGetUserWithRoles = jest.mocked(coreClient.get);

function tokenFor(userId: number) {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: String(userId) })).toString('base64url');

    return `${header}.${payload}.test`;
}

const app = express();
app.use('/session', sessionRouter);

describe('GET /session/me', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the current user with their groups and assigned roles', async () => {
        mockedGetMe.mockResolvedValue({
            data: {
                first_name: 'Alice',
                last_name: 'Martin',
                email: 'alice@mairie360.fr',
                phone: '+262000000000',
                status: 'active',
            },
        } as never);
        mockedGetGroups.mockResolvedValue({
            data: {
                groups: [{ id: 7, name: 'Direction des finances', owner_id: 1 }],
            },
        } as never);
        mockedGetUserWithRoles.mockResolvedValue({
            data: {
                roles: [
                    { id: 1, name: 'Admin' },
                    { id: 2, name: 'Responsable' },
                ],
            },
        } as never);

        const response = await request(app)
            .get('/session/me')
            .set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(200);
        expect(response.body.roles).toEqual([
            { id: 1, name: 'Admin' },
            { id: 2, name: 'Responsable' },
        ]);
        expect(response.body.groups).toEqual([
            { id: 7, name: 'Direction des finances', owner_id: 1 },
        ]);
        expect(mockedGetUserWithRoles).toHaveBeenCalledWith(
            '/api/v1/admin/users/42/',
            expect.objectContaining({
                headers: { Authorization: expect.stringMatching(/^Bearer /) },
            }),
        );
    });

    it('rejects a missing token', async () => {
        const response = await request(app).get('/session/me');

        expect(response.status).toBe(401);
        expect(mockedGetMe).not.toHaveBeenCalled();
    });
});

describe('getJwtUserId', () => {
    it('reads a positive numeric subject', () => {
        expect(getJwtUserId(`Bearer ${tokenFor(12)}`)).toBe(12);
    });

    it('rejects malformed tokens', () => {
        expect(getJwtUserId('Bearer invalid')).toBeNull();
    });
});
