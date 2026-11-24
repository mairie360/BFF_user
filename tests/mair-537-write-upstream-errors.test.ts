import { errorHandler } from '@mairie360/bffs-lib';
import { AxiosError, AxiosHeaders } from 'axios';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { coreAdminRolesClient, coreAdminUsersClient, coreGroupsClient, coreSessionsClient, coreUsersClient } from '../src/clients/coreClient';
import adminRouter from '../src/routes/admin';
import { axiosResponse, groupMembers, meResponse, sessionToken, useSessionPublicKey } from './support/core-fixtures';

// MAIR-537: the mapping of a Core failure on a WRITE (`upstreamError(..., WRITE_STATUSES)`) was only tested on
// DELETE /admin/users/:id. It is applied here to every write route of the administration router: a Core 404 / 409
// are relayed, a 403 too, anything else (422, 500, no answer) becomes a documented 502; the Core body never reaches
// the client; and a write is called exactly once (never retried).
jest.mock('../src/clients/coreClient', () => {
    const { getCoreAPIMairie360 } = jest.requireActual<typeof import('@mairie360/core-api-openapi/endpoints/coreAPIMairie360')>(
        '@mairie360/core-api-openapi/endpoints/coreAPIMairie360',
    );
    const operations = Object.fromEntries(Object.keys(getCoreAPIMairie360()).map((operation) => [operation, jest.fn()]));
    return {
        CORE_LARGEST_PAGE: { limit: 500 },
        CORE_MAX_LIMIT: 500,
        CORE_MAX_OFFSET: 1_000_000,
        coreAdminRolesClient: operations,
        coreAdminUsersClient: operations,
        coreGroupsClient: { ...operations, getGroupUsers: operations.getGroupMembers },
        coreSessionsClient: operations,
        coreUsersClient: operations,
    };
});

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/admin', adminRouter);
app.use(errorHandler({ onError: () => undefined }));

const coreError = (status: number, data: unknown) => new AxiosError(`Request failed with status code ${status}`, undefined, undefined, undefined, {
    data, status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
});

type WriteRoute = {
    label: string;
    method: 'post' | 'patch' | 'put' | 'delete';
    path: string;
    body?: object;
    /** The Core operation that fails (the write, never the members read that precedes it). */
    write: jest.Mock;
    /** Group member routes read the members first. */
    members?: number[];
};

const mocked = (fn: unknown) => fn as jest.Mock;
const WRITE_ROUTES: WriteRoute[] = [
    { label: 'POST /admin/users', method: 'post', path: '/admin/users', body: { email: 'bob@mairie.test', first_name: 'Bob', last_name: 'Durand', password: 'MotDePasse123' }, write: mocked(coreAdminUsersClient.adminPostUser) },
    { label: 'PATCH /admin/users/:userId', method: 'patch', path: '/admin/users/7', body: { first_name: 'Alicia' }, write: mocked(coreAdminUsersClient.adminPatchUser) },
    { label: 'PATCH /admin/users/:userId/password', method: 'patch', path: '/admin/users/7/password', body: { new_password: 'MotDePasse123' }, write: mocked(coreAdminUsersClient.adminResetUserPassword) },
    { label: 'DELETE /admin/users/:userId', method: 'delete', path: '/admin/users/7', write: mocked(coreAdminUsersClient.adminDeleteUser) },
    { label: 'POST /admin/users/:userId/roles', method: 'post', path: '/admin/users/7/roles', body: { role_id: 3 }, write: mocked(coreAdminUsersClient.adminAddRoleToUser) },
    { label: 'DELETE /admin/users/:userId/roles/:roleId', method: 'delete', path: '/admin/users/7/roles/3', write: mocked(coreAdminUsersClient.adminDeleteUserRole) },
    { label: 'POST /admin/roles', method: 'post', path: '/admin/roles', body: { name: 'Agent', description: 'Agent municipal' }, write: mocked(coreAdminRolesClient.adminPostRole) },
    { label: 'PUT /admin/roles/:roleId', method: 'put', path: '/admin/roles/3', body: { name: 'Agent', description: 'Agent municipal' }, write: mocked(coreAdminRolesClient.adminPutRole) },
    { label: 'PATCH /admin/roles/:roleId', method: 'patch', path: '/admin/roles/3', body: { description: 'Agent de mairie' }, write: mocked(coreAdminRolesClient.adminPatchRole) },
    { label: 'DELETE /admin/roles/:roleId', method: 'delete', path: '/admin/roles/3', write: mocked(coreAdminRolesClient.adminDeleteRole) },
    { label: 'POST /admin/groups', method: 'post', path: '/admin/groups', body: { name: 'Culture', description: 'Service culture' }, write: mocked(coreGroupsClient.postGroup) },
    { label: 'PATCH /admin/groups/:groupId', method: 'patch', path: '/admin/groups/5', body: { name: 'Culture' }, write: mocked(coreGroupsClient.patchGroup) },
    { label: 'DELETE /admin/groups/:groupId', method: 'delete', path: '/admin/groups/5', write: mocked(coreGroupsClient.deleteGroup) },
    { label: 'POST /admin/groups/:groupId/users', method: 'post', path: '/admin/groups/5/users', body: { user_id: 7 }, write: mocked(coreGroupsClient.addUserToGroup), members: [1] },
    { label: 'DELETE /admin/groups/:groupId/users/:userId', method: 'delete', path: '/admin/groups/5/users/7', write: mocked(coreGroupsClient.removeUserFromGroup), members: [1, 7] },
    { label: 'POST /admin/sessions/revoke', method: 'post', path: '/admin/sessions/revoke', body: { refresh_token: 'opaque-refresh-token' }, write: mocked(coreSessionsClient.revoke) },
];

