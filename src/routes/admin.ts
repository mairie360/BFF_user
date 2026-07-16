import { Request, Response, Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ApiErrorResponse, registry } from '../openapi-registry';
import {
    coreAdminRolesClient,
    coreAdminUsersClient,
    coreGroupsClient,
    coreSessionsClient,
} from '../clients/coreClient';
import {
    addAdministrationGroupMember,
    listAdministrationGroupMembers,
    listAdministrationUsers,
    removeAdministrationGroupMember,
    isAdministrationUserAdmin,
    resetAdministrationUserPassword,
    updateAdministrationGroup,
} from '../repositories/adminRepository';
import {
    bearerToken,
    coreRequestOptions,
    forwardCoreResponse,
    handleUnknownError,
    parsePositiveInteger,
} from './admin_helpers';

const router = Router();

const UserIdParams = z.object({ userId: z.coerce.number().int().positive() }).openapi('AdminUserIdParams');
const RoleIdParams = z.object({ roleId: z.coerce.number().int().positive() }).openapi('AdminRoleIdParams');
const GroupIdParams = z.object({ groupId: z.coerce.number().int().positive() }).openapi('AdminGroupIdParams');
const UserRoleParams = z.object({
    userId: z.coerce.number().int().positive(),
    roleId: z.coerce.number().int().positive(),
}).openapi('AdminUserRoleParams');
const GroupUserParams = z.object({
    groupId: z.coerce.number().int().positive(),
    userId: z.coerce.number().int().positive(),
}).openapi('AdminGroupUserParams');
const UserListQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    page_size: z.coerce.number().int().min(1).max(20).default(20),
    search: z.string().trim().max(100).optional(),
}).openapi('AdminUserListQuery');
const GroupPatchBody = z.object({
    name: z.string().trim().min(1).max(64).optional(),
    description: z.string().trim().max(2_000).optional(),
}).refine((value) => value.name !== undefined || value.description !== undefined, {
    message: 'At least one field is required',
}).openapi('AdminGroupPatchBody');
const UserPasswordResetBody = z.object({
    new_password: z.string().min(8).max(255),
}).openapi('AdminUserPasswordResetBody');
const JsonBody = z.record(z.string(), z.unknown()).openapi('AdminJsonBody');
const CoreResponse = z.unknown().openapi('CoreResponse');

registry.register('AdminUserIdParams', UserIdParams);
registry.register('AdminRoleIdParams', RoleIdParams);
registry.register('AdminGroupIdParams', GroupIdParams);
registry.register('AdminUserRoleParams', UserRoleParams);
registry.register('AdminGroupUserParams', GroupUserParams);
registry.register('AdminUserListQuery', UserListQuery);
registry.register('AdminGroupPatchBody', GroupPatchBody);
registry.register('AdminUserPasswordResetBody', UserPasswordResetBody);
registry.register('AdminJsonBody', JsonBody);
registry.register('CoreResponse', CoreResponse);

const jsonBodyRequest = {
    required: true,
    content: {
        'application/json': {
            schema: JsonBody,
        },
    },
};

const coreResponses = {
    200: {
        description: 'Réponse du Core API',
        content: {
            'application/json': {
                schema: CoreResponse,
            },
        },
    },
    201: {
        description: 'Créé par le Core API',
        content: {
            'application/json': {
                schema: CoreResponse,
            },
        },
    },
    204: {
        description: 'Aucun contenu retourné par le Core API',
    },
    400: {
        description: 'Erreur Core API',
        content: {
            'application/json': {
                schema: ApiErrorResponse,
            },
        },
    },
    401: {
        description: 'Non authentifié',
        content: {
            'application/json': {
                schema: ApiErrorResponse,
            },
        },
    },
    403: {
        description: 'Accès refusé',
        content: {
            'application/json': {
                schema: ApiErrorResponse,
            },
        },
    },
    404: {
        description: 'Introuvable',
        content: {
            'application/json': {
                schema: ApiErrorResponse,
            },
        },
    },
    502: {
        description: 'Erreur upstream',
        content: {
            'application/json': {
                schema: ApiErrorResponse,
            },
        },
    },
};

