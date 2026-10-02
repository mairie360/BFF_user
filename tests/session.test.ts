import { errorHandler } from '@mairie360/bffs-lib';
import { AxiosError, AxiosHeaders } from 'axios';
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
app.use(errorHandler({ onError: () => undefined }));

const coreError = (status: number) => new AxiosError(`Request failed with status code ${status}`, undefined, undefined, undefined, {
    data: 'Core error', status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
});

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
        // Contract fields only: the groups nested in Core's /user/me answer are not relayed under `user`.
        const user: Partial<ReturnType<typeof meResponse>> = { ...me };
        delete user.groups;
        expect(response.body).toEqual({ user, groups: [group(7, { name: 'Direction des finances' })], roles: ['Responsable'] });
        expect(mockedGetMe).toHaveBeenCalledWith({ headers: { Authorization: `Bearer ${tokenFor(42)}` } });
        expect(mockedGetGroups).toHaveBeenCalledWith({ headers: { Authorization: `Bearer ${tokenFor(42)}` } });
    });

    it('drops any field Core API adds beyond the contract', async () => {
        mockedGetMe.mockResolvedValue(axiosResponse({ ...meResponse({ role: 'Agent' }), password_hash: 'secret', is_archived: false }));
        mockedGetGroups.mockResolvedValue(axiosResponse({ groups: [{ ...group(7), internal_note: 'hidden' }], total: 1 }));

        const response = await request(app).get('/me').set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(200);
        expect(Object.keys(response.body).sort()).toEqual(['groups', 'roles', 'user']);
        expect(response.body.user).not.toHaveProperty('password_hash');
        expect(response.body.user).not.toHaveProperty('is_archived');
        expect(response.body.groups[0]).not.toHaveProperty('internal_note');
    });

    it('answers 502 when Core API returns a body that does not match the contract', async () => {
        mockedGetMe.mockResolvedValue(axiosResponse({ email: 'a@b.c' } as unknown as ReturnType<typeof meResponse>));
        mockedGetGroups.mockResolvedValue(axiosResponse(groupsResult([])));

        const response = await request(app).get('/me').set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(502);
        expect(JSON.stringify(response.body)).not.toContain('a@b.c');
    });

    it('ignores the legacy x-session-token header and session cookie', async () => {
        const response = await request(app).get('/me').set('x-session-token', tokenFor(42)).set('Cookie', `session=${tokenFor(42)}`);

        expect(response.status).toBe(401);
        expect(mockedGetMe).not.toHaveBeenCalled();
    });

    it('rejects a missing token', async () => {
        const response = await request(app).get('/session/me');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing session token', details: [] } });
        expect(mockedGetMe).not.toHaveBeenCalled();
    });

    it.each([
        [401, 401],
        [404, 502],
        [500, 502],
    ])('answers a Core %i with %i', async (coreStatus, status) => {
        mockedGetMe.mockRejectedValue(coreError(coreStatus));
        mockedGetGroups.mockResolvedValue(axiosResponse(groupsResult([])));

        const response = await request(app).get('/me').set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(status);
        expect(response.body.error.details).toEqual([]);
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
