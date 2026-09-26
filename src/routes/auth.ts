import { z } from 'zod';
import { Request, Response, Router } from 'express';
import {
    ApiErrorResponse,
    AuthTokenResponse,
    ForceChangePasswordViewSchema,
    LoginViewSchema,
    LogoutResponse,
    registry,
} from '../openapi-registry';
import { clearTokenCookie, transmitAccessToken } from '../utils/cookieUtils';
import {
    forceChangeUserPassword,
    handleUnknownError,
    isLoginResponseView,
    loginUser,
} from './core_helpers';

const router = Router();

registry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: ['Authentication'],
    summary: 'Authentifie un utilisateur',
    description: 'Transmet les identifiants au Core API et retourne le token JWT.',
    request: {
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: LoginViewSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Utilisateur authentifié ; le JWT d’accès est dans Authorization, le corps contient le refresh token.',
            headers: { Authorization: { description: 'Bearer <access token>', schema: { type: 'string' } } },
            content: {
                'application/json': {
                    schema: AuthTokenResponse,
                },
            },
        },
        400: {
            description: 'Données invalides',
            content: {
                'application/json': {
                    schema: ApiErrorResponse,
                },
            },
        },
        412: {
            description: 'Première connexion : mot de passe à changer',
            content: { 'application/json': { schema: z.object({ token: z.string() }).passthrough() } },
        },
        401: {
            description: 'Identifiants invalides',
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

registry.registerPath({
    method: 'post',
    path: '/auth/force_change_password',
    tags: ['Authentication'],
    summary: 'Force le changement de mot de passe',
    description: 'Transmet le token et le nouveau mot de passe au Core API sur /api/v1/auth/force_change_password.',
    request: {
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: ForceChangePasswordViewSchema,
                },
            },
        },
    },
    responses: {
        204: {
            description: 'Mot de passe changé avec succès',
        },
        400: {
            description: 'Données invalides',
            content: {
                'application/json': {
                    schema: ApiErrorResponse,
                },
            },
        },
        401: {
            description: 'Token invalide ou expiré',
            content: {
                'application/json': {
                    schema: ApiErrorResponse,
                },
            },
        },
        403: {
            description: 'Token de première connexion inconnu ou expiré',
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

registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    tags: ['Authentication'],
    summary: 'Déconnecte un utilisateur',
    description: 'Supprime le cookie HTTP-only contenant le token d\'accès.',
    responses: {
        200: {
            description: 'Utilisateur déconnecté',
            content: {
                'application/json': {
                    schema: LogoutResponse,
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

// =============== Routes ===============

router.post('/login', async (req: Request, res: Response) => {
    const input = LoginViewSchema.safeParse(req.body);
    if (!input.success) {
        return res.status(400).json({ message: 'Invalid login payload' });
    }

    try {
        const coreResponse = await loginUser(input.data);

        const authorizationHeader = coreResponse.headers?.authorization
            ?? coreResponse.headers?.Authorization;

        if (!isLoginResponseView(coreResponse.data) || !transmitAccessToken(res, authorizationHeader)) {
            return res.status(502).json({
                message: 'Core API did not return a Bearer token in the Authorization header',
            });
        }

        return res.status(coreResponse.status).json(coreResponse.data);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

router.post('/force_change_password', async (req: Request, res: Response) => {
    const input = ForceChangePasswordViewSchema.safeParse(req.body);
    if (!input.success) {
        return res.status(400).json({ message: 'Invalid password-change payload' });
    }

    try {
        // Core valide le jeton à usage unique, enregistre le mot de passe et consomme le jeton.
        await forceChangeUserPassword(input.data);
        return res.status(204).send();
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

router.post('/logout', (_req: Request, res: Response) => {
    clearTokenCookie(res);
    return res.json({ message: 'Logged out successfully' });
});

export default router;
