import { z } from 'zod';
import type { AxiosResponse } from 'axios';
import axios from 'axios';
import { Request, Response, Router } from 'express';
import {
    ApiErrorResponse,
    AuthTokenResponse,
    ForceChangePasswordViewSchema,
    KeycloakLoginViewSchema,
    LoginViewSchema,
    LogoutResponse,
    LogoutViewSchema,
    RegisterViewSchema,
    registry,
} from '../openapi-registry';
import { buildKeycloakLogoutUrl, getKeycloakConfig } from '../config/keycloak';
import { clearTokenCookie, transmitAccessToken } from '../utils/cookieUtils';
import {
    forceChangeUserPassword,
    handleUnknownError,
    isLoginResponseView,
    keycloakLoginUser,
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
    path: '/auth/keycloak',
    tags: ['Authentication'],
    summary: 'Signs a user in with Keycloak',
    description: 'Completes the Keycloak single sign-on (OpenID Connect authorization code flow): forwards the '
        + 'authorization code to Core API (POST /api/v1/auth/keycloak), which redeems it, verifies the ID token and '
        + 'opens a session for the Mairie 360 account with the same verified e-mail. The session is then set exactly '
        + 'like POST /auth/login (httpOnly `accessToken` cookie + `Authorization` header), so every front and BFF keeps '
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
            description: 'Signed in; the access JWT is in Authorization and in the `accessToken` cookie, the body holds the refresh token.',
            headers: { Authorization: { description: 'Bearer <access token>', schema: { type: 'string' } } },
            content: { 'application/json': { schema: AuthTokenResponse } },
        },
        400: {
            description: 'Invalid payload',
            content: { 'application/json': { schema: ApiErrorResponse } },
        },
        401: {
            description: 'Keycloak refused the code (unknown, expired, reused, or redirect_uri / code_verifier mismatch) or the ID token failed verification; restart the sign-in from Keycloak.',
            content: { 'application/json': { schema: ApiErrorResponse } },
        },
        403: {
            description: 'The Keycloak identity has no verified e-mail, or matches no active Mairie 360 account.',
            content: { 'application/json': { schema: ApiErrorResponse } },
        },
        500: {
            description: 'Server error',
            content: { 'application/json': { schema: ApiErrorResponse } },
        },
        502: {
            description: 'Core API or Keycloak unavailable, or invalid upstream response',
            content: { 'application/json': { schema: ApiErrorResponse } },
        },
        503: {
            description: 'Keycloak sign-in is not configured on this instance; use POST /auth/login instead.',
            content: { 'application/json': { schema: ApiErrorResponse } },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/register',
    tags: ['Authentication'],
    summary: 'Crée un utilisateur',
    description: 'Valide puis transmet les informations d\'inscription au Core API (POST /api/v1/auth/register, route publique).',
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
    summary: 'Signs a user out of Mairie 360 and of the single sign-on',
    description: 'Clears the httpOnly `accessToken` cookie. When Keycloak is configured on the instance '
        + '(KEYCLOAK_REALM_URL + KEYCLOAK_CLIENT_ID), the response also carries `logout_url`, the OpenID Connect '
        + 'end-session URL of the realm: the front must send the browser there so Keycloak closes the single '
        + 'sign-on session and, through its front-channel / back-channel logout, the sessions of the other tools '
        + 'of the realm (n8n, ...). Core API keeps no Keycloak token, so the URL carries `client_id` rather than '
        + '`id_token_hint`: Keycloak asks the user to confirm the logout, then redirects to '
        + '`post_logout_redirect_uri` (body field, else KEYCLOAK_POST_LOGOUT_REDIRECT_URI) if the client allows it.',
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
                    schema: ApiErrorResponse,
                },
            },
        },
        500: {
            description: 'Server error',
            content: {
                'application/json': {
                    schema: ApiErrorResponse,
                },
            },
        },
    },
});

// =============== Routes ===============

/** Turns a Core sign-in response into the BFF session: `accessToken` cookie, Authorization header, refresh token body. */
function sendSession(res: Response, coreResponse: AxiosResponse): Response {
    const authorizationHeader = coreResponse.headers?.authorization
        ?? coreResponse.headers?.Authorization;

    if (!isLoginResponseView(coreResponse.data) || !transmitAccessToken(res, authorizationHeader)) {
        return res.status(502).json({
            message: 'Core API did not return a Bearer token in the Authorization header',
        });
    }

    return res.status(coreResponse.status).json(coreResponse.data);
}

router.post('/login', async (req: Request, res: Response) => {
    const input = LoginViewSchema.safeParse(req.body);
    if (!input.success) {
        return res.status(400).json({ message: 'Invalid login payload' });
    }

    try {
        return sendSession(res, await loginUser(input.data));
    } catch (error) {
        return handleUnknownError(res, error);
    }
});

router.post('/keycloak', async (req: Request, res: Response) => {
    const input = KeycloakLoginViewSchema.safeParse(req.body);
    if (!input.success) {
        return res.status(400).json({ message: 'Invalid Keycloak login payload' });
    }

    try {
        return sendSession(res, await keycloakLoginUser(input.data));
    } catch (error) {
        // Core answers 503 when Keycloak is not configured: keep it so the front can fall back to the password login.
        if (axios.isAxiosError(error) && error.response?.status === 503) {
            return res.status(503).json({ message: 'Keycloak sign-in is not configured' });
        }
        return handleUnknownError(res, error);
    }
});

router.post('/register', async (req: Request, res: Response) => {
    const input = RegisterViewSchema.safeParse(req.body);
    if (!input.success) {
        return res.status(400).json({ message: 'Invalid registration payload' });
    }

    try {
        await registerUser(input.data);
        return res.status(201).send();
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

router.post('/logout', (req: Request, res: Response) => {
    // The body is optional: an empty request (no JSON) logs out like before.
    const input = LogoutViewSchema.safeParse(req.body ?? {});
    if (!input.success) {
        return res.status(400).json({ message: 'Invalid logout payload' });
    }

    clearTokenCookie(res);

    // Single logout (MAIR-143): the browser must end the Keycloak session itself, the BFF holds no Keycloak token.
    const keycloak = getKeycloakConfig();
    if (!keycloak) {
        return res.json({ message: 'Logged out successfully' });
    }

    return res.json({
        message: 'Logged out successfully',
        logout_url: buildKeycloakLogoutUrl(keycloak, input.data.post_logout_redirect_uri),
    });
});

export default router;
