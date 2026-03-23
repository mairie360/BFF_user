import { Router } from 'express';
import authController from '../controllers/authController';
import { authenticate } from '../middleware/authenticate';
import { registry } from '../openapi-registry';

const router = Router();

registry.registerPath({
    method: 'post',
    path: '/auth/login',
    requestBody: {
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 6 }
                    },
                    required: ['email', 'password']
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Login successful',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            accessToken: { type: 'string' },
                            user: { $ref: '#/components/schemas/User' }
                        }
                    }
                }
            }
        },
        401: {
            description: 'Invalid email or password'
        }
    }
});

registry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    tags: ['Authentication'],
    summary: 'Renouveler le token d\'accès',
    requestBody: {
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {},
                    description: 'Le refreshToken est envoyé via cookie HttpOnly'
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Token refreshed successfully',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            accessToken: { type: 'string' }
                        }
                    }
                }
            }
        },
        401: {
            description: 'Invalid or expired refresh token'
        }
    }
});

router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);

export default router;