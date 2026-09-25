import axios from 'axios';
import { z } from 'zod';
import { Request, Response, Router } from 'express';
import {
    ApiErrorResponse,
    AuthTokenResponse,
    ForceChangePasswordViewSchema,
    LoginViewSchema,
    LogoutResponse,
    LogoutViewSchema,
    registry,
} from '../openapi-registry';
import { clearTokenCookie, transmitAccessToken } from '../utils/cookieUtils';
import { createAuthRateLimiters, RATE_LIMIT_MESSAGE } from '../middleware/rateLimit';
import type { AuthRateLimiters } from '../middleware/rateLimit';
import { bearerToken } from './admin_helpers';
import {
    forceChangeUserPassword,
    handleUnknownError,
    isLoginResponseView,
    loginUser,
    revokeSession,
} from './core_helpers';

const tooManyAttempts = {
    description: `Too many failed attempts from this client (or for this account); retry after the \`Retry-After\` delay. Body: \`{ "message": "${RATE_LIMIT_MESSAGE}" }\`.`,
    headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'integer' as const } } },
    content: {
        'application/json': {
            schema: ApiErrorResponse,
        },
    },
};

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
        429: tooManyAttempts,
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
        429: tooManyAttempts,
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
    summary: 'Signs a user out',
    description: 'Revokes the caller\'s Core API session (POST /api/v1/sessions/revoke) when the session (Authorization header or accessToken cookie) and the refresh token are both sent, then always clears the HTTP-only access-token cookie, even if Core API fails.',
    request: {
        body: {
            required: false,
            content: {
                'application/json': {
                    schema: LogoutViewSchema,
                },
            },
        },
    },
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

/**
 * Builds the authentication router. Each call gets its own rate-limit counters, so tests can build
 * isolated routers; the application uses the default export, configured from the environment.
 */
export function createAuthRouter(limiters: AuthRateLimiters = createAuthRateLimiters()): Router {
    const router = Router();

    router.post('/login', limiters.perIp, limiters.perAccount, async (req: Request, res: Response) => {
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

    router.post('/force_change_password', limiters.perIp, async (req: Request, res: Response) => {
        const input = ForceChangePasswordViewSchema.safeParse(req.body);
        if (!input.success) {
            return res.status(400).json({ message: 'Invalid password-change payload' });
        }

        try {
            // Core validates the one-time token, saves the password and consumes the token.
            await forceChangeUserPassword(input.data);
            return res.status(204).send();
        } catch (error) {
            return handleUnknownError(res, error);
        }
    });

    router.post('/logout', async (req: Request, res: Response) => {
        const input = LogoutViewSchema.safeParse(req.body ?? {});
        const refreshToken = input.success ? input.data.refresh_token : undefined;
        const authorization = bearerToken(req);

        let sessionRevoked = false;
        if (refreshToken && authorization) {
            try {
                // Core only revokes the caller's own session (JWT user + refresh token); once revoked,
                // the access JWT is refused by Core's session check even before it expires.
                await revokeSession(refreshToken, authorization);
                sessionRevoked = true;
            } catch (error) {
                // Never log the tokens: the status is enough to diagnose.
                const status = axios.isAxiosError(error) ? error.response?.status : undefined;
                console.warn('[BFF Auth] Session revocation failed on logout', { status: status ?? 'network error' });
            }
        }

        clearTokenCookie(res);
        return res.json({ message: 'Logged out successfully', session_revoked: sessionRevoked });
    });

    return router;
}

export default createAuthRouter();
