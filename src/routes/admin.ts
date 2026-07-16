import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { ApiErrorResponse, registry } from '../openapi-registry';
import {
    coreAdminRolesClient,
    coreAdminUsersClient,
    coreGroupsClient,
    coreSessionsClient,
} from '../clients/coreClient';
import {
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
const JsonBody = z.record(z.string(), z.unknown()).openapi('AdminJsonBody');
const CoreResponse = z.unknown().openapi('CoreResponse');

registry.register('AdminUserIdParams', UserIdParams);
registry.register('AdminRoleIdParams', RoleIdParams);
registry.register('AdminGroupIdParams', GroupIdParams);
registry.register('AdminUserRoleParams', UserRoleParams);
registry.register('AdminGroupUserParams', GroupUserParams);
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

    try {
        const response = await coreGroupsClient.getGroupUsers(groupId, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
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

    try {
        const response = await coreGroupsClient.addUserToGroup(groupId, req.body, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
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

    try {
        const response = await coreGroupsClient.removeUserFromGroup(groupId, userId, coreRequestOptions(req));
        return forwardCoreResponse(res, response);
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
