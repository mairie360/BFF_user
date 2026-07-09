import { Router } from 'express';
import userController from '../controllers/userController';
import {
    AboutResponseViewSchema,
    ApiErrorResponse,
    registry,
    UserIdParams,
} from '../openapi-registry';

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

router.get('/:userId/about', userController.about);

export default router;