function invalidParam(res: Response, name: string): Response {
    return res.status(400).json({ message: `Invalid ${name}` });
}

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
    const authorization = bearerToken(req);
    if (!authorization) {
        res.status(401).json({ message: 'Invalid or missing session token' });
        return false;
    }

    const token = authorization.replace(/^Bearer\s+/i, '');
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        res.status(500).json({ message: 'JWT_SECRET is not configured' });
        return false;
    }

    let userId: number;

    try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid token');

        const [encodedHeader, encodedPayload, signature] = parts;
        const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
            alg?: unknown;
        };
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
            sub?: unknown;
            exp?: unknown;
        };
        const expectedSignature = createHmac('sha256', secret)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest();
        const receivedSignature = Buffer.from(signature, 'base64url');
        const validSignature =
            header.alg === 'HS256' &&
            expectedSignature.length === receivedSignature.length &&
            timingSafeEqual(expectedSignature, receivedSignature);
        userId = Number(payload.sub);
        const validExpiration =
            typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);

        if (!validSignature || !validExpiration || !Number.isInteger(userId) || userId <= 0) {
            res.status(401).json({ message: 'Invalid or expired session token' });
            return false;
        }

    } catch (error) {
        res.status(401).json({
            message: error instanceof Error ? error.message : 'Invalid session token',
        });
        return false;
    }

    try {
        const isAdmin = await isAdministrationUserAdmin(userId);

        if (!isAdmin) {
            res.status(403).json({ message: 'Administrator role required' });
            return false;
        }

        return true;
    } catch (error) {
        handleUnknownError(res, error);
        return false;
    }
}

registry.registerPath({
    method: 'get',
    path: '/bff/admin/users',
    tags: ['Administration'],
    summary: 'Liste les utilisateurs administrables, 20 éléments maximum par page',
    request: { query: UserListQuery },
    responses: coreResponses,
});

