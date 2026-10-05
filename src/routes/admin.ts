import { AdministrationUsersPageSchema, AdministrationGroupSchema, AdministrationGroupMemberSchema, AdministrationRoleSchema, AdministrationSessionSchema } from './admin_schemas';
import {
    asCaller,
    bearerToken,
    callUpstream,
    HttpError,
    INVALID_SESSION_MESSAGE,
    noStore,
    parseRequest,
    upstreamError,
    validationError,
} from '@mairie360/bffs-lib';
import { NextFunction, Request, Response, Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ErrorResponse, registry } from '../openapi-registry';
import {
    coreAdminRolesClient,
    coreAdminUsersClient,
    coreGroupsClient,
    coreSessionsClient,
    coreUsersClient,
} from '../clients/coreClient';
import { forwardCoreResponse, whitelist } from './admin_helpers';

const router = Router();

// A town hall group never exceeds Core API's largest page (500).
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
// DELETE routes get their own example ids (seeded by init-test.sql): a scan replaying the examples
// must not delete the resource that the other routes of the same path read or update.
const DeletedUserIdParams = z.object({
    userId: z.coerce.number().int().positive().openapi({ example: 11 }),
});
const DeletedRoleIdParams = z.object({
    roleId: z.coerce.number().int().positive().openapi({ example: 11 }),
});
const DeletedGroupIdParams = z.object({
    groupId: z.coerce.number().int().positive().openapi({ example: 11 }),
});
const UserListQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    page_size: z.coerce.number().int().min(1).max(20).default(20),
    search: z.string().trim().max(100).optional(),
}).openapi('AdminUserListQuery');
// Stored labels are rendered by the fronts: `<` and `>` are refused, as Core API does.
const noMarkup = (schema: z.ZodString) => schema.regex(/^[^<>]*$/, 'Must not contain < or >');
const GroupName = noMarkup(z.string().trim().min(1).max(64)).openapi({ example: 'Culture' });
const GroupDescription = noMarkup(z.string().trim().max(2_000)).openapi({ example: 'Culture department' });
// Update examples name the seeded resource itself, so a replayed example never hits a unique name.
const GroupPatchBody = z.object({
    name: GroupName.optional().openapi({ example: 'Scan group' }),
    description: GroupDescription.optional().openapi({ example: 'Group edited by the ZAP scan' }),
}).refine((value) => value.name !== undefined || value.description !== undefined, {
    message: 'At least one field is required',
}).openapi('AdminGroupPatchBody');
const UserPasswordResetBody = z.object({
    new_password: z.string().min(8).max(255).openapi({ example: 'Temporary-Passw0rd' }),
}).openapi('AdminUserPasswordResetBody');
// Request bodies mirror the Core API views they are forwarded to (@mairie360/core-api-openapi); unknown
// fields are stripped. The examples are valid values, so a generated request (Swagger UI, ZAP) is accepted.
const atLeastOneField = (value: Record<string, unknown>) => Object.values(value).some((field) => field !== undefined);
const Email = z.string().trim().email().max(320).openapi({ example: 'jane.doe@mairie360.fr' });
const PersonName = noMarkup(z.string().trim().min(1).max(64));
const PhoneNumber = z.string().regex(/^\d{10,15}$/).openapi({ example: '0612345678' });
const UserCreateBody = z.object({
    email: Email,
    first_name: PersonName.openapi({ example: 'Jane' }),
    last_name: PersonName.openapi({ example: 'Doe' }),
    password: z.string().min(8).max(255).openapi({ example: 'Temporary-Passw0rd' }),
    phone_number: PhoneNumber.nullable().optional(),
}).openapi('AdminUserCreateBody');
// The password is not accepted here: Core writes it without any length check, the
// PATCH /bff/admin/users/{userId}/password route enforces the policy and revokes the sessions.
const UserPatchBody = z.object({
    email: Email.nullable().optional().openapi({ example: 'scan-target@mairie360.fr' }),
    first_name: PersonName.nullable().optional().openapi({ example: 'Scan' }),
    last_name: PersonName.nullable().optional().openapi({ example: 'Target' }),
    phone_number: PhoneNumber.nullable().optional(),
}).refine(atLeastOneField, { message: 'At least one field is required' }).openapi('AdminUserPatchBody');
const UserRoleBody = z.object({
    role_id: z.number().int().positive().openapi({ example: 3 }),
    user_id: z.number().int().positive().optional().openapi({ description: 'Must match the path userId when sent' }),
}).openapi('AdminUserRoleBody');
const RoleName = noMarkup(z.string().trim().min(1).max(64)).openapi({ example: 'Agent' });
const RoleDescription = noMarkup(z.string().trim().max(2_000)).openapi({ example: 'Municipal agent' });
const RoleWriteBody = z.object({
    name: RoleName,
    description: RoleDescription,
    can_be_deleted: z.boolean().nullable().optional().openapi({ example: true }),
}).openapi('AdminRoleWriteBody');
// Not RoleWriteBody.extend(): it would be published as an allOf, which generated clients fill poorly.
const RoleReplaceBody = z.object({
    name: RoleName.openapi({ example: 'Scan role' }),
    description: RoleDescription.openapi({ example: 'Role edited by the ZAP scan' }),
    can_be_deleted: z.boolean().nullable().optional().openapi({ example: true }),
}).openapi('AdminRoleReplaceBody');
const RolePatchBody = z.object({
    name: RoleName.nullable().optional().openapi({ example: 'Scan role' }),
    description: RoleDescription.nullable().optional().openapi({ example: 'Role edited by the ZAP scan' }),
    can_be_deleted: z.boolean().nullable().optional().openapi({ example: true }),
}).refine(atLeastOneField, { message: 'At least one field is required' }).openapi('AdminRolePatchBody');
const GroupCreateBody = z.object({
    name: GroupName,
    description: GroupDescription,
}).openapi('AdminGroupCreateBody');
const GroupUserBody = z.object({
    user_id: z.number().int().positive().openapi({ example: 42 }),
    group_id: z.number().int().positive().optional().openapi({ description: 'Must match the path groupId when sent' }),
}).openapi('AdminGroupUserBody');
const RefreshToken = z.string().min(1).max(512);
const SessionRevokeBody = z.object({
    refresh_token: RefreshToken.openapi({ example: 'opaque-revoked-token' }),
}).openapi('AdminSessionRevokeBody');
const CoreResponse = z.unknown().openapi('CoreResponse');
// 200 bodies of the read routes: Core answers are reduced to these fields (whitelist), nothing else is relayed.
const RolesListSchema = z.object({ roles: z.array(AdministrationRoleSchema) });
const GroupsListSchema = z.object({ groups: z.array(AdministrationGroupSchema) });
const GroupDetailSchema = z.object({ group: AdministrationGroupSchema });
const GroupMembersSchema = z.object({ users: z.array(AdministrationGroupMemberSchema) });
const SessionsListSchema = z.object({ sessions: z.array(AdministrationSessionSchema) });

