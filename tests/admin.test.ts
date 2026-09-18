import { createHmac } from 'node:crypto';
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
app.use('/bff/admin', adminRouter);

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
        expect(mockedDeleteUser).not.toHaveBeenCalled();
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

    it('answers 404 when removing a user who is not a member', async () => {
        mockedGetGroupUsers.mockResolvedValue(axiosResponse(groupMembers([9])));

        const response = await request(app)
            .delete('/bff/admin/groups/4/users/7')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(404);
        expect(jest.mocked(coreGroupsClient.removeUserFromGroup)).not.toHaveBeenCalled();
    });
});