const SECRET_DETAIL = 'duplicate key value violates unique constraint "internal_table_pkey"';
const send = (route: WriteRoute) => {
    const call = request(app)[route.method](route.path).set('Authorization', `Bearer ${sessionToken(1)}`);
    return route.body ? call.send(route.body) : call;
};

describe('MAIR-537 Core failures on every write route of the administration router', () => {
    beforeAll(() => {
        useSessionPublicKey();
    });

    beforeEach(() => {
        process.env.CORE_API_URL = 'http://core.test';
        jest.clearAllMocks();
        jest.mocked(coreUsersClient.getMe).mockResolvedValue(axiosResponse(meResponse({ role: 'Admin' })));
        for (const route of WRITE_ROUTES) {
            if (route.members) jest.mocked(coreGroupsClient.getGroupUsers).mockResolvedValue(axiosResponse(groupMembers(route.members)));
        }
    });

    describe.each(WRITE_ROUTES)('$label', (route) => {
        beforeEach(() => {
            if (route.members) jest.mocked(coreGroupsClient.getGroupUsers).mockResolvedValue(axiosResponse(groupMembers(route.members)));
        });

        it.each([
            [403, 403, 'FORBIDDEN'],
            [404, 404, 'NOT_FOUND'],
            [409, 409, 'CONFLICT'],
            [422, 502, 'BAD_GATEWAY'],
            [500, 502, 'BAD_GATEWAY'],
        ])('answers a Core %i with %i %s, without relaying the Core body', async (coreStatus, status, code) => {
            route.write.mockRejectedValue(coreError(coreStatus, SECRET_DETAIL));

            const response = await send(route);

            expect(response.status).toBe(status);
            expect(response.body.error.code).toBe(code);
            expect(JSON.stringify(response.body)).not.toContain('internal_table_pkey');
        });

        it('answers 502 when Core cannot be reached', async () => {
            route.write.mockRejectedValue(new AxiosError('connect ECONNREFUSED'));

            const response = await send(route);

            expect(response.status).toBe(502);
            expect(response.body.error.message).toBe('The CORE_API service is unavailable.');
        });

        it('never retries the write, even on a transient Core failure', async () => {
            route.write.mockRejectedValue(coreError(503, 'busy'));

            const response = await send(route);

            expect(response.status).toBe(502);
            expect(route.write).toHaveBeenCalledTimes(1);
        });
    });

    it('DELETE /admin/groups/:groupId/users/:userId succeeds with 204 once the member is found', async () => {
        jest.mocked(coreGroupsClient.getGroupUsers).mockResolvedValue(axiosResponse(groupMembers([1, 7])));
        jest.mocked(coreGroupsClient.removeUserFromGroup).mockResolvedValue(axiosResponse(undefined, 204));

        const response = await request(app).delete('/admin/groups/5/users/7').set('Authorization', `Bearer ${sessionToken(1)}`);

        expect(response.status).toBe(204);
        expect(coreGroupsClient.removeUserFromGroup).toHaveBeenCalledWith(5, 7, expect.anything());
    });
});