router.get('/users', async (req: Request, res: Response) => {
    const query = UserListQuery.safeParse(req.query);
    if (!query.success) {
        return res.status(400).json({ message: 'Invalid pagination parameters' });
    }

    if (!(await requireAdmin(req, res))) return;

    try {
        const response = await listAdministrationUsers({
            page: query.data.page,
            pageSize: query.data.page_size,
            search: query.data.search,
        });
        return res.status(200).json(response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/users',
    tags: ['Administration'],
    summary: 'Crée un utilisateur via le Core API',
    request: { body: jsonBodyRequest },
    responses: coreResponses,
});

router.post('/users', async (req: Request, res: Response) => {
    try {
        const response = await coreAdminUsersClient.adminPostUser(req.body, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'patch',
    path: '/bff/admin/users/{userId}',
    tags: ['Administration'],
    summary: 'Met à jour un utilisateur via le Core API',
    request: { params: UserIdParams, body: jsonBodyRequest },
    responses: coreResponses,
});

router.patch('/users/:userId', async (req: Request, res: Response) => {
    const userId = parsePositiveInteger(req.params.userId);
    if (!userId) {
        return invalidParam(res, 'userId');
    }

    try {
        const response = await coreAdminUsersClient.adminPatchUser(userId, req.body, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'patch',
    path: '/bff/admin/users/{userId}/password',
    tags: ['Administration'],
    summary: 'Modifie le mot de passe et révoque les sessions utilisateur',
    request: {
        params: UserIdParams,
        body: {
            required: true,
            content: { 'application/json': { schema: UserPasswordResetBody } },
        },
    },
    responses: coreResponses,
});

router.patch('/users/:userId/password', async (req: Request, res: Response) => {
    const userId = parsePositiveInteger(req.params.userId);
    if (!userId) {
        return invalidParam(res, 'userId');
    }

    const payload = UserPasswordResetBody.safeParse(req.body);
    if (!payload.success) {
        return res.status(400).json({
            message: 'The password must contain between 8 and 255 characters',
        });
    }

    if (!(await requireAdmin(req, res))) return;

    try {
        const updated = await resetAdministrationUserPassword(
            userId,
            payload.data.new_password,
        );

        if (!updated) {
            return res.status(404).json({ message: 'Unknown user' });
        }

        return res.status(204).send();
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/bff/admin/users/{userId}',
    tags: ['Administration'],
    summary: 'Supprime définitivement un utilisateur via le Core API',
    request: { params: UserIdParams },
    responses: coreResponses,
});

router.delete('/users/:userId', async (req: Request, res: Response) => {
    const userId = parsePositiveInteger(req.params.userId);
    if (!userId) {
        return invalidParam(res, 'userId');
    }

    if (!(await requireAdmin(req, res))) return;

    try {
        const response = await coreAdminUsersClient.adminDeleteUser(
            userId,
            coreRequestOptions(req),
        );
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/users/{userId}/roles',
    tags: ['Administration'],
    summary: 'Ajoute un rôle à un utilisateur via le Core API',
    request: { params: UserIdParams, body: jsonBodyRequest },
    responses: coreResponses,
});

router.post('/users/:userId/roles', async (req: Request, res: Response) => {
    const userId = parsePositiveInteger(req.params.userId);
    if (!userId) {
        return invalidParam(res, 'userId');
    }

    try {
        const response = await coreAdminUsersClient.adminAddRoleToUser(userId, req.body, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/bff/admin/users/{userId}/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Retire un rôle à un utilisateur via le Core API',
    request: { params: UserRoleParams },
    responses: coreResponses,
});

router.delete('/users/:userId/roles/:roleId', async (req: Request, res: Response) => {
    const userId = parsePositiveInteger(req.params.userId);
    const roleId = parsePositiveInteger(req.params.roleId);
    if (!userId) {
        return invalidParam(res, 'userId');
    }
    if (!roleId) {
        return invalidParam(res, 'roleId');
    }

    try {
        const response = await coreAdminUsersClient.adminDeleteUserRole(userId, roleId, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/roles',
    tags: ['Administration'],
    summary: 'Liste les rôles admin via le Core API',
    responses: coreResponses,
});

router.get('/roles', async (req: Request, res: Response) => {
    try {
        const response = await coreAdminRolesClient.adminGetRole(coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/roles',
    tags: ['Administration'],
    summary: 'Crée un rôle via le Core API',
    request: { body: jsonBodyRequest },
    responses: coreResponses,
});

router.post('/roles', async (req: Request, res: Response) => {
    try {
        const response = await coreAdminRolesClient.adminPostRole(req.body, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'put',
    path: '/bff/admin/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Remplace un rôle via le Core API',
    request: { params: RoleIdParams, body: jsonBodyRequest },
    responses: coreResponses,
});

router.put('/roles/:roleId', async (req: Request, res: Response) => {
    const roleId = parsePositiveInteger(req.params.roleId);
    if (!roleId) {
        return invalidParam(res, 'roleId');
    }

    try {
        const response = await coreAdminRolesClient.adminPutRole(roleId, req.body, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'patch',
    path: '/bff/admin/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Met à jour un rôle via le Core API',
    request: { params: RoleIdParams, body: jsonBodyRequest },
    responses: coreResponses,
});

router.patch('/roles/:roleId', async (req: Request, res: Response) => {
    const roleId = parsePositiveInteger(req.params.roleId);
    if (!roleId) {
        return invalidParam(res, 'roleId');
    }

    try {
        const response = await coreAdminRolesClient.adminPatchRole(roleId, req.body, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/bff/admin/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Supprime un rôle via le Core API',
    request: { params: RoleIdParams },
    responses: coreResponses,
});

router.delete('/roles/:roleId', async (req: Request, res: Response) => {
    const roleId = parsePositiveInteger(req.params.roleId);
    if (!roleId) {
        return invalidParam(res, 'roleId');
    }

    try {
        const response = await coreAdminRolesClient.adminDeleteRole(roleId, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/groups',
    tags: ['Administration'],
    summary: 'Liste les groupes via le Core API',
    responses: coreResponses,
});

router.get('/groups', async (req: Request, res: Response) => {
    try {
        const response = await coreGroupsClient.getGroups(coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/groups',
    tags: ['Administration'],
    summary: 'Crée un groupe via le Core API',
    request: { body: jsonBodyRequest },
    responses: coreResponses,
});

router.post('/groups', async (req: Request, res: Response) => {
    try {
        const response = await coreGroupsClient.postGroup(req.body, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/groups/{groupId}',
    tags: ['Administration'],
    summary: 'Récupère un groupe via le Core API',
    request: { params: GroupIdParams },
    responses: coreResponses,
});

router.get('/groups/:groupId', async (req: Request, res: Response) => {
    const groupId = parsePositiveInteger(req.params.groupId);
    if (!groupId) {
        return invalidParam(res, 'groupId');
    }

    try {
        const response = await coreGroupsClient.getGroup(groupId, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'patch',
    path: '/bff/admin/groups/{groupId}',
    tags: ['Administration'],
    summary: 'Met à jour le nom ou la description d’un groupe',
    request: {
        params: GroupIdParams,
        body: {
            required: true,
            content: { 'application/json': { schema: GroupPatchBody } },
        },
    },
    responses: coreResponses,
});

router.patch('/groups/:groupId', async (req: Request, res: Response) => {
    const groupId = parsePositiveInteger(req.params.groupId);
    if (!groupId) {
        return invalidParam(res, 'groupId');
    }

    const payload = GroupPatchBody.safeParse(req.body);
    if (!payload.success) {
        return res.status(400).json({ message: 'Invalid group data' });
    }
    if (!(await requireAdmin(req, res))) return;

    try {
        const group = await updateAdministrationGroup(groupId, payload.data);
        if (!group) {
            return res.status(404).json({ message: 'Unknown group' });
        }
        return res.status(200).json({ group });
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/bff/admin/groups/{groupId}',
    tags: ['Administration'],
    summary: 'Supprime un groupe via le Core API',
    request: { params: GroupIdParams },
    responses: coreResponses,
});

router.delete('/groups/:groupId', async (req: Request, res: Response) => {
    const groupId = parsePositiveInteger(req.params.groupId);
    if (!groupId) {
        return invalidParam(res, 'groupId');
    }

    try {
        const response = await coreGroupsClient.deleteGroup(groupId, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/groups/{groupId}/users',
    tags: ['Administration'],
    summary: 'Liste les utilisateurs d’un groupe via le Core API',
    request: { params: GroupIdParams },
    responses: coreResponses,
});

router.get('/groups/:groupId/users', async (req: Request, res: Response) => {
    const groupId = parsePositiveInteger(req.params.groupId);
    if (!groupId) {
        return invalidParam(res, 'groupId');
    }

    if (!(await requireAdmin(req, res))) return;

    try {
        const users = await listAdministrationGroupMembers(groupId);
        return res.status(200).json({ users });
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/groups/{groupId}/users',
    tags: ['Administration'],
    summary: 'Ajoute un utilisateur à un groupe via le Core API',
    request: { params: GroupIdParams, body: jsonBodyRequest },
    responses: coreResponses,
});

router.post('/groups/:groupId/users', async (req: Request, res: Response) => {
    const groupId = parsePositiveInteger(req.params.groupId);
    if (!groupId) {
        return invalidParam(res, 'groupId');
    }

    const userId = parsePositiveInteger(String(req.body?.user_id ?? ''));
    if (!userId) {
        return invalidParam(res, 'userId');
    }
    if (!(await requireAdmin(req, res))) return;

    try {
        const created = await addAdministrationGroupMember(groupId, userId);
        return res.status(created ? 201 : 200).json({ created });
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/bff/admin/groups/{groupId}/users/{userId}',
    tags: ['Administration'],
    summary: 'Retire un utilisateur d’un groupe via le Core API',
    request: { params: GroupUserParams },
    responses: coreResponses,
});

router.delete('/groups/:groupId/users/:userId', async (req: Request, res: Response) => {
    const groupId = parsePositiveInteger(req.params.groupId);
    const userId = parsePositiveInteger(req.params.userId);
    if (!groupId) {
        return invalidParam(res, 'groupId');
    }
    if (!userId) {
        return invalidParam(res, 'userId');
    }

    if (!(await requireAdmin(req, res))) return;

    try {
        const removed = await removeAdministrationGroupMember(groupId, userId);
        if (!removed) {
            return res.status(404).json({ message: 'Unknown group member' });
        }
        return res.status(204).send();
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/sessions',
    tags: ['Administration'],
    summary: 'Liste les sessions actives via le Core API',
    responses: coreResponses,
});

router.get('/sessions', async (req: Request, res: Response) => {
    try {
        const response = await coreSessionsClient.getActiveSessions(coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/sessions/history',
    tags: ['Administration'],
    summary: 'Récupère l’historique des sessions via le Core API',
    responses: coreResponses,
});

router.get('/sessions/history', async (req: Request, res: Response) => {
    try {
        const response = await coreSessionsClient.history(coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/sessions/refresh',
    tags: ['Administration'],
    summary: 'Rafraîchit une session via le Core API',
    request: { body: jsonBodyRequest },
    responses: coreResponses,
});

router.post('/sessions/refresh', async (req: Request, res: Response) => {
    try {
        const response = await coreSessionsClient.refresh(req.body, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/sessions/revoke',
    tags: ['Administration'],
    summary: 'Révoque une session via le Core API',
    request: { body: jsonBodyRequest },
    responses: coreResponses,
});

router.post('/sessions/revoke', async (req: Request, res: Response) => {
    try {
        const response = await coreSessionsClient.revoke(req.body, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

export default router;
