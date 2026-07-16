import { createHmac } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { coreAdminUsersClient } from '../src/clients/coreClient';
import adminRouter from '../src/routes/admin';
import {
    isAdministrationUserAdmin,
    listAdministrationGroupMembers,
    listAdministrationUsers,
    resetAdministrationUserPassword,
    updateAdministrationGroup,
} from '../src/repositories/adminRepository';

jest.mock('../src/clients/coreClient', () => ({
    coreAdminRolesClient: {},
    coreAdminUsersClient: {
        adminDeleteUser: jest.fn(),
    },
    coreGroupsClient: {},
    coreSessionsClient: {},
}));

jest.mock('../src/repositories/adminRepository', () => ({
    addAdministrationGroupMember: jest.fn(),
    isAdministrationUserAdmin: jest.fn(),
    listAdministrationGroupMembers: jest.fn(),
    listAdministrationUsers: jest.fn(),
    removeAdministrationGroupMember: jest.fn(),
    resetAdministrationUserPassword: jest.fn(),
    updateAdministrationGroup: jest.fn(),
}));

const mockedIsAdmin = jest.mocked(isAdministrationUserAdmin);
const mockedDeleteUser = jest.mocked(coreAdminUsersClient.adminDeleteUser);
const mockedListUsers = jest.mocked(listAdministrationUsers);
const mockedListGroupMembers = jest.mocked(listAdministrationGroupMembers);
const mockedResetUserPassword = jest.mocked(resetAdministrationUserPassword);
const mockedUpdateGroup = jest.mocked(updateAdministrationGroup);

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
        mockedIsAdmin.mockResolvedValue(true);
    });

    it('returns at most 20 users per page', async () => {
        mockedListUsers.mockResolvedValue({
            users: [{
                id: 1,
                first_name: 'Admin',
                last_name: 'User',
                email: 'admin@mairie360.fr',
                phone_number: null,
                status: 'active',
                is_archived: false,
                roles: [{ id: 1, name: 'Admin' }],
            }],
            page: 1,
            page_size: 20,
            total: 1,
            total_pages: 1,
        });

        const response = await request(app)
            .get('/bff/admin/users?page=1&page_size=20')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(200);
        expect(mockedListUsers).toHaveBeenCalledWith({
            page: 1,
            pageSize: 20,
            search: undefined,
        });
        expect(response.body.users[0].roles).toEqual([{ id: 1, name: 'Admin' }]);
    });

    it('rejects a page size greater than 20', async () => {
        const response = await request(app)
            .get('/bff/admin/users?page_size=21')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(400);
        expect(mockedListUsers).not.toHaveBeenCalled();
    });

    it('deletes a user through the Core API for an authenticated administrator', async () => {
        mockedDeleteUser.mockResolvedValue({
            status: 204,
            data: undefined,
        } as Awaited<ReturnType<typeof coreAdminUsersClient.adminDeleteUser>>);

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
        mockedIsAdmin.mockResolvedValue(false);

        const response = await request(app)
            .delete('/bff/admin/users/42')
            .set('Authorization', `Bearer ${tokenFor(2)}`);

        expect(response.status).toBe(403);
        expect(mockedDeleteUser).not.toHaveBeenCalled();
    });

    it('sets a new password for an authenticated administrator', async () => {
        mockedResetUserPassword.mockResolvedValue(true);

        const response = await request(app)
            .patch('/bff/admin/users/42/password')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ new_password: 'Temporary-123!' });

        expect(response.status).toBe(204);
        expect(mockedResetUserPassword).toHaveBeenCalledWith(42, 'Temporary-123!');
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
        mockedIsAdmin.mockResolvedValue(false);

        const response = await request(app)
            .patch('/bff/admin/users/42/password')
            .set('Authorization', `Bearer ${tokenFor(2)}`)
            .send({ new_password: 'Temporary-123!' });

        expect(response.status).toBe(403);
        expect(mockedResetUserPassword).not.toHaveBeenCalled();
    });

    it('returns 404 when the password-reset user does not exist', async () => {
        mockedResetUserPassword.mockResolvedValue(false);

        const response = await request(app)
            .patch('/bff/admin/users/404/password')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ new_password: 'Temporary-123!' });

        expect(response.status).toBe(404);
    });

    it('updates a group name and description', async () => {
        mockedUpdateGroup.mockResolvedValue({
            id: 4,
            owner_id: 1,
            name: 'Direction générale',
            description: 'Équipe de direction',
        });

        const response = await request(app)
            .patch('/bff/admin/groups/4')
            .set('Authorization', `Bearer ${tokenFor(1)}`)
            .send({ name: 'Direction générale', description: 'Équipe de direction' });

        expect(response.status).toBe(200);
        expect(response.body.group.name).toBe('Direction générale');
    });

    it('returns group members with their names', async () => {
        mockedListGroupMembers.mockResolvedValue([{
            id: 1,
            first_name: 'Admin',
            last_name: 'User',
            email: 'admin@mairie360.fr',
            phone_number: null,
            status: 'active',
            is_archived: false,
        }]);

        const response = await request(app)
            .get('/bff/admin/groups/4/users')
            .set('Authorization', `Bearer ${tokenFor(1)}`);

        expect(response.status).toBe(200);
        expect(response.body.users[0]).toMatchObject({
            first_name: 'Admin',
            last_name: 'User',
        });
    });
});
