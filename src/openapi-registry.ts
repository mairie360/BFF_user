import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ErrorResponseSchema } from '@mairie360/bffs-lib';
import { z } from 'zod';

// On ajoute les méthodes .openapi() à Zod
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// The only credential accepted (`authorization()` / `bearerToken()` of `@mairie360/bffs-lib`) and forwarded
// to Core API: an `Authorization: Bearer <jwt>` header, which the fronts' proxy builds from the
// `accessToken` cookie. The document requires it on every operation (`openapi.ts`); public operations
// opt out with `security: []`. The ZAP OpenAPI coverage gate reads this to tell which operations must be
// reached authenticated.
export const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
});

// Body of every error answer, shared by every BFF (`@mairie360/bffs-lib`): `{ error: { code, message, details } }`.
// clone(): the lib builds its schemas on import, before extendZodWithOpenApi() above, and zod 4 only
// adds .openapi() to schemas created after the extension.
export const ErrorResponse = registry.register('ErrorResponse', ErrorResponseSchema.clone());

export const LoginViewSchema = z.object({
    email: z.email().openapi({
        description: 'Adresse email de l\'utilisateur',
        example: 'alice.dupont@mairie360.fr',
    }),
    password: z.string().min(1).openapi({
        description: 'Mot de passe de l\'utilisateur',
        example: 'MotDePasse123',
    }),
    device_info: z.string().openapi({
        description: 'Informations sur le périphérique utilisé pour se connecter (chaîne vide acceptée, comme par Core API)',
        example: 'Firefox',
    }),
}).openapi('LoginView');

export const KeycloakLoginViewSchema = z.object({
    code: z.string().min(1).openapi({
        description: 'Authorization code Keycloak appended to the redirect URI after the user signed in (single use, short-lived).',
        example: '7c1e0f5a-2b8d-4f3e-9a61-d4c2b7e8f901.3b5d9e2a-6f14-4c8b-a7d0-1e9f2c4b6a83',
    }),
    redirect_uri: z.url().openapi({
        description: 'Redirect URI sent in the authorization request, byte for byte: Keycloak refuses the code otherwise.',
        example: 'https://login.mairie360.fr/auth/callback',
    }),
    code_verifier: z.string().min(1).nullable().optional().openapi({
        description: 'PKCE verifier matching the `code_challenge` of the authorization request. Omit it only if the request carried no challenge.',
        example: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    }),
    nonce: z.string().min(1).nullable().optional().openapi({
        description: 'Nonce sent in the authorization request; the ID token must carry the same value. Omit it only if the request carried no nonce.',
        example: 'n-0S6_WzA2Mj',
    }),
    device_info: z.string().openapi({
        description: 'Description of the device, stored on the session (empty string accepted, like the password login).',
        example: 'Firefox 142 on Ubuntu 24.04',
    }),
}).openapi('KeycloakLoginView');

// Same password policy as the admin routes (AdminUserCreateBody, AdminUserPasswordResetBody).
export const ForceChangePasswordViewSchema = z.object({
    new_password: z.string().min(8).max(255).openapi({
        description: 'New password of the user (8 to 255 characters).',
        example: 'NouveauMotDePasse123',
    }),
    token: z.string().min(1).openapi({
        description: 'One-time token of the forced password change (412 answer of /auth/login).',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    }),
}).openapi('ForceChangePasswordView');

export const AboutResponseViewSchema = z.object({
    email: z.email().openapi({
        description: 'Adresse email de l\'utilisateur',
        example: 'alice.dupont@mairie360.fr',
    }),
    first_name: z.string().openapi({
        description: 'Prénom de l\'utilisateur',
        example: 'Alice',
    }),
    last_name: z.string().openapi({
        description: 'Nom de l\'utilisateur',
        example: 'Dupont',
    }),
    phone: z.string().nullable().openapi({
        description: 'Numéro de téléphone de l\'utilisateur (null si non renseigné)',
        example: '+33123456789',
    }),
    status: z.string().openapi({
        description: 'Statut du compte utilisateur',
        example: 'active',
    }),
}).openapi('AboutResponseView');
export type AboutResponseView = z.infer<typeof AboutResponseViewSchema>;

// The tokens of a sign-in are only delivered in HttpOnly cookies (`accessToken`, `refreshToken`), never in
// the body or a response header readable by the browser's JavaScript.
export const AuthSessionResponse = z.object({
    message: z.string().openapi({
        example: 'Logged in successfully',
    }),
}).openapi('AuthSessionResponse');

export const RefreshViewSchema = z.object({
    refresh_token: z.string().min(1).optional().openapi({
        description: 'Refresh token of the session. Optional: browsers send the HttpOnly `refreshToken` cookie set at sign-in instead; the body field wins when both are present.',
        example: '8Xo0Qm2rUu0M9v2YF3sJkQ7bN1pW4dC6hL8zT5aR0eE',
    }),
}).openapi('RefreshView');

export const RefreshResponse = z.object({
    message: z.string().openapi({
        example: 'JWT refreshed successfully',
    }),
}).openapi('RefreshResponse');

export const LogoutViewSchema = z.object({
    refresh_token: z.string().min(1).optional().openapi({
        description: 'Refresh token of the session, else the HttpOnly `refreshToken` cookie set at sign-in. When available with the session, the Core API session is revoked, which invalidates the access JWT immediately.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    }),
    post_logout_redirect_uri: z.url().optional().openapi({
        description: 'Where Keycloak sends the browser once the single sign-on session is closed. Must be one of '
            + 'the valid post-logout redirect URIs of the Keycloak client; defaults to KEYCLOAK_POST_LOGOUT_REDIRECT_URI.',
        example: 'https://login.mairie360.fr/',
    }),
}).openapi('LogoutView');

export const LogoutResponse = z.object({
    message: z.string().openapi({
        example: 'Logged out successfully',
    }),
    session_revoked: z.boolean().openapi({
        description: 'Whether the Core API session was revoked. `false` when no session or refresh token was sent, or when Core API refused or failed the revocation; the cookie is cleared in every case.',
        example: true,
    }),
    logout_url: z.url().optional().openapi({
        description: 'Keycloak end-session URL the browser must navigate to so the single sign-on session is closed '
            + 'on every tool of the realm (n8n, ...). Absent when Keycloak is not configured on this instance: the '
            + 'logout is then complete once the cookie is cleared.',
        example: 'https://auth.mairie360.fr/realms/mairie360/protocol/openid-connect/logout?client_id=mairie360&post_logout_redirect_uri=https%3A%2F%2Flogin.mairie360.fr%2F',
    }),
}).openapi('LogoutResponse');

export const UserIdParams = z.object({
    userId: z.coerce.number().int().positive().openapi({
        description: 'Identifiant numérique de l\'utilisateur',
        example: 42,
    }),
}).openapi('UserIdParams');

registry.register('LoginView', LoginViewSchema);
registry.register('KeycloakLoginView', KeycloakLoginViewSchema);
registry.register('ForceChangePasswordView', ForceChangePasswordViewSchema);
registry.register('AboutResponseView', AboutResponseViewSchema);
registry.register('AuthSessionResponse', AuthSessionResponse);
registry.register('RefreshView', RefreshViewSchema);
registry.register('RefreshResponse', RefreshResponse);
registry.register('LogoutView', LogoutViewSchema);
registry.register('LogoutResponse', LogoutResponse);
registry.register('UserIdParams', UserIdParams);
