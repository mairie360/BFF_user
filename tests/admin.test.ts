import { createHmac } from 'node:crypto';
import { errorHandler } from '@mairie360/bffs-lib';
import { AxiosError, AxiosHeaders } from 'axios';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import {
    coreAdminUsersClient,
    coreGroupsClient,
    coreUsersClient,
} from '../src/clients/coreClient';
import adminRouter from '../src/routes/admin';
import { adminUserRow, adminUsersPage, axiosResponse, group, groupMembers, meResponse } from './support/core-fixtures';

// Test unitaire des règles du routeur : Core API est simulée au niveau du client généré. Chaque regroupement
// expose exactement les opérations de getCoreAPIMairie360 (@mairie360/core-api-openapi), avec l'alias
// historique getGroupUsers → getGroupMembers du BFF. Le parcours complet passe par un vrai serveur HTTP piloté
// par le contrat (user.upstream-mocks.test.ts).
jest.mock('../src/clients/coreClient', () => {
    const { getCoreAPIMairie360 } = jest.requireActual<typeof import('@mairie360/core-api-openapi/endpoints/coreAPIMairie360')>(
        '@mairie360/core-api-openapi/endpoints/coreAPIMairie360',
    );
    const operations = Object.fromEntries(Object.keys(getCoreAPIMairie360()).map((operation) => [operation, jest.fn()]));
    return {
        coreAdminRolesClient: operations,
        coreAdminUsersClient: operations,
        coreGroupsClient: { ...operations, getGroupUsers: operations.getGroupMembers },
        coreSessionsClient: operations,
        coreUsersClient: operations,
    };
});

const mockedGetMe = jest.mocked(coreUsersClient.getMe);
const mockedListUsers = jest.mocked(coreAdminUsersClient.adminListUsers);
const mockedDeleteUser = jest.mocked(coreAdminUsersClient.adminDeleteUser);
const mockedResetUserPassword = jest.mocked(coreAdminUsersClient.adminResetUserPassword);
const mockedPatchGroup = jest.mocked(coreGroupsClient.patchGroup);
const mockedGetGroupUsers = jest.mocked(coreGroupsClient.getGroupUsers);
const mockedAddUserToGroup = jest.mocked(coreGroupsClient.addUserToGroup);

const adminUser = adminUserRow();

function tokenFor(userId: number) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        sub: String(userId),
        exp: Math.floor(Date.now() / 1000) + 3_600,
    })).toString('base64url');
    const signature = createHmac('sha256', process.env.JWT_SECRET!)
        .update(`${header}.${payload}`)
        .digest('base64url');

    return `${header}.${payload}.${signature}`;
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/bff/admin', adminRouter);
app.use(errorHandler({ onError: () => undefined }));

/** Core API error as the generated axios client rejects it. */
const coreError = (status: number, data: unknown = 'Core error') => new AxiosError(`Request failed with status code ${status}`, undefined, undefined, undefined, {
    data, status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
});

