import { errorHandler } from '@mairie360/bffs-lib';
import { AxiosError, AxiosHeaders } from 'axios';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import sessionRouter from '../src/routes/session';
import { coreGroupsClient, coreUsersClient } from '../src/clients/coreClient';
import { JWT_SECRET, axiosResponse, group, groupsResult, meResponse, sessionToken } from './support/core-fixtures';

// Core API est simulée au niveau du client généré : chaque regroupement expose exactement les opérations de
// getCoreAPIMairie360 (@mairie360/core-api-openapi), une opération renommée ou retirée par le contrat casse le test.
jest.mock('../src/clients/coreClient', () => {
    const { getCoreAPIMairie360 } = jest.requireActual<typeof import('@mairie360/core-api-openapi/endpoints/coreAPIMairie360')>(
        '@mairie360/core-api-openapi/endpoints/coreAPIMairie360',
    );
    const operations = Object.fromEntries(Object.keys(getCoreAPIMairie360()).map((operation) => [operation, jest.fn()]));
    return { CORE_LARGEST_PAGE: { limit: 500 }, coreGroupsClient: operations, coreUsersClient: operations };
});

const mockedGetMe = jest.mocked(coreUsersClient.getMe);
const mockedGetGroups = jest.mocked(coreGroupsClient.getGroups);

// Signed with the JWT_SECRET of the tests: `requireSession` verifies it before any Core call.
const tokenFor = (userId: number) => sessionToken(userId);

const app = express();
// Cookies are parsed, as in the application: the accessToken cookie must still be ignored.
app.use(cookieParser());
app.use('/session', sessionRouter);
app.use('/', sessionRouter);
app.use(errorHandler({ onError: () => undefined }));

const coreError = (status: number) => new AxiosError(`Request failed with status code ${status}`, undefined, undefined, undefined, {
    data: 'Core error', status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
});

describe('GET /session/me', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Read on every call (MAIR-431): no localhost default, no URL frozen at import.
        process.env.CORE_API_URL = 'http://core.test';
        process.env.JWT_SECRET = JWT_SECRET;
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
        delete user.roles;
        expect(response.body).toEqual({ user, groups: [group(7, { name: 'Direction des finances' })], roles: ['Responsable'] });
        expect(mockedGetMe).toHaveBeenCalledWith({ baseURL: 'http://core.test', timeout: 10_000, headers: { Authorization: `Bearer ${tokenFor(42)}` } });
        expect(mockedGetGroups).toHaveBeenCalledWith({ limit: 500 }, { baseURL: 'http://core.test', timeout: 10_000, headers: { Authorization: `Bearer ${tokenFor(42)}` } });
    });

    it.each([
        ['CORE_API_URL with CORE_API_PORT', 'core', '3000', 'http://core:3000'],
        ['a CORE_API_URL changed after import', 'https://core.other.test/', undefined, 'https://core.other.test'],
    ])('reads %s on every call', async (_label, url, port, expected) => {
        process.env.CORE_API_URL = url;
        if (port) process.env.CORE_API_PORT = port;
        mockedGetMe.mockResolvedValue(axiosResponse(meResponse({ role: 'Agent' })));
        mockedGetGroups.mockResolvedValue(axiosResponse(groupsResult([])));
        try {
            const response = await request(app).get('/me').set('Authorization', `Bearer ${tokenFor(42)}`);

            expect(response.status).toBe(200);
            expect(mockedGetMe).toHaveBeenCalledWith(expect.objectContaining({ baseURL: expected }));
        } finally {
            delete process.env.CORE_API_PORT;
        }
    });

    it('retries the idempotent Core reads once on a transient failure', async () => {
        mockedGetMe.mockRejectedValueOnce(coreError(503)).mockResolvedValue(axiosResponse(meResponse({ role: 'Agent' })));
        mockedGetGroups.mockResolvedValue(axiosResponse(groupsResult([])));

        const response = await request(app).get('/me').set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(200);
        expect(mockedGetMe).toHaveBeenCalledTimes(2);
    });

    it.each([
        ['missing', undefined],
        ['invalid', 'http://exa mple'],
    ])('answers 503 without calling Core API when CORE_API_URL is %s (no localhost default)', async (_label, url) => {
        if (url === undefined) delete process.env.CORE_API_URL;
        else process.env.CORE_API_URL = url;

        const response = await request(app).get('/me').set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(503);
        expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
        expect(mockedGetMe).not.toHaveBeenCalled();
        expect(mockedGetGroups).not.toHaveBeenCalled();
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

    it.each([
        ['the legacy x-session-token header', (call: request.Test) => call.set('x-session-token', tokenFor(42))],
        ['the legacy session cookie', (call: request.Test) => call.set('Cookie', `session=${tokenFor(42)}`)],
        ['the accessToken cookie', (call: request.Test) => call.set('Cookie', `accessToken=${tokenFor(42)}`)],
        ['another scheme', (call: request.Test) => call.set('Authorization', `Token ${tokenFor(42)}`)],
    ])('ignores a session sent in %s: 401 before any Core call', async (_label, prepare) => {
        const response = await prepare(request(app).get('/me'));

        expect(response.status).toBe(401);
        expect(mockedGetMe).not.toHaveBeenCalled();
        expect(mockedGetGroups).not.toHaveBeenCalled();
    });

    it('marks the session answer as not cacheable', async () => {
        mockedGetMe.mockResolvedValue(axiosResponse(meResponse({ role: 'Agent' })));
        mockedGetGroups.mockResolvedValue(axiosResponse(groupsResult([])));

        const response = await request(app).get('/session/me').set('Authorization', `Bearer ${tokenFor(42)}`);

        expect(response.status).toBe(200);
        expect(response.headers['cache-control']).toBe('no-store');
    });

    it('still answers 404 to unknown paths under the / mount', async () => {
        const response = await request(app).get('/unknown');

        expect(response.status).toBe(404);
    });

    it('rejects a missing token', async () => {
        const response = await request(app).get('/session/me');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Invalid session.', details: [] } });
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
