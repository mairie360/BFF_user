import { asCaller, callUpstream, noStore, requireBearer } from '@mairie360/bffs-lib';
import { z } from 'zod';
import { CoreApiNotConfigured, ErrorResponse, registry } from '../openapi-registry';
import { Request, Response, Router } from 'express';
import { CORE_PAGE_SIZE, coreGroupsClient, coreUsersClient } from '../clients/coreClient';
import { whitelist } from './admin_helpers';

type UserWithRoles = {
    roles?: unknown;
    role?: unknown;
};

const router = Router();

// Only these fields are returned (whitelist): anything Core API adds to /user/me or /groups is dropped.
export const SessionResponseSchema = registry.register('SessionResponse', z.object({
    user: z.object({
        id: z.union([z.string(), z.number()]).optional(),
        first_name: z.string(), last_name: z.string(), email: z.string(),
        phone: z.string().nullable().optional(), status: z.string(), role: z.string().optional(),
    }),
    groups: z.array(z.object({ id: z.number(), name: z.string(), owner_id: z.number(), description: z.string().nullable().optional() })),
    roles: z.array(z.union([z.string(), z.object({ id: z.number().optional(), name: z.string() })])),
}));
for (const path of ['/me', '/session/me']) {
    registry.registerPath({ method: 'get', path, responses: {
        200: { description: 'Identity, groups and roles of the session (contract fields only)', content: { 'application/json': { schema: SessionResponseSchema } } },
        401: { description: 'Missing `Authorization: Bearer` header, or invalid or expired session', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable, failed or answered another error', content: { 'application/json': { schema: ErrorResponse } } },
        503: CoreApiNotConfigured,
    } });
}

// Per route, not router.use(): this router is also mounted at `/`, where a router-level guard would answer
// 401 to every unknown path instead of 404.
router.get('/me', noStore, requireBearer, async (req: Request, res: Response) => {
    const options = asCaller('CORE_API', req);
    // Idempotent reads: retried once on a transient failure; only Core's 401 is relayed, the rest is a 502.
    const [userResponse, groupsResponse] = await Promise.all([
        callUpstream('CORE_API', () => coreUsersClient.getMe(options), { declared: [401], retry: true }),
        callUpstream('CORE_API', () => coreGroupsClient.getGroups(CORE_PAGE_SIZE, options), { declared: [401], retry: true }),
    ]);
    const userWithRoles = userResponse.data as typeof userResponse.data & UserWithRoles;
    const roles = Array.isArray(userWithRoles.roles) && userWithRoles.roles.length > 0
        ? userWithRoles.roles
        : typeof userWithRoles.role === 'string'
            ? [userWithRoles.role]
            : [];

    return res.status(200).json(whitelist(SessionResponseSchema, {
        user: userResponse.data,
        groups: groupsResponse.data?.groups,
        roles,
    }));
});

export default router;
