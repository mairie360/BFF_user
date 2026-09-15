import { z } from 'zod';
import { ApiErrorResponse, registry } from '../openapi-registry';
import { Request, Response, Router } from 'express';
import type { AxiosRequestConfig } from 'axios';
import { coreGroupsClient, coreUsersClient } from '../clients/coreClient';
import { bearerToken, handleUnknownError } from './admin_helpers';

type UserWithRoles = {
    roles?: unknown;
    role?: unknown;
};

const router = Router();

export const SessionResponseSchema = registry.register('SessionResponse', z.object({
    user: z.object({
        id: z.union([z.string(), z.number()]).optional(),
        first_name: z.string(), last_name: z.string(), email: z.string(),
        phone: z.string().nullable().optional(), status: z.string(), role: z.string().optional(),
    }).passthrough(),
    groups: z.array(z.object({ id: z.number(), name: z.string(), owner_id: z.number(), description: z.string().nullable().optional() }).passthrough()),
    roles: z.array(z.union([z.string(), z.object({ id: z.number().optional(), name: z.string() }).passthrough()])),
}));
for (const path of ['/me', '/session/me']) {
    registry.registerPath({ method: 'get', path, responses: {
        200: { description: 'Identité, groupes et rôles de la session', content: { 'application/json': { schema: SessionResponseSchema } } },
        401: { description: 'Session invalide' },
        502: { description: 'Core API indisponible', content: { 'application/json': { schema: ApiErrorResponse } } },
    } });
}

router.get('/me', async (req: Request, res: Response) => {
    const authorization = bearerToken(req);

    if (!authorization) {
        return res.status(401).json({ message: 'Invalid or missing session token' });
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

        return res.status(200).json({
            user: userResponse.data,
            groups: groupsResponse.data.groups,
            roles,
        });
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

export default router;
