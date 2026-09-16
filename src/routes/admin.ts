import { AdministrationUsersPageSchema, AdministrationGroupSchema, AdministrationGroupMemberSchema, AdministrationRoleSchema, AdministrationSessionSchema } from './admin_schemas';
import { NextFunction, Request, Response, Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ApiErrorResponse, registry } from '../openapi-registry';
import { transmitAccessToken } from '../utils/cookieUtils';
import {
    coreAdminRolesClient,
    coreAdminUsersClient,
    coreGroupsClient,
    coreSessionsClient,
    coreUsersClient,
} from '../clients/coreClient';
import {
    bearerToken,
    coreRequestOptions,
    forwardCoreResponse,
    handleUnknownError,
    parsePositiveInteger,
} from './admin_helpers';

const router = Router();

// Un groupe de la mairie ne dépasse pas la page maximale de Core API (500).
const MAX_GROUP_MEMBERS = 500;

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

    } catch {
        // Ne pas renvoyer le détail du parsing (JSON.parse, base64) au client.
        res.status(401).json({ message: 'Invalid or expired session token' });
        return false;
    }

    try {
        // Le rôle vient de Core API (GET /api/v1/user/me/), qui fait autorité sur les rôles.
        const { data } = await coreUsersClient.getMe(coreRequestOptions(req));

        if (data.role?.trim().toLowerCase() !== 'admin') {
            res.status(403).json({ message: 'Administrator role required' });
            return false;
        }

        return true;
    } catch (error) {
        handleUnknownError(res, error);
        return false;
    }
}

// Toutes les routes /bff/admin exigent le rôle admin, vérifié localement : Core API v1.1.1 ne protège ses
// routes /admin que par le JWT (AdminMiddleware désactivé), et groupes/sessions n'y sont pas réservés aux admins.
// La vérification précède la validation des paramètres pour ne rien révéler à un appelant non autorisé.
router.use(async (req: Request, res: Response, next: NextFunction) => {
    if (await requireAdmin(req, res)) next();
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/users',
    tags: ['Administration'],
    summary: 'Liste les utilisateurs administrables, 20 éléments maximum par page',
    request: { query: UserListQuery },
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: AdministrationUsersPageSchema } } } },
});

router.get('/users', async (req: Request, res: Response) => {
    const query = UserListQuery.safeParse(req.query);
    if (!query.success) {
        return res.status(400).json({ message: 'Invalid pagination parameters' });
    }


    try {
        const response = await coreAdminUsersClient.adminListUsers({
            page: query.data.page,
            page_size: query.data.page_size,
            ...(query.data.search ? { search: query.data.search } : {}),
        }, coreRequestOptions(req));
        return res.status(200).json(response.data);
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


    try {
        // Core réinitialise le mot de passe, lève la première connexion et révoque les sessions actives.
        await coreAdminUsersClient.adminResetUserPassword(
            userId,
            { new_password: payload.data.new_password },
            coreRequestOptions(req),
        );

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
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: z.object({ roles: z.array(AdministrationRoleSchema) }) } } } },
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
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: z.object({ groups: z.array(AdministrationGroupSchema) }) } } } },
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
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: z.object({ group: AdministrationGroupSchema }) } } } },
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

    try {
        const response = await coreGroupsClient.patchGroup(groupId, payload.data, coreRequestOptions(req));
        return res.status(200).json({ group: response.data });
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
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: z.object({ users: z.array(AdministrationGroupMemberSchema) }) } } } },
});

router.get('/groups/:groupId/users', async (req: Request, res: Response) => {
    const groupId = parsePositiveInteger(req.params.groupId);
    if (!groupId) {
        return invalidParam(res, 'groupId');
    }


    try {
        // La liste d'administration filtrée par groupe porte les mêmes champs que la liste globale.
        const response = await coreAdminUsersClient.adminListUsers(
            { group_id: groupId, page_size: MAX_GROUP_MEMBERS },
            coreRequestOptions(req),
        );
        const users = response.data.users.map(({ roles: _roles, ...member }) => member);
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

    try {
        // Core ne distingue pas l'ajout d'un doublon : l'appartenance est lue avant d'ajouter.
        const members = await coreGroupsClient.getGroupUsers(groupId, coreRequestOptions(req));
        if (members.data.users.includes(userId)) {
            return res.status(200).json({ created: false });
        }

        await coreGroupsClient.addUserToGroup(groupId, { group_id: groupId, user_id: userId }, coreRequestOptions(req));
        return res.status(201).json({ created: true });
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
        const members = await coreGroupsClient.getGroupUsers(groupId, coreRequestOptions(req));
        if (!members.data.users.includes(userId)) {
            return res.status(404).json({ message: 'Unknown group member' });
        }

        await coreGroupsClient.removeUserFromGroup(groupId, userId, coreRequestOptions(req));
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
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: z.object({ sessions: z.array(AdministrationSessionSchema) }) } } } },
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
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: z.object({ sessions: z.array(AdministrationSessionSchema) }) } } } },
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
    description: 'Le JWT rafraîchi est renvoyé dans l’en-tête Authorization et remplace le cookie accessToken.',
    request: { body: jsonBodyRequest },
    responses: {
        ...coreResponses,
        200: {
            description: 'Session rafraîchie',
            headers: { Authorization: { description: 'Bearer <access token>', schema: { type: 'string' } } },
            content: { 'application/json': { schema: z.object({ message: z.string().openapi({ example: 'JWT refreshed successfully' }) }) } },
        },
    },
});

router.post('/sessions/refresh', async (req: Request, res: Response) => {
    try {
        const response = await coreSessionsClient.refresh(req.body, coreRequestOptions(req));
        // Core API renvoie le JWT rafraîchi dans l'en-tête Authorization : il remplace le cookie de session,
        // sinon le client continuerait avec l'ancien jeton.
        const authorizationHeader = response.headers?.authorization ?? response.headers?.Authorization;
        if (!transmitAccessToken(res, typeof authorizationHeader === 'string' ? authorizationHeader : undefined)) {
            return res.status(502).json({ message: 'Core API did not return a Bearer token in the Authorization header' });
        }
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