describe('Administration routes', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'admin-test-secret';
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetMe.mockResolvedValue(axiosResponse(meResponse({ role: 'Admin' })));
    });

    it('returns at most 20 users per page', async () => {
        mockedListUsers.mockResolvedValue(axiosResponse(adminUsersPage([adminUser])));

        const response = await request(app)
            .get('/bff/admin/users?page=1&page_size=20')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(200);
        expect(mockedListUsers).toHaveBeenCalledWith({ page: 1, page_size: 20 }, expect.anything());
        expect(response.body.users[0].roles).toEqual(adminUser.roles);
    });

    it('forwards the search to Core API', async () => {
        mockedListUsers.mockResolvedValue(axiosResponse(adminUsersPage([])));

        const response = await request(app)
            .get('/bff/admin/users?search=martin')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(200);
        expect(mockedListUsers).toHaveBeenCalledWith({ page: 1, page_size: 20, search: 'martin' }, expect.anything());
    });

    it('rejects a page size greater than 20', async () => {
        const response = await request(app)
            .get('/bff/admin/users?page_size=21')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toEqual({
            code: 'BAD_REQUEST',
            message: 'Invalid pagination parameters',
            details: [expect.objectContaining({ path: 'query.page_size' })],
        });
        expect(mockedListUsers).not.toHaveBeenCalled();
    });

    it('deletes a user through the Core API for an authenticated administrator', async () => {
        mockedDeleteUser.mockResolvedValue(axiosResponse(undefined, 204));

        const token = tokenFor(1);
        const response = await request(app)
            .delete('/bff/admin/users/42')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(204);
        expect(mockedDeleteUser).toHaveBeenCalledWith(42, {
            headers: { Authorization: `Bearer ${token}` },
        });
    });

    it('rejects user deletion when the requester is not an administrator', async () => {
        mockedGetMe.mockResolvedValue(axiosResponse(meResponse({ role: 'User' })));

        const response = await request(app)
            .delete('/bff/admin/users/42')
            .set('Authorization', `Bearer ${tokenFor(2)}`);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: { code: 'FORBIDDEN', message: 'Administrator role required', details: [] } });
        expect(mockedDeleteUser).not.toHaveBeenCalled();
    });

    it.each([
        ['no session', undefined, 'Invalid session.'],
        ['a forged token', 'Bearer a.b.c', 'Invalid or expired session token'],
    ])('answers 401 with %s before calling Core API', async (_label, authorization, message) => {
        const call = request(app).delete('/bff/admin/users/42');
        const response = await (authorization ? call.set('Authorization', authorization) : call);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: { code: 'UNAUTHORIZED', message, details: [] } });
        expect(mockedGetMe).not.toHaveBeenCalled();
    });

    it.each([
        ['the accessToken cookie', (call: request.Test) => call.set('Cookie', `accessToken=${tokenFor(1)}`)],
        ['the x-session-token header', (call: request.Test) => call.set('x-session-token', tokenFor(1))],
    ])('ignores a session sent in %s: 401 before calling Core API', async (_label, prepare) => {
        const response = await prepare(request(app).get('/bff/admin/users'));

        expect(response.status).toBe(401);
        expect(mockedGetMe).not.toHaveBeenCalled();
        expect(mockedListUsers).not.toHaveBeenCalled();
    });

    it('marks administration answers as not cacheable, errors included', async () => {
        mockedListUsers.mockResolvedValue(axiosResponse(adminUsersPage([adminUser])));

        const ok = await request(app).get('/bff/admin/users').set('Authorization', `Bearer ${tokenFor(1)}`);
        const refused = await request(app).get('/bff/admin/users');

        expect(ok.headers['cache-control']).toBe('no-store');
        expect(refused.headers['cache-control']).toBe('no-store');
    });

    it('answers 500 without calling Core API when JWT_SECRET is not configured', async () => {
        const token = tokenFor(1);
        const secret = process.env.JWT_SECRET;
        delete process.env.JWT_SECRET;
        try {
            const response = await request(app).delete('/bff/admin/users/42').set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(500);
            expect(response.body.error.code).toBe('INTERNAL_ERROR');
            // The cause is only logged server side, never sent to the client.
            expect(JSON.stringify(response.body)).not.toContain('JWT_SECRET');
            expect(mockedGetMe).not.toHaveBeenCalled();
        } finally {
            process.env.JWT_SECRET = secret;
        }
    });

    it.each([
        [404, 404],
        [409, 409],
        [422, 502],
        [500, 502],
    ])('answers a Core %i on a write with %i, without relaying the Core body', async (coreStatus, status) => {
        mockedDeleteUser.mockRejectedValue(coreError(coreStatus, 'duplicate key value violates unique constraint "users_email_key"'));

        const response = await request(app)
            .delete('/bff/admin/users/42')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(status);
        expect(JSON.stringify(response.body)).not.toContain('duplicate key');
    });

    it('answers 502 for a Core 409 on a read, which does not declare it', async () => {
        mockedListUsers.mockRejectedValue(coreError(409));

        const response = await request(app)
            .get('/bff/admin/users')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(502);
        expect(response.body.error.code).toBe('BAD_GATEWAY');
    });

    it('answers 502 when the admin role check cannot reach Core API', async () => {
        mockedGetMe.mockRejectedValue(new AxiosError('connect ECONNREFUSED'));

        const response = await request(app)
            .get('/bff/admin/users')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(502);
        expect(response.body).toEqual({ error: { code: 'BAD_GATEWAY', message: 'The Core API service is unavailable.', details: [] } });
    });

    it('sets a new password for an authenticated administrator', async () => {
        mockedResetUserPassword.mockResolvedValue(axiosResponse(undefined, 204));

        const response = await request(app)
            .patch('/bff/admin/users/42/password')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ new_password: 'Temporary-123!' });

        expect(response.status).toBe(204);
        expect(mockedResetUserPassword).toHaveBeenCalledWith(
            42,
            { new_password: 'Temporary-123!' },
            expect.anything(),
        );
    });

    it('rejects an invalid new password', async () => {
        const response = await request(app)
            .patch('/bff/admin/users/42/password')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ new_password: 'short' });

        expect(response.status).toBe(400);
        expect(mockedResetUserPassword).not.toHaveBeenCalled();
    });

    it('rejects a password reset when the requester is not an administrator', async () => {
        mockedGetMe.mockResolvedValue(axiosResponse(meResponse({ role: 'User' })));

        const response = await request(app)
            .patch('/bff/admin/users/42/password')
            .set('Authorization', `Bearer ${tokenFor(2)}`)
            .send({ new_password: 'Temporary-123!' });

        expect(response.status).toBe(403);
        expect(mockedResetUserPassword).not.toHaveBeenCalled();
    });

    it('updates a group name and description', async () => {
        mockedPatchGroup.mockResolvedValue(axiosResponse(group(4, { name: 'Direction générale', description: 'Équipe de direction' })));

        const response = await request(app)
            .patch('/bff/admin/groups/4')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ name: 'Direction générale', description: 'Équipe de direction' });

        expect(response.status).toBe(200);
        expect(response.body.group.name).toBe('Direction générale');
        expect(mockedPatchGroup).toHaveBeenCalledWith(
            4,
            { name: 'Direction générale', description: 'Équipe de direction' },
            expect.anything(),
        );
    });

    it('returns group members without their roles', async () => {
        mockedListUsers.mockResolvedValue(axiosResponse(adminUsersPage([adminUser], { page_size: 500 })));

        const response = await request(app)
            .get('/bff/admin/groups/4/users')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(200);
        expect(mockedListUsers).toHaveBeenCalledWith({ group_id: 4, page_size: 500 }, expect.anything());
        expect(response.body.users[0]).toEqual(Object.fromEntries(Object.entries(adminUser).filter(([field]) => field !== 'roles')));
    });

    it('does not add a member who already belongs to the group', async () => {
        mockedGetGroupUsers.mockResolvedValue(axiosResponse(groupMembers([7])));

        const response = await request(app)
            .post('/bff/admin/groups/4/users')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ user_id: 7 });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ created: false });
        expect(mockedAddUserToGroup).not.toHaveBeenCalled();
    });

    it('adds a member who does not belong to the group yet', async () => {
        mockedGetGroupUsers.mockResolvedValue(axiosResponse(groupMembers([])));
        mockedAddUserToGroup.mockResolvedValue(axiosResponse('User added to group'));

        const response = await request(app)
            .post('/bff/admin/groups/4/users')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ user_id: 7 });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ created: true });
        expect(mockedAddUserToGroup).toHaveBeenCalledWith(4, { group_id: 4, user_id: 7 }, expect.anything());
    });

    it.each([
        ['post', '/bff/admin/users', { email: 'not-an-email', first_name: 'Jane', last_name: 'Doe', password: 'Temporary-Passw0rd' }],
        ['post', '/bff/admin/users', { email: 'jane.doe@mairie360.fr', first_name: 'Jane', last_name: 'Doe', password: 'short' }],
        ['patch', '/bff/admin/users/7', {}],
        ['post', '/bff/admin/users/7/roles', { role_id: '3' }],
        ['post', '/bff/admin/roles', { name: 'Agent' }],
        ['put', '/bff/admin/roles/3', { name: '', description: 'Municipal agent' }],
        ['patch', '/bff/admin/roles/3', {}],
        ['post', '/bff/admin/groups', { name: 'Culture' }],
        ['post', '/bff/admin/roles', { name: '<script>alert(1)</script>', description: 'Municipal agent' }],
        ['patch', '/bff/admin/groups/4', { description: '<img src=x onerror=alert(1)>' }],
        ['post', '/bff/admin/groups/4/users', { user_id: 0 }],
        ['post', '/bff/admin/sessions/revoke', { token: 'opaque-refresh-token' }],
    ])('rejects an invalid %s %s body without calling Core API', async (method, path, body) => {
        const response = await request(app)[method as 'post'](path)
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(body));

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('BAD_REQUEST');
        expect(response.body.error.details.length).toBeGreaterThan(0);
        // Only the admin role check reached Core API.
        const coreCalls = Object.values(coreAdminUsersClient).filter((operation) => jest.mocked(operation).mock.calls.length > 0);
        expect(coreCalls).toEqual([mockedGetMe]);
    });

    it('rejects a role assignment whose body names another user than the path', async () => {
        const response = await request(app)
            .post('/bff/admin/users/7/roles')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ user_id: 1, role_id: 1 });

        expect(response.status).toBe(400);
        expect(response.body.error).toEqual({ code: 'BAD_REQUEST', message: 'Invalid user_id', details: [expect.objectContaining({ path: 'body.user_id' })] });
        expect(jest.mocked(coreAdminUsersClient.adminAddRoleToUser)).not.toHaveBeenCalled();
    });

    it('assigns the role to the path user when the body omits user_id', async () => {
        jest.mocked(coreAdminUsersClient.adminAddRoleToUser).mockResolvedValue(axiosResponse(undefined, 200));

        const response = await request(app)
            .post('/bff/admin/users/7/roles')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ role_id: 3 });

        expect(response.status).toBe(200);
        expect(jest.mocked(coreAdminUsersClient.adminAddRoleToUser)).toHaveBeenCalledWith(7, { role_id: 3, user_id: 7 }, expect.anything());
    });

    it('rejects a group membership whose body names another group than the path', async () => {
        const response = await request(app)
            .post('/bff/admin/groups/4/users')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ group_id: 5, user_id: 7 });

        expect(response.status).toBe(400);
        expect(mockedGetGroupUsers).not.toHaveBeenCalled();
    });

    it('does not forward a password in a user update', async () => {
        const mockedPatchUser = jest.mocked(coreAdminUsersClient.adminPatchUser);
        mockedPatchUser.mockResolvedValue(axiosResponse('User updated', 200));

        const response = await request(app)
            .patch('/bff/admin/users/7')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ first_name: 'Jane', password: 'x' });

        expect(response.status).toBe(200);
        expect(mockedPatchUser).toHaveBeenCalledWith(7, { first_name: 'Jane' }, expect.anything());
    });

    it('answers 404 when removing a user who is not a member', async () => {
        mockedGetGroupUsers.mockResolvedValue(axiosResponse(groupMembers([9])));

        const response = await request(app)
            .delete('/bff/admin/groups/4/users/7')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Unknown group member', details: [] } });
        expect(jest.mocked(coreGroupsClient.removeUserFromGroup)).not.toHaveBeenCalled();
    });
});
