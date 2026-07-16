import { Request, Response, Router } from 'express';
import type { AxiosRequestConfig } from 'axios';
import { coreClient, coreGroupsClient, coreUsersClient } from '../clients/coreClient';
import { bearerToken, handleUnknownError } from './admin_helpers';

type JwtClaims = {
    sub?: string | number;
};

type UserRolesResponse = {
    roles?: unknown;
};

const router = Router();

export function getJwtUserId(authorization: string): number | null {
    try {
        const token = authorization.replace(/^Bearer\s+/i, '');
        const [, encodedPayload] = token.split('.');
        const claims = JSON.parse(
            Buffer.from(encodedPayload, 'base64url').toString('utf8'),
        ) as JwtClaims;
        const userId = Number(claims.sub);

        return Number.isInteger(userId) && userId > 0 ? userId : null;
    } catch {
        return null;
    }
}

router.get('/me', async (req: Request, res: Response) => {
    const authorization = bearerToken(req);
    const userId = authorization ? getJwtUserId(authorization) : null;

    if (!authorization || !userId) {
        return res.status(401).json({ message: 'Invalid or missing session token' });
    }

    const options: AxiosRequestConfig = {
        headers: { Authorization: authorization },
    };

    try {
        const [userResponse, groupsResponse, rolesResponse] = await Promise.all([
            coreUsersClient.getMe(options),
            coreGroupsClient.getGroups(options),
            coreClient.get<UserRolesResponse>(`/api/v1/admin/users/${userId}/`, options),
        ]);

        return res.status(200).json({
            user: userResponse.data,
            groups: groupsResponse.data.groups,
            roles: Array.isArray(rolesResponse.data.roles)
                ? rolesResponse.data.roles
                : [],
        });
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

export default router;
