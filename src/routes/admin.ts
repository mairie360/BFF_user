import { AdministrationProjectsWithoutGroupSchema, AdministrationUsersPageSchema, AdministrationGroupSchema, AdministrationGroupMemberSchema, AdministrationRoleSchema, AdministrationSessionSchema, TwoFactorPolicySchema, TwoFactorPolicyUpdateSchema } from './admin_schemas';
import {
    asCaller,
    bearerToken,
    callUpstream,
    HttpError,
    INVALID_SESSION_MESSAGE,
    noStore,
    parseRequest,
    sessionKeysFromEnv,
    type SessionKeys,
    upstreamError,
    validationError,
    verifySessionToken,
    canonicalRole,
    isAdminRole,
} from '@mairie360/bffs-lib';
import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { CoreApiRateLimited, ErrorResponse, PASSWORD_MIN_LENGTH, registry } from '../openapi-registry';
import {
    CORE_LARGEST_PAGE,
    CORE_MAX_LIMIT,
    CORE_MAX_OFFSET,
    coreAdminRolesClient,
    coreAdminUsersClient,
    coreGroupsClient,
    coreSessionsClient,
    coreTwoFactorPolicyClient,
    coreUsersClient,
} from '../clients/coreClient';
import { forwardCoreResponse, whitelist } from './admin_helpers';
import { projectBff } from '../clients/projectBffClient';

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
// Page of a Core list, chosen by the front and forwarded as is; the bounds are Core's. Without them, Core
// answers its first page of 100 items.
const CorePageQuery = z.object({
    limit: z.coerce.number().int().min(1).max(CORE_MAX_LIMIT).optional().openapi({ example: 100 }),
    offset: z.coerce.number().int().min(0).max(CORE_MAX_OFFSET).optional().openapi({ example: 0 }),
}).strict().openapi('CorePageQuery');
const corePage = (req: Request) => {
    const { limit, offset } = parseRequest(CorePageQuery, req.query, 'query');
    return { ...(limit === undefined ? {} : { limit }), ...(offset === undefined ? {} : { offset }) };
};
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
    new_password: z.string().min(PASSWORD_MIN_LENGTH).max(255).openapi({ example: 'Temporary-Ecole-Pont-2026' }),
}).openapi('AdminUserPasswordResetBody');
// Request bodies mirror the Core API views they are forwarded to (@mairie360/core-api-openapi); unknown
// fields are stripped. The examples are valid values, so a generated request (Swagger UI, ZAP) is accepted.
const atLeastOneField = (value: Record<string, unknown>) => Object.values(value).some((field) => field !== undefined);
const Email = z.string().trim().email().max(320).openapi({ example: 'jane.doe@mairie360.fr' });
const PersonName = noMarkup(z.string().trim().min(1).max(64));
// Core API (MAIR-480) parses the number as typed against `phone_country`, or its own `+` prefix in E.164
// (400 otherwise), and clears it on `null` or `""`; same characters and length as Core.
const PhoneNumber = z.string().max(32)
    .regex(/^(?:\+?[\d\s.()-]+)?$/, 'Expected a phone number: digits, spaces, `.`, `-`, `(`, `)` and a leading `+`')
    .openapi({ example: '06 12 34 56 78' });
