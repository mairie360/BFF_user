import { Router } from 'express';
import authController from '../controllers/authController';
import {
    ApiErrorResponse,
    AuthTokenResponse,
    ForceChangePasswordViewSchema,
    LoginViewSchema,
    LogoutResponse,
    RegisterViewSchema,
    registry,
} from '../openapi-registry';

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
    path: '/auth/force-change-password',
    tags: ['Authentication'],
    summary: 'Force le changement de mot de passe',
    description: 'Transmet le token et le nouveau mot de passe au Core API sur /api/v1/auth/force-change-password/.',
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

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/force-change-password', authController.forceChangePassword);
router.post('/logout', authController.logout);

export default router;
