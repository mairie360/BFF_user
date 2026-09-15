import { Request, Response, Router } from 'express';
import {
    AboutResponseViewSchema,
    ApiErrorResponse,
    registry,
    UserIdParams,
} from '../openapi-registry';
import { fetchUserAbout, handleUnknownError } from './core_helpers';
import { bearerToken } from './admin_helpers';

const router = Router();

registry.registerPath({
    method: 'get',
    path: '/user/{userId}/about',
    tags: ['Users'],
    summary: 'Récupère les informations publiques d\'un utilisateur',
    description: 'Transmet la session (en-tête Authorization, x-session-token ou cookie accessToken) au Core API sur /api/v1/user/{id}/ et ne renvoie que les informations publiques.',
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
        502: {
            description: 'Core API indisponible ou réponse amont invalide',
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
        return res.status(400).json({ message: 'Invalid user ID' });
    }

    const authorization = bearerToken(req);
    if (!authorization) {
        return res.status(401).json({ message: 'Invalid or missing session token' });
    }

    try {
        const userInfo = await fetchUserAbout(paramsResult.data.userId, authorization);
        return res.status(200).json(userInfo);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

export default router;
