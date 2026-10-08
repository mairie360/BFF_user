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

/** 503 of every route that calls Core API: `CORE_API_URL` is missing or invalid on this instance (MAIR-431). */
export const CoreApiNotConfigured = {
    description: 'Instance misconfigured: CORE_API_URL is not set or invalid',
    content: { 'application/json': { schema: ErrorResponse } },
};

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
        description: 'Refresh token of the session, else the HttpOnly `refreshToken` cookie set at sign-in. With the session, the Core API session is revoked through it (POST /api/v1/sessions/revoke); without it, the session is revoked from the JWT alone (POST /api/v1/sessions/logout). Either way the access JWT stops working immediately.',
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
        description: 'Whether the Core API session was revoked. `false` when no session was sent, or when Core API refused or failed the revocation; the cookie is cleared in every case.',
        example: true,
    }),
    logout_url: z.url().optional().openapi({
        description: 'Keycloak end-session URL the browser must navigate to so the single sign-on session is closed '
            + 'on every tool of the realm (n8n, ...). Absent when Keycloak is not configured on this instance: the '
            + 'logout is then complete once the cookie is cleared.',
        example: 'https://auth.mairie360.fr/realms/mairie360/protocol/openid-connect/logout?client_id=mairie360&post_logout_redirect_uri=https%3A%2F%2Flogin.mairie360.fr%2F',
    }),
}).openapi('LogoutResponse');

// --- Passkeys (MAIR-505). The WebAuthn documents (ceremony options, `PublicKeyCredential.toJSON()`) are
// relayed as is between the browser and Core API, which validates them: the contract only types the envelope.
const WebAuthnJsonSchema = z.object({}).passthrough();

export const PasskeyCeremonyOptionsResponse = z.object({
    challenge_id: z.string().min(1).openapi({
        description: 'Id of the pending ceremony, to send back with the browser\'s answer. Single use, expires after two minutes.',
        example: '2f9a1c74-5b3e-4d21-9c8a-7e6f0b1d4a35',
    }),
    public_key: WebAuthnJsonSchema.openapi({
        description: 'WebAuthn options in their JSON form (`PublicKeyCredentialRequestOptions` for a sign-in, '
            + '`PublicKeyCredentialCreationOptions` for a registration), binary fields base64url: hand it to '
            + '`PublicKeyCredential.parseRequestOptionsFromJSON()` / `parseCreationOptionsFromJSON()`.',
    }),
}).openapi('PasskeyCeremonyOptionsResponse');

export const PasskeyLoginViewSchema = z.object({
    challenge_id: z.string().min(1).openapi({
        description: 'The `challenge_id` of the options this assertion answers.',
        example: '2f9a1c74-5b3e-4d21-9c8a-7e6f0b1d4a35',
    }),
    credential: WebAuthnJsonSchema.openapi({
        description: 'The `PublicKeyCredential` returned by `navigator.credentials.get()`, as given by its `toJSON()`.',
    }),
    device_info: z.string().openapi({
        description: 'Description of the device, stored on the session (empty string accepted, like the password login).',
        example: 'Safari 26 on iPhone',
    }),
}).openapi('PasskeyLoginView');

export const RegisterPasskeyViewSchema = z.object({
    challenge_id: z.string().min(1).openapi({
        description: 'The `challenge_id` of the registration options this attestation answers.',
        example: '2f9a1c74-5b3e-4d21-9c8a-7e6f0b1d4a35',
    }),
    label: z.string().min(1).max(100).openapi({
        description: 'Label the user gives the passkey (1 to 100 characters), shown in the list so they recognise the device.',
        example: 'iPhone de Jean',
    }),
    credential: WebAuthnJsonSchema.openapi({
        description: 'The `PublicKeyCredential` returned by `navigator.credentials.create()`, as given by its `toJSON()`.',
    }),
}).openapi('RegisterPasskeyView');

export const PasskeySchema = z.object({
    id: z.number().int().openapi({
        description: 'Id of the passkey, for DELETE /user/me/passkeys/{passkeyId}.',
        example: 12,
    }),
    label: z.string().openapi({
        description: 'Label chosen at registration.',
        example: 'iPhone de Jean',
    }),
    created_at: z.string().openapi({
        description: 'Registration date (RFC 3339).',
        example: '2026-10-08T09:30:00Z',
    }),
    last_used_at: z.string().nullable().openapi({
        description: 'Last sign-in with this passkey (RFC 3339), `null` when never used.',
        example: '2026-10-08T14:02:11Z',
    }),
}).openapi('Passkey');

export const PasskeyListResponse = z.object({
    passkeys: z.array(PasskeySchema).openapi({
        description: 'The passkeys of the signed-in user, oldest first. The public keys never leave Core API.',
    }),
}).openapi('PasskeyListResponse');

export const PasskeyIdParams = z.object({
    passkeyId: z.coerce.number().int().positive().openapi({
        description: 'Id of the passkey, from GET /user/me/passkeys.',
        example: 12,
    }),
}).openapi('PasskeyIdParams');

/** 503 of the passkey routes: Core API has no WebAuthn relying party (`WEBAUTHN_RP_ID` / `WEBAUTHN_RP_ORIGIN` unset). */
export const PasskeysNotConfigured = {
    description: 'Passkeys are not configured on this instance (Core API has no WebAuthn relying party), or CORE_API_URL is not set: fall back to the password login.',
    content: { 'application/json': { schema: ErrorResponse } },
};

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
registry.register('PasskeyCeremonyOptionsResponse', PasskeyCeremonyOptionsResponse);
registry.register('PasskeyLoginView', PasskeyLoginViewSchema);
registry.register('RegisterPasskeyView', RegisterPasskeyViewSchema);
registry.register('Passkey', PasskeySchema);
registry.register('PasskeyListResponse', PasskeyListResponse);
registry.register('PasskeyIdParams', PasskeyIdParams);
