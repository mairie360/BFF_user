import { authorization, noStore, requireBearer } from '@mairie360/bffs-lib';
import { Request, Response, Router } from 'express';
import {
    AboutResponseViewSchema,
    ErrorResponse,
    registry,
    UserIdParams,
} from '../openapi-registry';
import { fetchUserAbout } from './core_helpers';
import { coreError, invalidInput } from '../utils/httpErrors';

const router = Router();

// Session-bound: never cached, and 401 before anything else (validation, upstream call) without a Bearer token.
router.use(noStore, requireBearer);

registry.registerPath({
    method: 'get',
    path: '/user/{userId}/about',
    tags: ['Users'],
    summary: 'Gets the public information of a user',
    description: 'Forwards the caller\'s `Authorization: Bearer` header to Core API on /api/v1/user/{id}/ and only returns the public information.',
    request: {
        params: UserIdParams,
    },
    responses: {
        200: {
            description: 'Public information of the user',
            content: {
                'application/json': {
                    schema: AboutResponseViewSchema,
                },
            },
        },
        400: {
            description: 'Invalid user id',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        401: {
            description: 'Missing `Authorization: Bearer` header, or invalid or expired session',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        404: {
            description: 'Unknown user',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        500: {
            description: 'Server error',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        502: {
            description: 'Core API unavailable or invalid upstream answer',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
    },
});

router.get('/:userId/about', async (req: Request, res: Response) => {
    const paramsResult = UserIdParams.safeParse(req.params);

    if (!paramsResult.success) {
        throw invalidInput('Invalid user ID', paramsResult.error, 'params');
    }

    try {
        const userInfo = await fetchUserAbout(paramsResult.data.userId, authorization(req));
        return res.status(200).json(userInfo);
    } catch (error) {
        throw coreError(error, [401, 404]);
    }
});

export default router;
