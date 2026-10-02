import { HttpError } from '@mairie360/bffs-lib';
import { z } from 'zod';
import { ErrorResponse, registry } from '../openapi-registry';
import { Request, Response, Router } from 'express';
import type { AxiosRequestConfig } from 'axios';
import { coreGroupsClient, coreUsersClient } from '../clients/coreClient';
import { bearerToken, whitelist } from './admin_helpers';
import { coreError } from '../utils/httpErrors';

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
        401: { description: 'Missing, invalid or expired session', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable, failed or answered another error', content: { 'application/json': { schema: ErrorResponse } } },
    } });
}

router.get('/me', async (req: Request, res: Response) => {
    const authorization = bearerToken(req);

    if (!authorization) {
        throw new HttpError(401, 'Invalid or missing session token');
    }

    const options: AxiosRequestConfig = {
        headers: { Authorization: authorization },
    };

    try {
        const [userResponse, groupsResponse] = await Promise.all([
            coreUsersClient.getMe(options),
            coreGroupsClient.getGroups(options),
        ]);
        const userWithRoles = userResponse.data as typeof userResponse.data & UserWithRoles;
        const roles = Array.isArray(userWithRoles.roles) && userWithRoles.roles.length > 0
            ? userWithRoles.roles
            : typeof userWithRoles.role === 'string'
                ? [userWithRoles.role]
                : [];

        return res.status(200).json(whitelist(SessionResponseSchema, {
            user: userResponse.data,
            groups: groupsResponse.data.groups,
            roles,
        }));
    } catch (error) {
        throw coreError(error, [401]);
    }
});

export default router;
