import express from 'express';
import request from 'supertest';
import sessionRouter from '../src/routes/session';
import { coreGroupsClient, coreUsersClient } from '../src/clients/coreClient';

jest.mock('../src/clients/coreClient', () => ({
    coreGroupsClient: { getGroups: jest.fn() },
    coreUsersClient: { getMe: jest.fn() },
}));

const mockedGetMe = jest.mocked(coreUsersClient.getMe);
const mockedGetGroups = jest.mocked(coreGroupsClient.getGroups);

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
                roles: ['Admin', 'Responsable'],
            },
        } as never);
        mockedGetGroups.mockResolvedValue({
            data: {
                groups: [{ id: 7, name: 'Direction des finances', owner_id: 1 }],
            },
        } as never);
        const response = await request(app)
            .get('/session/me')
            .set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(200);
        expect(response.body.roles).toEqual(['Admin', 'Responsable']);
        expect(response.body.groups).toEqual([
            { id: 7, name: 'Direction des finances', owner_id: 1 },
        ]);
    });

    it('rejects a missing token', async () => {
        const response = await request(app).get('/session/me');

        expect(response.status).toBe(401);
        expect(mockedGetMe).not.toHaveBeenCalled();
    });
});
