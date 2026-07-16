import { Request, Response, Router } from 'express';
import {
    AboutResponseViewSchema,
    ApiErrorResponse,
    registry,
    UserIdParams,
} from '../openapi-registry';
import { fetchUserAbout, handleUnknownError } from './core_helpers';

const router = Router();

registry.registerPath({
    method: 'get',
    path: '/user/{userId}/about',
    tags: ['Users'],
    summary: 'Récupère les informations publiques d\'un utilisateur',
    description: 'Transmet la demande au Core API sur /api/v1/user/{user_id}/about.',
    request: {
        params: UserIdParams,
    },
    responses: {
        200: {
            description: 'Informations utilisateur récupérées avec succès',
            content: {
                'application/json': {
                    schema: AboutResponseViewSchema,
                },
            },
        },
        400: {
            description: 'Identifiant utilisateur invalide',
            content: {
                'application/json': {
                    schema: ApiErrorResponse,
                },
            },
        },
        401: {
            description: 'Utilisateur non authentifié ou ID invalide',
            content: {
                'application/json': {
                    schema: ApiErrorResponse,
                },
            },
        },
        500: {
            description: 'Erreur serveur',
            content: {
                'application/json': {
                    schema: ApiErrorResponse,
                },
            },
        },
    },
});

router.get('/:userId/about', async (req: Request, res: Response) => {
    const paramsResult = UserIdParams.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: 'Invalid user ID',
            error: paramsResult.error.issues,
        });
    }

    try {
        const userInfo = await fetchUserAbout(paramsResult.data.userId, req.headers.authorization);
        return res.status(200).json(userInfo);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

export default router;
