import { asCaller, bearerToken, HttpError, noStore, parseRequest, upstreamError, upstreamStatus } from '@mairie360/bffs-lib';
import type { AxiosResponse } from 'axios';
import axios from 'axios';
import { z } from 'zod';
import { Request, Response, Router } from 'express';
import {
    CoreApiNotConfigured,
    ErrorResponse,
    AuthSessionResponse,
    ForceChangePasswordViewSchema,
    KeycloakLoginViewSchema,
    LoginViewSchema,
    LogoutResponse,
    LogoutViewSchema,
    RefreshResponse,
    RefreshViewSchema,
    registry,
} from '../openapi-registry';
import { buildKeycloakLogoutUrl, getKeycloakConfig } from '../config/keycloak';
import {
    clearRefreshTokenCookie,
    clearTokenCookie,
    readCookie,
    REFRESH_TOKEN_COOKIE,
    setRefreshTokenCookie,
    transmitAccessToken,
} from '../utils/cookieUtils';
import { createAuthRateLimiters, RATE_LIMIT_MESSAGE } from '../middleware/rateLimit';
import type { AuthRateLimiters } from '../middleware/rateLimit';
import {
    forceChangeUserPassword,
    isLoginResponseView,
    keycloakLoginUser,
    loginUser,
    refreshSession,
    revokeSession,
} from './core_helpers';

const tooManyAttempts = {
    description: `Too many failed attempts from this client (or for this account); retry after the \`Retry-After\` delay. Body: \`{ "error": { "code": "TOO_MANY_REQUESTS", "message": "${RATE_LIMIT_MESSAGE}", "details": [] } }\`.`,
    headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'integer' as const } } },
    content: {
        'application/json': {
            schema: ErrorResponse,
        },
    },
};