// Country of a national number (ISO 3166-1 alpha-2); Core refuses it without `phone_number`.
const PhoneCountry = z.string().regex(/^[A-Z]{2}$/, 'Expected an ISO 3166-1 alpha-2 code').openapi({ example: 'FR' });
const UserCreateBody = z.object({
    email: Email,
    first_name: PersonName.openapi({ example: 'Jane' }),
    last_name: PersonName.openapi({ example: 'Doe' }),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(255).openapi({ example: 'Temporary-Ecole-Pont-2026' }),
    phone_number: PhoneNumber.nullable().optional(),
    phone_country: PhoneCountry.nullable().optional(),
}).openapi('AdminUserCreateBody');
// The password is not accepted here: Core writes it without any length check, the
// PATCH /admin/users/{userId}/password route enforces the policy and revokes the sessions.
const UserPatchBody = z.object({
    email: Email.nullable().optional().openapi({ example: 'scan-target@mairie360.fr' }),
    first_name: PersonName.nullable().optional().openapi({ example: 'Scan' }),
    last_name: PersonName.nullable().optional().openapi({ example: 'Target' }),
    phone_number: PhoneNumber.nullable().optional(),
    phone_country: PhoneCountry.nullable().optional(),
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
        description: 'Response of Core API',
        content: {
            'application/json': {
                schema: CoreResponse,
            },
        },
    },
    201: {
        description: 'Created by Core API',
        content: {
            'application/json': {
                schema: CoreResponse,
            },
        },
    },
    204: {
        description: 'No content returned by Core API',
    },
    400: {
        description: 'Core API error',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
    401: {
        description: 'Not authenticated',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
    403: {
        description: 'Access denied',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
    404: {
        description: 'Not found',
        content: {
            'application/json': {
                schema: ErrorResponse,
            },
        },
    },
    429: CoreApiRateLimited,
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
        description: 'Instance misconfigured: CORE_API_URL or the session key (JWT_PUBLIC_KEY) is not set or invalid',
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

// Throws 401 (no or invalid session), 503 (no session key or no CORE_API_URL) or 403 (none of the roles is allowed).
// Roles are recognised with the lib's rule (`isAdminRole`, `canonicalRole`): "Administrateur" and `ROLE_ADMIN` are administrators.
async function requireRole(req: Request, isAllowed: (role: unknown) => boolean, refusal: string): Promise<void> {
    // The `Authorization: Bearer` header only (no cookie, no other header), verified locally below.
    const token = bearerToken(req);
    if (token === undefined) {
        throw new HttpError(401, INVALID_SESSION_MESSAGE);
    }

    // Core's public key `JWT_PUBLIC_KEY` (MAIR-680), plus `JWT_SECRET` while the HS256 transition lasts.
    let keys: SessionKeys | undefined;
    try {
        keys = sessionKeysFromEnv();
    } catch {
        keys = undefined;
    }

    if (keys === undefined) {
        // A misconfigured instance, not a server bug: 503 like a missing upstream URL. The entry point refuses
        // to start without a session key, so this only happens when the app is mounted elsewhere (tests).
        throw new HttpError(503, 'The administrator session check is not configured.');
    }

    // EdDSA signature with Core's key (`kid`, `iss`, `aud`), or HS256 only while JWT_SECRET is set, expiry and a
    // positive integer `sub` (`@mairie360/bffs-lib`, the checks of Core): a forged or expired token gets its 401
    // without any Core call, and never learns which check failed.
    verifySessionToken(token, keys);

    // The roles come from Core API (GET /api/v1/user/me/), the authority on roles. Idempotent read: retried once.
    // Core >= 2.0.0 lists every role in `roles` (`role` is only the first one) and, like its own admin guard,
    // any `admin` role grants the access.
    const caller = asCaller('CORE_API', req);
    const { data: { roles } } = await callUpstream('CORE_API', () => coreUsersClient.getMe(caller), { declared: READ_STATUSES, retry: true });

    if (!Array.isArray(roles) || !roles.some(isAllowed)) {
        throw new HttpError(403, refusal);
    }
}

const requireAdmin = (req: Request) => requireRole(req, isAdminRole, 'Administrator role required');

// Every /admin route requires a role checked locally (the admin role, except the projects without a group below) as defence in depth: Core API v1.1.1 only
// protected its /admin routes with the JWT (AdminMiddleware disabled), and groups/sessions are not admin-only there.
// The check runs before parameter validation so that nothing is revealed to an unauthorized caller.
// Administration answers are session-bound: never cached by a proxy or the browser.
router.use(noStore);

// Projects left without a group (created before groups were required, or their group was deleted in Core API), for the
// groups tab. Like BFF_Project, it accepts the Admin and Maire roles, while every other /admin route stays Admin only:
// mounted before the admin guard below, with its own role check.
registry.registerPath({
    method: 'get',
    path: '/admin/projects-without-group',
    tags: ['Administration'],
    summary: 'List the projects without a group through BFF_Project',
    responses: {
        200: { description: 'The projects without a group', content: { 'application/json': { schema: AdministrationProjectsWithoutGroupSchema } } },
        401: { description: 'Not authenticated', content: { 'application/json': { schema: ErrorResponse } } },
        403: { description: 'Access denied', content: { 'application/json': { schema: ErrorResponse } } },
        429: { description: 'Core API or BFF_Project rate limit reached: retry after the Retry-After header (seconds)', content: { 'application/json': { schema: ErrorResponse } } },
        500: { description: 'Unexpected server error; the cause is only logged', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API or BFF_Project unavailable, failed or answered an undeclared error', content: { 'application/json': { schema: ErrorResponse } } },
        503: { description: 'Instance misconfigured: CORE_API_URL, PROJECT_BFF_URL or the session key (JWT_PUBLIC_KEY) is not set or invalid', content: { 'application/json': { schema: ErrorResponse } } },
    },
});

router.get('/projects-without-group', async (req: Request, res: Response) => {
    await requireRole(req, (role) => isAdminRole(role) || canonicalRole(role) === 'Maire', 'Administrator or mayor role required');
    const { data } = await callUpstream(
        'PROJECT_BFF',
        () => projectBff.getProjectGroupsProjectsWithoutGroup(asCaller('PROJECT_BFF', req)),
        { declared: [401, 403], retry: true },
    );
    const projects = data.projects.map(({ id, title, createdAt }) => ({ id, title, createdAt: createdAt ?? null }));
    res.status(200).json({ total: projects.length, projects });
});

router.use(async (req: Request, _res: Response, next: NextFunction) => {
    await requireAdmin(req);
    next();
});

registry.registerPath({
    method: 'get',
    path: '/admin/users',
    tags: ['Administration'],
    summary: 'List the manageable users, at most 20 items per page',
    request: { query: UserListQuery },
    responses: { ...coreResponses, 200: { description: 'Administration data', content: { 'application/json': { schema: AdministrationUsersPageSchema } } } },
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
    path: '/admin/users',
    tags: ['Administration'],
    summary: 'Create a user through Core API',
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
    path: '/admin/users/{userId}',
    tags: ['Administration'],
    summary: 'Update a user through Core API',
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
    path: '/admin/users/{userId}/password',
    tags: ['Administration'],
    summary: 'Change the password and revoke the user sessions',
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
    path: '/admin/users/{userId}/2fa',
    tags: ['Administration'],
    summary: 'Reset the second factor of a user',
    description: 'Removes the TOTP secret and the backup codes of the user (lost phone) and revokes all their sessions. '
        + 'Idempotent: 204 whether or not the user had a second factor. The reset is audited by Core.',
    request: { params: UserIdParams },
    responses: coreWriteResponses,
});

router.delete('/users/:userId/2fa', async (req: Request, res: Response) => {
    const { userId } = parseRequest(UserIdParams, req.params, 'params');

    try {
        await coreAdminUsersClient.adminResetUserTwoFactor(userId, asCaller('CORE_API', req));
        return res.status(204).send();
    } catch (error) {
        throw upstreamError('CORE_API', error, WRITE_STATUSES);
    }
});

registry.registerPath({
    method: 'delete',
    path: '/admin/users/{userId}',
    tags: ['Administration'],
    summary: 'Delete a user for good through Core API',
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
    path: '/admin/users/{userId}/roles',
    tags: ['Administration'],
    summary: 'Add a role to a user through Core API',
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
    path: '/admin/users/{userId}/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Remove a role from a user through Core API',
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
    path: '/admin/roles',
    tags: ['Administration'],
    summary: 'List the admin roles through Core API',
    responses: { ...coreResponses, 200: { description: 'Administration data', content: { 'application/json': { schema: RolesListSchema } } } },
});

router.get('/roles', async (req: Request, res: Response) => {
    const response = await callUpstream('CORE_API', () => coreAdminRolesClient.adminGetRole(asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return forwardCoreResponse(res, response, RolesListSchema);
});

registry.registerPath({
    method: 'post',
    path: '/admin/roles',
    tags: ['Administration'],
    summary: 'Create a role through Core API',
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
    path: '/admin/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Replace a role through Core API',
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
    path: '/admin/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Update a role through Core API',
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
    path: '/admin/roles/{roleId}',
    tags: ['Administration'],
    summary: 'Delete a role through Core API',
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
    path: '/admin/groups',
    tags: ['Administration'],
    summary: 'Lists the groups through Core API, one page chosen with `limit` / `offset`',
    request: { query: CorePageQuery },
    responses: { ...coreResponses, 200: { description: 'Administration data', content: { 'application/json': { schema: GroupsListSchema } } } },
});

router.get('/groups', async (req: Request, res: Response) => {
    const response = await callUpstream('CORE_API', () => coreGroupsClient.getGroups(corePage(req), asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return forwardCoreResponse(res, response, GroupsListSchema);
});

registry.registerPath({
    method: 'post',
    path: '/admin/groups',
    tags: ['Administration'],
    summary: 'Create a group through Core API',
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
    path: '/admin/groups/{groupId}',
    tags: ['Administration'],
    summary: 'Get a group through Core API',
    request: { params: GroupIdParams },
    responses: { ...coreResponses, 200: { description: 'Administration data', content: { 'application/json': { schema: GroupDetailSchema } } } },
});

router.get('/groups/:groupId', async (req: Request, res: Response) => {
    const { groupId } = parseRequest(GroupIdParams, req.params, 'params');

    const response = await callUpstream('CORE_API', () => coreGroupsClient.getGroup(groupId, asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return forwardCoreResponse(res, response, GroupDetailSchema);
});

registry.registerPath({
    method: 'patch',
    path: '/admin/groups/{groupId}',
    tags: ['Administration'],
    summary: 'Update the name or the description of a group',
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
    path: '/admin/groups/{groupId}',
    tags: ['Administration'],
    summary: 'Delete a group through Core API',
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
    path: '/admin/groups/{groupId}/users',
    tags: ['Administration'],
    summary: 'List the users of a group through Core API',
    request: { params: GroupIdParams },
    responses: { ...coreResponses, 200: { description: 'Administration data', content: { 'application/json': { schema: GroupMembersSchema } } } },
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
    path: '/admin/groups/{groupId}/users',
    tags: ['Administration'],
    summary: 'Add a user to a group through Core API',
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
        // The membership is read before adding, so a duplicate answers 200 `created: false` rather than Core's 409.
        const members = await coreGroupsClient.getGroupUsers(groupId, CORE_LARGEST_PAGE, asCaller('CORE_API', req));
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
    path: '/admin/groups/{groupId}/users/{userId}',
    tags: ['Administration'],
    summary: 'Remove a user from a group through Core API',
    request: { params: GroupUserParams },
    responses: coreWriteResponses,
});

router.delete('/groups/:groupId/users/:userId', async (req: Request, res: Response) => {
    const { groupId, userId } = parseRequest(GroupUserParams, req.params, 'params');

    try {
        const members = await coreGroupsClient.getGroupUsers(groupId, CORE_LARGEST_PAGE, asCaller('CORE_API', req));
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
    path: '/admin/sessions',
    tags: ['Administration'],
    summary: 'List the active sessions through Core API',
    responses: { ...coreResponses, 200: { description: 'Administration data', content: { 'application/json': { schema: SessionsListSchema } } } },
});

router.get('/sessions', async (req: Request, res: Response) => {
    const response = await callUpstream('CORE_API', () => coreSessionsClient.getActiveSessions(asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return forwardCoreResponse(res, response, SessionsListSchema);
});

registry.registerPath({
    method: 'get',
    path: '/admin/sessions/history',
    tags: ['Administration'],
    summary: 'Reads the session history through Core API, one page chosen with `limit` / `offset`',
    request: { query: CorePageQuery },
    responses: { ...coreResponses, 200: { description: 'Administration data', content: { 'application/json': { schema: SessionsListSchema } } } },
});

router.get('/sessions/history', async (req: Request, res: Response) => {
    const response = await callUpstream('CORE_API', () => coreSessionsClient.history(corePage(req), asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return forwardCoreResponse(res, response, SessionsListSchema);
});

registry.registerPath({
    method: 'post',
    path: '/admin/sessions/revoke',
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

registry.registerPath({
    method: 'get',
    path: '/admin/two-factor-policy',
    tags: ['Administration'],
    summary: 'Reads the second-factor policy of the instance (MAIR-808)',
    description: 'Core `GET /api/v1/admin/two-factor-policy`: whether the second factor is mandatory and which modes are accepted.',
    responses: { ...coreResponses, 200: { description: 'The policy', content: { 'application/json': { schema: TwoFactorPolicySchema } } } },
});

router.get('/two-factor-policy', async (req: Request, res: Response) => {
    const response = await callUpstream('CORE_API', () => coreTwoFactorPolicyClient.getTwoFactorPolicy(asCaller('CORE_API', req)), { declared: READ_STATUSES, retry: true });
    return res.status(200).json(whitelist(TwoFactorPolicySchema, response.data));
});

registry.registerPath({
    method: 'put',
    path: '/admin/two-factor-policy',
    tags: ['Administration'],
    summary: 'Changes the second-factor policy of the instance (MAIR-808)',
    description: 'Core `PUT /api/v1/admin/two-factor-policy`: the four fields are required. With `required: true`, an agent without a '
        + 'usable factor enrols at its next sign-in (`2fa_setup_required`) and nobody can turn the factor off. At least one mode must stay '
        + 'allowed; `passkey_allowed: true` and unknown fields answer 400. The change is audited by Core with the administrator id.',
    request: { body: jsonBodyRequest(TwoFactorPolicyUpdateSchema) },
    responses: { ...coreResponses, 200: { description: 'The policy as saved', content: { 'application/json': { schema: TwoFactorPolicySchema } } } },
});

router.put('/two-factor-policy', async (req: Request, res: Response) => {
    const body = parseRequest(TwoFactorPolicyUpdateSchema, req.body, 'body');

    try {
        const response = await coreTwoFactorPolicyClient.updateTwoFactorPolicy(body, asCaller('CORE_API', req));
        return res.status(200).json(whitelist(TwoFactorPolicySchema, response.data));
    } catch (error) {
        throw upstreamError('CORE_API', error, READ_STATUSES);
    }
});

export default router;