registry.register('AdminUserIdParams', UserIdParams);
registry.register('AdminRoleIdParams', RoleIdParams);
registry.register('AdminGroupIdParams', GroupIdParams);
registry.register('AdminUserRoleParams', UserRoleParams);
registry.register('AdminGroupUserParams', GroupUserParams);
registry.register('AdminUserListQuery', UserListQuery);
registry.register('AdminGroupPatchBody', GroupPatchBody);
registry.register('AdminUserPasswordResetBody', UserPasswordResetBody);
registry.register('AdminUserCreateBody', UserCreateBody);
registry.register('AdminUserPatchBody', UserPatchBody);
registry.register('AdminUserRoleBody', UserRoleBody);
registry.register('AdminRoleWriteBody', RoleWriteBody);
registry.register('AdminRoleReplaceBody', RoleReplaceBody);
registry.register('AdminRolePatchBody', RolePatchBody);
registry.register('AdminGroupCreateBody', GroupCreateBody);
registry.register('AdminGroupUserBody', GroupUserBody);
registry.register('AdminSessionRevokeBody', SessionRevokeBody);
registry.register('CoreResponse', CoreResponse);

function jsonBodyRequest(schema: z.ZodType) {
    return { required: true, content: { 'application/json': { schema } } };
}

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
                schema: ErrorResponse,
            },
        },
    },
    401: {
        description: 'Non authentifié',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
    403: {
        description: 'Accès refusé',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
    404: {
        description: 'Introuvable',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
    500: {
        description: 'Unexpected server error; the cause is only logged',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
    502: {
        description: 'Core API unavailable, failed or answered an undeclared error',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
    503: {
        description: 'Instance misconfigured: CORE_API_URL or JWT_SECRET is not set',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
};

// Writes also relay Core's 409 (unique name or e-mail already taken, resource still referenced).
const coreWriteResponses = {
    ...coreResponses,
    409: {
        description: 'Conflict with the current state of the resource',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
};

// Core 4xx kept by the admin routes (the statuses of coreResponses / coreWriteResponses); anything else is a 502.
const READ_STATUSES = [400, 401, 403, 404] as const;
const WRITE_STATUSES = [...READ_STATUSES, 409] as const;

// Throws 401 (no or invalid session), 503 (JWT_SECRET or CORE_API_URL missing) or 403 (not an administrator).
async function requireAdmin(req: Request): Promise<void> {
    // The `Authorization: Bearer` header only (no cookie, no other header), verified locally below.
    const token = bearerToken(req);
    if (token === undefined) {
        throw new HttpError(401, INVALID_SESSION_MESSAGE);
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        // A misconfigured instance, not a server bug: 503 like a missing upstream URL. The entry point refuses
        // to start without JWT_SECRET, so this only happens when the app is mounted elsewhere (tests).
        throw new HttpError(503, 'The administrator session check is not configured.');
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
            throw new Error('Invalid token');
        }
    } catch {
        // Never send the parsing detail (JSON.parse, base64) to the client.
        throw new HttpError(401, 'Invalid or expired session token');
    }

    // The role comes from Core API (GET /api/v1/user/me/), the authority on roles. Idempotent read: retried once.
    const caller = asCaller('CORE_API', req);
    const { data: { role } } = await callUpstream('CORE_API', () => coreUsersClient.getMe(caller), { declared: READ_STATUSES, retry: true });

    if (role?.trim().toLowerCase() !== 'admin') {
        throw new HttpError(403, 'Administrator role required');
    }
}

// Every /bff/admin route requires the admin role, checked locally as defence in depth: Core API v1.1.1 only
// protected its /admin routes with the JWT (AdminMiddleware disabled), and groups/sessions are not admin-only there.
// The check runs before parameter validation so that nothing is revealed to an unauthorized caller.
// Administration answers are session-bound: never cached by a proxy or the browser.
router.use(noStore);
router.use(async (req: Request, _res: Response, next: NextFunction) => {
    await requireAdmin(req);
    next();
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
    const query = parseRequest(UserListQuery, req.query, 'query');
    const caller = asCaller('CORE_API', req);
    const params = { page: query.page, page_size: query.page_size, ...(query.search ? { search: query.search } : {}) };

    const response = await callUpstream('CORE_API', () => coreAdminUsersClient.adminListUsers(params, caller), { declared: READ_STATUSES, retry: true });
    return res.status(200).json(whitelist(AdministrationUsersPageSchema, response.data));
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/users',
    tags: ['Administration'],
    summary: 'Crée un utilisateur via le Core API',
    request: { body: jsonBodyRequest(UserCreateBody) },
    responses: coreWriteResponses,
});

router.post('/users', async (req: Request, res: Response) => {
    const body = parseRequest(UserCreateBody, req.body, 'body');

    try {
        const response = await coreAdminUsersClient.adminPostUser(body, asCaller('CORE_API', req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'patch',
    path: '/bff/admin/users/{userId}',
    tags: ['Administration'],
    summary: 'Met à jour un utilisateur via le Core API',
    request: { params: UserIdParams, body: jsonBodyRequest(UserPatchBody) },
    responses: coreWriteResponses,
});

router.patch('/users/:userId', async (req: Request, res: Response) => {
    const { userId } = parseRequest(UserIdParams, req.params, 'params');

    const body = parseRequest(UserPatchBody, req.body, 'body');

    try {
        const response = await coreAdminUsersClient.adminPatchUser(userId, body, asCaller('CORE_API', req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
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
    responses: coreWriteResponses,
});

router.patch('/users/:userId/password', async (req: Request, res: Response) => {
    const { userId } = parseRequest(UserIdParams, req.params, 'params');

    const payload = parseRequest(UserPasswordResetBody, req.body, 'body');

    try {
        // Core resets the password, clears the first sign-in flag and revokes the active sessions.
        await coreAdminUsersClient.adminResetUserPassword(
            userId,
            { new_password: payload.new_password },
            asCaller('CORE_API', req),
        );

        return res.status(204).send();
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/bff/admin/users/{userId}',
    tags: ['Administration'],
    summary: 'Supprime définitivement un utilisateur via le Core API',
    request: { params: DeletedUserIdParams },
    responses: coreWriteResponses,
});

router.delete('/users/:userId', async (req: Request, res: Response) => {
    const { userId } = parseRequest(UserIdParams, req.params, 'params');

    try {
        const response = await coreAdminUsersClient.adminDeleteUser(
            userId,
            asCaller('CORE_API', req),
        );
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/users/{userId}/roles',
    tags: ['Administration'],
    summary: 'Ajoute un rôle à un utilisateur via le Core API',
    request: { params: UserIdParams, body: jsonBodyRequest(UserRoleBody) },
    responses: coreWriteResponses,
});

router.post('/users/:userId/roles', async (req: Request, res: Response) => {
    const { userId } = parseRequest(UserIdParams, req.params, 'params');

    const body = parseRequest(UserRoleBody, req.body, 'body');
    // Core trusts the user_id of the body, not the one of its path: it must name the path user.
    if (body.user_id !== undefined && body.user_id !== userId) {
        throw validationError('body', [{ path: ['user_id'], message: 'Must match the path userId' }]);
    }

    try {
        const response = await coreAdminUsersClient.adminAddRoleToUser(
            userId,
            { role_id: body.role_id, user_id: userId },
            asCaller('CORE_API', req),
        );
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/bff/admin/users/{userId}/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Retire un rôle à un utilisateur via le Core API',
    request: { params: UserRoleParams },
    responses: coreWriteResponses,
});

router.delete('/users/:userId/roles/:roleId', async (req: Request, res: Response) => {
    const { userId, roleId } = parseRequest(UserRoleParams, req.params, 'params');

    try {
        const response = await coreAdminUsersClient.adminDeleteUserRole(userId, roleId, asCaller('CORE_API', req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/roles',
    tags: ['Administration'],
    summary: 'Liste les rôles admin via le Core API',
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: RolesListSchema } } } },
});

router.get('/roles', async (req: Request, res: Response) => {
    const response = await callUpstream('CORE_API', () => coreAdminRolesClient.adminGetRole(asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return forwardCoreResponse(res, response, RolesListSchema);
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/roles',
    tags: ['Administration'],
    summary: 'Crée un rôle via le Core API',
    request: { body: jsonBodyRequest(RoleWriteBody) },
    responses: coreWriteResponses,
});

router.post('/roles', async (req: Request, res: Response) => {
    const body = parseRequest(RoleWriteBody, req.body, 'body');

    try {
        const response = await coreAdminRolesClient.adminPostRole(body, asCaller('CORE_API', req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'put',
    path: '/bff/admin/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Remplace un rôle via le Core API',
    request: { params: RoleIdParams, body: jsonBodyRequest(RoleReplaceBody) },
    responses: coreWriteResponses,
});

router.put('/roles/:roleId', async (req: Request, res: Response) => {
    const { roleId } = parseRequest(RoleIdParams, req.params, 'params');

    const body = parseRequest(RoleReplaceBody, req.body, 'body');

    try {
        const response = await coreAdminRolesClient.adminPutRole(roleId, body, asCaller('CORE_API', req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'patch',
    path: '/bff/admin/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Met à jour un rôle via le Core API',
    request: { params: RoleIdParams, body: jsonBodyRequest(RolePatchBody) },
    responses: coreWriteResponses,
});

router.patch('/roles/:roleId', async (req: Request, res: Response) => {
    const { roleId } = parseRequest(RoleIdParams, req.params, 'params');

    const body = parseRequest(RolePatchBody, req.body, 'body');

    try {
        const response = await coreAdminRolesClient.adminPatchRole(roleId, body, asCaller('CORE_API', req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/bff/admin/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Supprime un rôle via le Core API',
    request: { params: DeletedRoleIdParams },
    responses: coreWriteResponses,
});

router.delete('/roles/:roleId', async (req: Request, res: Response) => {
    const { roleId } = parseRequest(RoleIdParams, req.params, 'params');

    try {
        const response = await coreAdminRolesClient.adminDeleteRole(roleId, asCaller('CORE_API', req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/groups',
    tags: ['Administration'],
    summary: 'Liste les groupes via le Core API',
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: GroupsListSchema } } } },
});

router.get('/groups', async (req: Request, res: Response) => {
    const response = await callUpstream('CORE_API', () => coreGroupsClient.getGroups(asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return forwardCoreResponse(res, response, GroupsListSchema);
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/groups',
    tags: ['Administration'],
    summary: 'Crée un groupe via le Core API',
    request: { body: jsonBodyRequest(GroupCreateBody) },
    responses: coreWriteResponses,
});

router.post('/groups', async (req: Request, res: Response) => {
    const body = parseRequest(GroupCreateBody, req.body, 'body');

    try {
        const response = await coreGroupsClient.postGroup(body, asCaller('CORE_API', req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/groups/{groupId}',
    tags: ['Administration'],
    summary: 'Récupère un groupe via le Core API',
    request: { params: GroupIdParams },
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: GroupDetailSchema } } } },
});

router.get('/groups/:groupId', async (req: Request, res: Response) => {
    const { groupId } = parseRequest(GroupIdParams, req.params, 'params');

    const response = await callUpstream('CORE_API', () => coreGroupsClient.getGroup(groupId, asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return forwardCoreResponse(res, response, GroupDetailSchema);
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
    responses: coreWriteResponses,
});

router.patch('/groups/:groupId', async (req: Request, res: Response) => {
    const { groupId } = parseRequest(GroupIdParams, req.params, 'params');

    const payload = parseRequest(GroupPatchBody, req.body, 'body');

    try {
        const response = await coreGroupsClient.patchGroup(groupId, payload, asCaller('CORE_API', req));
        return res.status(200).json({ group: response.data });
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/bff/admin/groups/{groupId}',
    tags: ['Administration'],
    summary: 'Supprime un groupe via le Core API',
    request: { params: DeletedGroupIdParams },
    responses: coreWriteResponses,
});

router.delete('/groups/:groupId', async (req: Request, res: Response) => {
    const { groupId } = parseRequest(GroupIdParams, req.params, 'params');

    try {
        const response = await coreGroupsClient.deleteGroup(groupId, asCaller('CORE_API', req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/groups/{groupId}/users',
    tags: ['Administration'],
    summary: 'Liste les utilisateurs d’un groupe via le Core API',
    request: { params: GroupIdParams },
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: GroupMembersSchema } } } },
});

router.get('/groups/:groupId/users', async (req: Request, res: Response) => {
    const { groupId } = parseRequest(GroupIdParams, req.params, 'params');
    const caller = asCaller('CORE_API', req);

    // The administration list filtered by group carries the same fields as the global list.
    const response = await callUpstream(
        'CORE_API',
        () => coreAdminUsersClient.adminListUsers({ group_id: groupId, page_size: MAX_GROUP_MEMBERS }, caller),
        { declared: READ_STATUSES, retry: true },
    );
    return res.status(200).json(whitelist(GroupMembersSchema, { users: response.data.users }));
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/groups/{groupId}/users',
    tags: ['Administration'],
    summary: 'Ajoute un utilisateur à un groupe via le Core API',
    request: { params: GroupIdParams, body: jsonBodyRequest(GroupUserBody) },
    responses: coreWriteResponses,
});

router.post('/groups/:groupId/users', async (req: Request, res: Response) => {
    const { groupId } = parseRequest(GroupIdParams, req.params, 'params');

    const body = parseRequest(GroupUserBody, req.body, 'body');
    if (body.group_id !== undefined && body.group_id !== groupId) {
        throw validationError('body', [{ path: ['group_id'], message: 'Must match the path groupId' }]);
    }
    const userId = body.user_id;

    try {
        // Core does not tell a duplicate addition apart: the membership is read before adding.
        const members = await coreGroupsClient.getGroupUsers(groupId, asCaller('CORE_API', req));
        if (members.data.users.includes(userId)) {
            return res.status(200).json({ created: false });
        }

        await coreGroupsClient.addUserToGroup(groupId, { group_id: groupId, user_id: userId }, asCaller('CORE_API', req));
        return res.status(201).json({ created: true });
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/bff/admin/groups/{groupId}/users/{userId}',
    tags: ['Administration'],
    summary: 'Retire un utilisateur d’un groupe via le Core API',
    request: { params: GroupUserParams },
    responses: coreWriteResponses,
});

router.delete('/groups/:groupId/users/:userId', async (req: Request, res: Response) => {
    const { groupId, userId } = parseRequest(GroupUserParams, req.params, 'params');

    try {
        const members = await coreGroupsClient.getGroupUsers(groupId, asCaller('CORE_API', req));
        if (!members.data.users.includes(userId)) {
            throw new HttpError(404, 'Unknown group member');
        }

        await coreGroupsClient.removeUserFromGroup(groupId, userId, asCaller('CORE_API', req));
        return res.status(204).send();
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/sessions',
    tags: ['Administration'],
    summary: 'Liste les sessions actives via le Core API',
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: SessionsListSchema } } } },
});

router.get('/sessions', async (req: Request, res: Response) => {
    const response = await callUpstream('CORE_API', () => coreSessionsClient.getActiveSessions(asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return forwardCoreResponse(res, response, SessionsListSchema);
});

registry.registerPath({
    method: 'get',
    path: '/bff/admin/sessions/history',
    tags: ['Administration'],
    summary: 'Récupère l’historique des sessions via le Core API',
    responses: { ...coreResponses, 200: { description: 'Données de l’administration', content: { 'application/json': { schema: SessionsListSchema } } } },
});

router.get('/sessions/history', async (req: Request, res: Response) => {
    const response = await callUpstream('CORE_API', () => coreSessionsClient.history(asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return forwardCoreResponse(res, response, SessionsListSchema);
});

registry.registerPath({
    method: 'post',
    path: '/bff/admin/sessions/revoke',
    tags: ['Administration'],
    summary: 'Revokes a session through Core API',
    description: 'Core POST /api/v1/sessions/revoke: Core only revokes a session of the caller (the refresh token must belong to the JWT user). '
        + 'Refreshing a session from the administration console is not offered: it used to replace the administrator\'s own accessToken cookie.',
    request: { body: jsonBodyRequest(SessionRevokeBody) },
    responses: coreWriteResponses,
});

router.post('/sessions/revoke', async (req: Request, res: Response) => {
    const body = parseRequest(SessionRevokeBody, req.body, 'body');

    try {
        const response = await coreSessionsClient.revoke(body, asCaller('CORE_API', req));
        return forwardCoreResponse(res, response);
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

export default router;