registry.registerPath({
    method: 'post',
    path: '/auth/login',
    security: [],
    tags: ['Authentication'],
    summary: 'Signs a user in',
    description: 'Forwards the credentials to Core API. The session is only delivered in HttpOnly, SameSite=Strict cookies: '
        + '`accessToken` (the access JWT, path /) and `refreshToken` (path /auth, read by /auth/refresh and /auth/logout). '
        + 'No token is returned in the body or in a response header.',
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
            description: 'Signed in; the access JWT is in the `accessToken` cookie and the refresh token in the `refreshToken` cookie.',
            headers: { 'Set-Cookie': { description: 'HttpOnly `accessToken` and `refreshToken` cookies', schema: { type: 'string' } } },
            content: {
                'application/json': {
                    schema: AuthSessionResponse,
                },
            },
        },
        400: {
            description: 'Données invalides',
            content: {
                'application/json': {
                    schema: ErrorResponse,
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
                    schema: ErrorResponse,
                },
            },
        },
        429: tooManyAttempts,
        500: {
            description: 'Erreur serveur',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        502: {
            description: 'Core API unavailable or invalid upstream answer',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        503: CoreApiNotConfigured,
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/force_change_password',
    security: [],
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
                    schema: ErrorResponse,
                },
            },
        },
        401: {
            description: 'Token invalide ou expiré',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        403: {
            description: 'Token de première connexion inconnu ou expiré',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        429: tooManyAttempts,
        500: {
            description: 'Erreur serveur',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        502: {
            description: 'Core API unavailable or invalid upstream answer',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        503: CoreApiNotConfigured,
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    tags: ['Authentication'],
    summary: 'Renews the access JWT',
    description: 'Exchanges the refresh token of the session (body field, else the HttpOnly `refreshToken` cookie set at sign-in) for a new access JWT (Core POST /api/v1/sessions/refresh), without a session: an expired JWT can be renewed. Core rotates the refresh token: like /auth/login, the new JWT and the new refresh token are only delivered in the HttpOnly accessToken and refreshToken cookies. Failed attempts are rate limited per refresh token, and per client IP when TRUST_PROXY is set and the request carries X-Forwarded-For.',
    request: {
        body: {
            required: false,
            content: {
                'application/json': {
                    schema: RefreshViewSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'JWT renewed; the new access JWT is in the accessToken cookie and the rotated refresh token in the refreshToken cookie (the one sent no longer works).',
            headers: { 'Set-Cookie': { description: 'HttpOnly `accessToken` and `refreshToken` cookies', schema: { type: 'string' } } },
            content: {
                'application/json': {
                    schema: RefreshResponse,
                },
            },
        },
        400: {
            description: 'Invalid payload, or no refresh token in the body nor in the refreshToken cookie',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        401: {
            description: 'Refresh token unknown, revoked or expired',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        429: tooManyAttempts,
        500: {
            description: 'Server error',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        502: {
            description: 'Core API unavailable or invalid upstream answer',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        503: CoreApiNotConfigured,
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    security: [],
    tags: ['Authentication'],
    summary: 'Signs a user out',
    description: 'Revokes the caller\'s Core API session (POST /api/v1/sessions/revoke) when the session (`Authorization: Bearer` header) and the refresh token (body field or refreshToken cookie) are both sent, then always clears the HTTP-only accessToken and refreshToken cookies, even if Core API fails. '
        + 'When Keycloak is configured on the instance (KEYCLOAK_REALM_URL + KEYCLOAK_CLIENT_ID), the response also carries `logout_url`, the OpenID Connect '
        + 'end-session URL of the realm: the front must send the browser there so Keycloak closes the single sign-on session and, through its front-channel / '
        + 'back-channel logout, the sessions of the other tools of the realm (n8n, ...). Core API keeps no Keycloak token, so the URL carries `client_id` rather than '
        + '`id_token_hint`: Keycloak asks the user to confirm the logout, then redirects to `post_logout_redirect_uri` (body field, else KEYCLOAK_POST_LOGOUT_REDIRECT_URI) '
        + 'if the client allows it.',
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
            description: 'Cookie cleared; navigate to `logout_url` when present to close the Keycloak session.',
            content: {
                'application/json': {
                    schema: LogoutResponse,
                },
            },
        },
        400: {
            description: 'Invalid payload (`post_logout_redirect_uri` is not a URL)',
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
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/keycloak',
    tags: ['Authentication'],
    summary: 'Signs a user in with Keycloak',
    description: 'Completes the Keycloak single sign-on (OpenID Connect authorization code flow): forwards the '
        + 'authorization code to Core API (POST /api/v1/auth/keycloak), which redeems it, verifies the ID token and '
        + 'opens a session for the Mairie 360 account with the same verified e-mail. The session is then set exactly '
        + 'like POST /auth/login (HttpOnly `accessToken` and `refreshToken` cookies), so every front and BFF keeps '
        + 'working unchanged and the user keeps their roles. The password login stays available during the transition.',
    request: {
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: KeycloakLoginViewSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Signed in; the access JWT is in the `accessToken` cookie and the refresh token in the `refreshToken` cookie.',
            headers: { 'Set-Cookie': { description: 'HttpOnly `accessToken` and `refreshToken` cookies', schema: { type: 'string' } } },
            content: { 'application/json': { schema: AuthSessionResponse } },
        },
        400: {
            description: 'Invalid payload',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        401: {
            description: 'Keycloak refused the code (unknown, expired, reused, or redirect_uri / code_verifier mismatch) or the ID token failed verification; restart the sign-in from Keycloak.',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        403: {
            description: 'The Keycloak identity has no verified e-mail, or matches no active Mairie 360 account.',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        500: {
            description: 'Server error',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        502: {
            description: 'Core API or Keycloak unavailable, or invalid upstream response',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        503: {
            description: 'Keycloak sign-in is not configured on this instance (use POST /auth/login instead), or CORE_API_URL is not set.',
            content: { 'application/json': { schema: ErrorResponse } },
        },
    },
});

// =============== Routes ===============

/** One-time token of a Core 412 (first sign-in, password to change), or undefined for any other error. */
function firstConnectionToken(error: unknown): string | undefined {
    if (!axios.isAxiosError(error) || error.response?.status !== 412) return undefined;
    const token: unknown = (error.response.data as { token?: unknown } | undefined)?.token;
    return typeof token === 'string' ? token : undefined;
}

/**
 * Turns a Core sign-in response into the BFF session: the access JWT and the refresh token only go to
 * HttpOnly cookies, never to the body or a header readable by the browser's JavaScript.
 */
function sendSession(res: Response, coreResponse: AxiosResponse): Response {
    const authorizationHeader = coreResponse.headers?.authorization
        ?? coreResponse.headers?.Authorization;

    if (!isLoginResponseView(coreResponse.data) || !transmitAccessToken(res, authorizationHeader)) {
        throw new HttpError(502, 'Core API did not return a Bearer token in the Authorization header');
    }
    setRefreshTokenCookie(res, coreResponse.data.refresh_token);

    return res.status(coreResponse.status).json({ message: 'Logged in successfully' });
}

/** Refresh token of the caller: the body field, else the HttpOnly `refreshToken` cookie set at sign-in. */
function refreshTokenOf(req: Request, fromBody: string | undefined): string | undefined {
    return fromBody ?? readCookie(req, REFRESH_TOKEN_COOKIE);
}

/**
 * Builds the authentication router. Each call gets its own rate-limit counters, so tests can build
 * isolated routers; the application uses the default export, configured from the environment.
 */
export function createAuthRouter(limiters: AuthRateLimiters = createAuthRateLimiters()): Router {
    const router = Router();
    // Session cookies and one-time tokens: no answer of /auth may be cached by a proxy or the browser.
    router.use(noStore);

    router.post('/login', limiters.perIp, limiters.perAccount, async (req: Request, res: Response) => {
        const body = parseRequest(LoginViewSchema, req.body, 'body');

        try {
            return sendSession(res, await loginUser(body));
        } catch (error) {
            // First sign-in: Core answers 412 with the one-time token of the password change. It is a regular
            // answer the front needs, not an error: only the token is relayed.
            const token = firstConnectionToken(error);
            if (token !== undefined) {
                return res.status(412).json({ token });
            }
            // Core API rate-limits sign-ins too (MAIR-425): its 429 is relayed, like the BFF's own limiter.
            throw upstreamError('CORE_API', error, [400, 401, 429]);
        }
    });

    router.post('/keycloak', async (req: Request, res: Response) => {
        const body = parseRequest(KeycloakLoginViewSchema, req.body, 'body');

        try {
            return sendSession(res, await keycloakLoginUser(body));
        } catch (error) {
            // Core answers 503 when Keycloak is not configured: keep it so the front can fall back to the password login.
            if (axios.isAxiosError(error) && error.response?.status === 503) {
                throw new HttpError(503, 'Keycloak sign-in is not configured');
            }
            throw upstreamError('CORE_API', error, [400, 401, 403]);
        }
    });

    router.post('/force_change_password', limiters.perIp, async (req: Request, res: Response) => {
        const body = parseRequest(ForceChangePasswordViewSchema, req.body, 'body');

        try {
            // Core validates the one-time token, saves the password and consumes the token.
            await forceChangeUserPassword(body);
            return res.status(204).send();
        } catch (error) {
            throw upstreamError('CORE_API', error, [400, 401, 403, 429]);
        }
    });

    router.post('/refresh', limiters.perIp, limiters.perRefreshToken, async (req: Request, res: Response) => {
        const body = parseRequest(RefreshViewSchema, req.body ?? {}, 'body');

        const refreshToken = refreshTokenOf(req, body.refresh_token);
        if (!refreshToken) {
            throw new HttpError(400, 'Missing refresh token');
        }

        try {
            const coreResponse = await refreshSession(refreshToken);
            const authorizationHeader = coreResponse.headers?.authorization ?? coreResponse.headers?.Authorization;

            // Same delivery as /auth/login: the HttpOnly cookies only. Core rotates the refresh token (>= 2.0.0):
            // the one just sent no longer works, so the cookie must hold its replacement.
            if (!isLoginResponseView(coreResponse.data)
                || !transmitAccessToken(res, typeof authorizationHeader === 'string' ? authorizationHeader : undefined)) {
                throw new HttpError(502, 'Core API did not return a Bearer token and a refresh token');
            }
            setRefreshTokenCookie(res, coreResponse.data.refresh_token);

            return res.status(200).json({ message: 'JWT refreshed successfully' });
        } catch (error) {
            throw upstreamError('CORE_API', error, [400, 401, 429]);
        }
    });

    router.post('/logout', async (req: Request, res: Response) => {
        // The body is optional: an empty request (no JSON) only clears the cookie.
        const body = parseRequest(LogoutViewSchema, req.body ?? {}, 'body');

        const refreshToken = refreshTokenOf(req, body.refresh_token);
        // The session is the `Authorization: Bearer` header only (the fronts' proxy builds it from the
        // accessToken cookie); without one, logout only clears the cookies.
        const hasSession = bearerToken(req) !== undefined;

        let sessionRevoked = false;
        if (refreshToken && hasSession) {
            try {
                // Core only revokes the caller's own session (JWT user + refresh token); once revoked,
                // the access JWT is refused by Core's session check even before it expires. Inside the try:
                // a missing CORE_API_URL (503) must not prevent clearing the cookies.
                await revokeSession(refreshToken, asCaller('CORE_API', req));
                sessionRevoked = true;
            } catch (error) {
                // Never log the tokens: the status is enough to diagnose.
                const status = error instanceof HttpError ? error.status : upstreamStatus(error);
                console.warn('[BFF Auth] Session revocation failed on logout', { status: status ?? 'network error' });
            }
        }

        clearTokenCookie(res);
        clearRefreshTokenCookie(res);

        // Single logout (MAIR-143): the browser must end the Keycloak session itself, the BFF holds no Keycloak token.
        const keycloak = getKeycloakConfig();
        if (!keycloak) {
            return res.json({ message: 'Logged out successfully', session_revoked: sessionRevoked });
        }

        return res.json({
            message: 'Logged out successfully',
            session_revoked: sessionRevoked,
            logout_url: buildKeycloakLogoutUrl(keycloak, body.post_logout_redirect_uri),
        });
    });

    return router;
}

export default createAuthRouter();
