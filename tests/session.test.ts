import express from 'express';
import request from 'supertest';
import sessionRouter from '../src/routes/session';
import { coreGroupsClient, coreUsersClient } from '../src/clients/coreClient';
import { axiosResponse, group, groupsResult, meResponse } from './support/core-fixtures';

// Core API est simulée au niveau du client généré : chaque regroupement expose exactement les opérations de
// getCoreAPIMairie360 (@mairie360/core-api-openapi), une opération renommée ou retirée par le contrat casse le test.
jest.mock('../src/clients/coreClient', () => {
    const { getCoreAPIMairie360 } = jest.requireActual<typeof import('@mairie360/core-api-openapi/endpoints/coreAPIMairie360')>(
        '@mairie360/core-api-openapi/endpoints/coreAPIMairie360',
    );
    const operations = Object.fromEntries(Object.keys(getCoreAPIMairie360()).map((operation) => [operation, jest.fn()]));
    return { coreGroupsClient: operations, coreUsersClient: operations };
});

const mockedGetMe = jest.mocked(coreUsersClient.getMe);
const mockedGetGroups = jest.mocked(coreGroupsClient.getGroups);

function tokenFor(userId: number) {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: String(userId) })).toString('base64url');

    return `${header}.${payload}.test`;
}

const app = express();
app.use('/session', sessionRouter);
app.use('/', sessionRouter);

describe('GET /session/me', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the current user with their groups and the role of GetMeResponseView', async () => {
        const me = meResponse({ role: 'Responsable', phone: '+262000000000' });
        mockedGetMe.mockResolvedValue(axiosResponse(me));
        mockedGetGroups.mockResolvedValue(axiosResponse(groupsResult([group(7, { name: 'Direction des finances' })])));

        const response = await request(app)
            .get('/session/me')
            .set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ user: me, groups: [group(7, { name: 'Direction des finances' })], roles: ['Responsable'] });
        expect(mockedGetMe).toHaveBeenCalledWith({ headers: { Authorization: `Bearer ${tokenFor(42)}` } });
        expect(mockedGetGroups).toHaveBeenCalledWith({ headers: { Authorization: `Bearer ${tokenFor(42)}` } });
    });

    it('rejects a missing token', async () => {
        const response = await request(app).get('/session/me');

        expect(response.status).toBe(401);
        expect(mockedGetMe).not.toHaveBeenCalled();
    });

    it('keeps the current-user context available at /me', async () => {
        mockedGetMe.mockResolvedValue(axiosResponse(meResponse({ role: 'Admin', groups: [] })));
        mockedGetGroups.mockResolvedValue(axiosResponse(groupsResult([])));

        const response = await request(app)
            .get('/me')
            .set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(200);
        expect(response.body.roles).toEqual(['Admin']);
        expect(response.body.groups).toEqual([]);
    });

    it('prefers a non-empty roles array when Core sends one alongside role', async () => {
        // Hors contrat GetMeResponseView : tolérance du BFF envers un Core qui listerait les rôles.
        const withRoles = { ...meResponse({ role: 'Admin' }), roles: ['Admin', 'Responsable'] };
        mockedGetMe.mockResolvedValue(axiosResponse<typeof withRoles>(withRoles));
        mockedGetGroups.mockResolvedValue(axiosResponse(groupsResult([])));

        const response = await request(app)
            .get('/me')
            .set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(200);
        expect(response.body.roles).toEqual(['Admin', 'Responsable']);
    });
});
