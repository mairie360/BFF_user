import { Router } from 'express';
import authController from '../controllers/authController';
import { registry } from '../openapi-registry';

const router = Router();

// =============== OpenAPI Documentation ===============

registry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: ['Authentication'],
    summary: 'Authentifier un utilisateur',
    requestBody: {
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        email: { type: 'string', format: 'email', description: 'Email de l\'utilisateur' },
                        password: { type: 'string', minLength: 6, description: 'Mot de passe' }
                    },
                    required: ['email', 'password']
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Authentification réussie',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            accessToken: { type: 'string' },
                            message: { type: 'string' }
                        }
                    }
                }
            }
        },
        400: {
            description: 'Erreur de validation'
        },
        401: {
            description: 'Email ou mot de passe invalide'
        }
    }
});

registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    tags: ['Authentication'],
    summary: 'Déconnecter un utilisateur',
    responses: {
        200: {
            description: 'Déconnexion réussie',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            message: { type: 'string' }
                        }
                    }
                }
            }
        }
    }
});

registry.registerPath({
    method: 'get',
    path: '/auth/me',
    tags: ['Authentication'],
    summary: 'Récupérer les infos de l\'utilisateur connecté',
    responses: {
        200: {
            description: 'Infos utilisateur',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            email: { type: 'string' },
                            name: { type: 'string' }
                        }
                    }
                }
            }
        },
        401: {
            description: 'Non authentifié'
        }
    }
});

// =============== Routes ===============

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.getMe);

export default router;