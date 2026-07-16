import { Request, Response, Router } from 'express';
import {
    ApiErrorResponse,
    AuthTokenResponse,
    ForceChangePasswordViewSchema,
    LoginViewSchema,
    LogoutResponse,
    RegisterViewSchema,
    registry,
} from '../openapi-registry';
import { clearTokenCookie, setTokenCookie } from '../utils/cookieUtils';
import {
    forceChangeUserPassword,
    handleUnknownError,
    isLoginResponseView,
    loginUser,
    registerUser,
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
            description: 'Utilisateur authentifié avec succès',
            content: {
                'application/json': {
                    schema: AuthTokenResponse,
                },
            },
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
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/register',
    tags: ['Authentication'],
    summary: 'Crée un utilisateur',
    description: 'Transmet les informations d\'inscription au Core API.',
    request: {
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: RegisterViewSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Utilisateur créé avec succès',
        },
        400: {
            description: 'Données invalides',
            content: {
                'application/json': {
                    schema: ApiErrorResponse,
                },
            },
        },
        409: {
            description: 'Utilisateur déjà existant',
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
    try {
        const coreResponse = await loginUser(req.body);

        if (isLoginResponseView(coreResponse.data)) {
            setTokenCookie(res, coreResponse.data.refresh_token);
        }

        return res.status(coreResponse.status).json(coreResponse.data);
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

router.post('/register', async (req: Request, res: Response) => {
    try {
        await registerUser(req.body);
        return res.status(201).send();
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

router.post('/force_change_password', async (req: Request, res: Response) => {
    try {
        await forceChangeUserPassword(req.body);
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
