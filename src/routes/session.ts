import { Request, Response, Router } from 'express';
import type { AxiosRequestConfig } from 'axios';
import { coreGroupsClient, coreUsersClient } from '../clients/coreClient';
import { bearerToken, handleUnknownError } from './admin_helpers';

type UserWithRoles = {
    roles?: unknown;
};

const router = Router();

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

        return res.status(200).json({
            user: userResponse.data,
            groups: groupsResponse.data.groups,
            roles: Array.isArray(userWithRoles.roles)
                ? userWithRoles.roles
                : [],
        });
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

export default router;
