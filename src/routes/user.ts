import { HttpError } from '@mairie360/bffs-lib';
import { Request, Response, Router } from 'express';
import {
    AboutResponseViewSchema,
    ErrorResponse,
    registry,
    UserIdParams,
} from '../openapi-registry';
import { fetchUserAbout } from './core_helpers';
import { coreError, invalidInput } from '../utils/httpErrors';
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
                    schema: ErrorResponse,
                },
            },
        },
        401: {
            description: 'Utilisateur non authentifié ou ID invalide',
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
            description: 'Erreur serveur',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        502: {
            description: 'Core API indisponible ou réponse amont invalide',
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

    const authorization = bearerToken(req);
    if (!authorization) {
        throw new HttpError(401, 'Invalid or missing session token');
    }

    try {
        const userInfo = await fetchUserAbout(paramsResult.data.userId, authorization);
        return res.status(200).json(userInfo);
    } catch (error) {
        throw coreError(error, [401, 404]);
    }
});

export default router;
