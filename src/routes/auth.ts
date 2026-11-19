import { asAnonymousClient, asCaller, bearerToken, HttpError, noStore, parseRequest, requestId, upstreamError, upstreamStatus } from '@mairie360/bffs-lib';
import type { AxiosResponse } from 'axios';
import axios from 'axios';
import { z } from 'zod';
import { Request, Response, Router } from 'express';
import {
    CoreApiNotConfigured,
    ErrorResponse,
    AuthSessionResponse,
    LoginSessionResponse,
    PasskeyRegisterOptionsResponse,
    PasskeySetupViewSchema,
    CoreApiRateLimited,
    ForceChangePasswordViewSchema,
    ForgotPasswordViewSchema,
    KeycloakLoginViewSchema,
    LoginTwoFactorViewSchema,
    PasskeyLoginOptionsResponse,
    PasskeyLoginViewSchema,
    TwoFactorEnrolmentCompletedResponse,
    TwoFactorEnrolmentResponse,
    TwoFactorSetupConfirmViewSchema,
    TwoFactorSetupTokenViewSchema,
    LoginViewSchema,
    LogoutResponse,
    LogoutViewSchema,
    RefreshResponse,
    RefreshViewSchema,
    registry,
    ResetPasswordViewSchema,
    TwoFactorRequiredResponse,
} from '../openapi-registry';
import { buildKeycloakLogoutUrl, getKeycloakConfig } from '../config/keycloak';
import { logger } from '../logger';
import {
    clearRefreshTokenCookie,
    clearTokenCookie,
    readCookie,
    REFRESH_TOKEN_COOKIE,
    setRefreshTokenCookie,
    transmitAccessToken,
} from '../utils/cookieUtils';
import { passkeysUnavailable } from './passkey_errors';
import { createAuthRateLimiters, RATE_LIMIT_MESSAGE } from '../middleware/rateLimit';
import type { AuthRateLimiters } from '../middleware/rateLimit';
import {
    forceChangeUserPassword,
    isLoginResponseView,
    isTwoFactorRequired,
    keycloakLoginUser,
    loginUser,
    loginUserTwoFactor,
    finishPasskeyEnrolment,
    finishPasskeyLogin,
    startPasskeyEnrolment,
    startPasskeyLogin,
    confirmLoginEnrolment,
    startLoginEnrolment,
    refreshSession,
    logoutSession,
    requestPasswordReset,
    resetUserPassword,
    logoutWithRefreshToken,
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
                    schema: LoginSessionResponse,
                },
            },
        },
        400: {
            description: 'Invalid data',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        202: {
            description: 'No session is open. `2fa_required`: the account is protected by a second factor, send the `token` with a code to `POST /auth/login/2fa` within five minutes. `2fa_setup_required` (MAIR-808): the instance makes the second factor mandatory and the account has none, enrol through `POST /auth/2fa/setup` then `POST /auth/2fa/confirm`.',
            content: { 'application/json': { schema: TwoFactorRequiredResponse } },
        },
        412: {
            description: 'First sign-in: the password must be changed',
            content: { 'application/json': { schema: z.object({ token: z.string() }).passthrough() } },
        },
        401: {
            description: 'Invalid credentials',
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
    path: '/auth/force_change_password',
    security: [],
    tags: ['Authentication'],
    summary: 'Force a password change',
    description: 'Forwards the token and the new password to Core API on /api/v1/auth/force_change_password.',
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
            description: 'Password changed',
        },
        400: {
            description: 'Invalid data',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        401: {
            description: 'Invalid or expired token',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        403: {
            description: 'Unknown or expired first sign-in token',
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
    path: '/auth/forgot_password',
    security: [],
    tags: ['Authentication'],
    summary: 'Requests a password reset e-mail',
    description: 'Forwards the e-mail to Core API (POST /api/v1/auth/forgot_password), which e-mails a one-time reset link '
        + '(`<PUBLIC_URL>/reset-password?token=…`, valid 15 minutes) when the address matches an active account. The answer is the '
        + 'same empty 200 whether the address matches an account or not, so it never tells which e-mails are registered. '
        + 'Every request counts against two budgets (AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX, 10 per 15 minutes by default): one '
        + 'per e-mail address, and one per client IP when TRUST_PROXY is set and the request carries X-Forwarded-For. Malformed '
        + 'requests also count as failed attempts per client IP. The client IP is relayed to Core API, which limits the '
        + 'requests per client and per e-mail address too.',
    request: {
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: ForgotPasswordViewSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Request accepted, empty body. Does not tell whether an e-mail was sent.',
        },
        400: {
            description: 'Invalid payload (missing `email`, or not an e-mail address of at most 320 characters)',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        429: tooManyAttempts,
        500: {
            description: 'Server error',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        502: {
            description: 'Core API unavailable, or it could not send the e-mail',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        503: CoreApiNotConfigured,
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/reset_password',
    security: [],
    tags: ['Authentication'],
    summary: 'Resets a password with the e-mailed token',
    description: 'Forwards the reset token of the e-mail, the new password and the device to Core API (POST /api/v1/auth/reset_password), '
        + 'which saves the password, revokes every other session of the account and opens a new one. The session is then set exactly '
        + 'like POST /auth/login (HttpOnly `accessToken` and `refreshToken` cookies): the user is signed in. The token is single use: '
        + 'a second reset with it answers 401. Failed attempts are rate limited per client IP when TRUST_PROXY is set and the request '
        + 'carries X-Forwarded-For.',
    request: {
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: ResetPasswordViewSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Password reset and signed in; the access JWT is in the `accessToken` cookie and the refresh token in the `refreshToken` cookie.',
            headers: { 'Set-Cookie': { description: 'HttpOnly `accessToken` and `refreshToken` cookies', schema: { type: 'string' } } },
            content: { 'application/json': { schema: AuthSessionResponse } },
        },
        202: {
            description: 'Password reset, but no session is open (the mailbox is not a second factor): `2fa_required` sends the `token` with a code to `POST /auth/login/2fa`, `2fa_setup_required` (mandatory policy, MAIR-808) to `POST /auth/2fa/setup`.',
            content: { 'application/json': { schema: TwoFactorRequiredResponse } },
        },
        400: {
            description: 'Invalid payload (`token` not a UUID, `new_password` not 8 to 255 characters, `device_info` longer than 512 characters, or a control character)',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        401: {
            description: 'Reset token unknown, expired or already used, or account archived since the e-mail was sent; request a new e-mail.',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        429: tooManyAttempts,
        500: {
            description: 'Server error',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        502: {
            description: 'Core API unavailable or invalid upstream answer',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        503: CoreApiNotConfigured,
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    security: [],
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
    description: 'Revokes the caller\'s Core API session: with the refresh token (body field or refreshToken cookie) through POST /api/v1/auth/logout, which needs no JWT and so also works once the access JWT has expired (MAIR-692), and, when the session (`Authorization: Bearer` header) is sent, from the JWT through POST /api/v1/sessions/logout (both together, so a stale refresh token does not leave the JWT\'s session open). `session_revoked` is true when either succeeded. Without either credential, nothing is revoked. It then always clears the HTTP-only accessToken and refreshToken cookies, even if Core API fails. '
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
            description: 'Server error',
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
    path: '/auth/login/2fa',
    security: [],
    tags: ['Authentication'],
    summary: 'Completes the sign-in of a protected account (second factor)',
    description: 'Second step of `POST /auth/login` (or `POST /auth/reset_password`) when they answered `202` '
        + '`2fa_required`: forwards the login token and the code (TOTP or backup code) to Core API. The session is then '
        + 'delivered exactly like `POST /auth/login` (HttpOnly `accessToken` and `refreshToken` cookies). The token is '
        + 'single use and burnt after five wrong codes: restart from the password.',
    request: {
        body: { required: true, content: { 'application/json': { schema: LoginTwoFactorViewSchema } } },
    },
    responses: {
        200: {
            description: 'Signed in; the access JWT is in the `accessToken` cookie and the refresh token in the `refreshToken` cookie.',
            headers: { 'Set-Cookie': { description: 'HttpOnly `accessToken` and `refreshToken` cookies', schema: { type: 'string' } } },
            content: { 'application/json': { schema: LoginSessionResponse } },
        },
        400: { description: 'Invalid data', content: { 'application/json': { schema: ErrorResponse } } },
        401: { description: 'Unknown, expired or burnt login token, or wrong or replayed code. A backup code that was already spent is told apart: two refusals are told apart by `error.details`: `body.code` (message `Backup code already used.`: it still counts as a failed attempt and five burn the token, so the agent can type another backup code only while the login token is still valid; the fifth failed attempt, or an expired token, answers `body.token` instead) and `body.token` (message `Invalid or expired login token.`: the login session is over, restart from the password). A wrong code has no detail.', content: { 'application/json': { schema: ErrorResponse } } },
        429: tooManyAttempts,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: { description: 'The second factor is not configured on this instance (Core has no encryption key), or CORE_API_URL is not set.', content: { 'application/json': { schema: ErrorResponse } } },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/passkey/options',
    security: [],
    tags: ['Authentication'],
    summary: 'Passkey sign-in: gets the challenge',
    description: 'Starts a discoverable passkey sign-in on Core API: the browser offers the passkeys it holds for the site, so nobody '
        + 'types an e-mail. Returns the WebAuthn options and the `id` of the ceremony (single use, two minutes), to send back with the '
        + 'browser answer to `POST /auth/passkey`.',
    responses: {
        200: { description: 'Challenge created.', content: { 'application/json': { schema: PasskeyLoginOptionsResponse } } },
        403: { description: 'The administrator does not accept passkeys (two-factor policy).', content: { 'application/json': { schema: ErrorResponse } } },
        429: tooManyAttempts,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: { description: 'Passkeys are not configured on this instance (Core has no WebAuthn relying party), or CORE_API_URL is not set: the front falls back to the password.', content: { 'application/json': { schema: ErrorResponse } } },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/passkey',
    security: [],
    tags: ['Authentication'],
    summary: 'Passkey sign-in: sends the browser answer',
    description: 'Forwards the signed challenge to Core API, which identifies the account by the passkey and verifies it. The session is '
        + 'then delivered exactly like `POST /auth/login` (HttpOnly `accessToken` and `refreshToken` cookies). A passkey is a complete '
        + 'sign-in: no second factor is asked, a mandatory policy is satisfied. Every refusal is the same `401`.',
    request: { body: { required: true, content: { 'application/json': { schema: PasskeyLoginViewSchema } } } },
    responses: {
        200: {
            description: 'Signed in; the access JWT is in the `accessToken` cookie and the refresh token in the `refreshToken` cookie.',
            headers: { 'Set-Cookie': { description: 'HttpOnly `accessToken` and `refreshToken` cookies', schema: { type: 'string' } } },
            content: { 'application/json': { schema: AuthSessionResponse } },
        },
        400: { description: 'Invalid data', content: { 'application/json': { schema: ErrorResponse } } },
        401: { description: 'The passkey is refused: unknown, expired or replayed challenge, unknown passkey, bad signature, cloned passkey, archived account.', content: { 'application/json': { schema: ErrorResponse } } },
        403: { description: 'The administrator does not accept passkeys (two-factor policy).', content: { 'application/json': { schema: ErrorResponse } } },
        429: tooManyAttempts,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: { description: 'Passkeys are not configured on this instance (Core has no WebAuthn relying party), or CORE_API_URL is not set.', content: { 'application/json': { schema: ErrorResponse } } },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/passkey/setup/options',
    security: [],
    tags: ['Authentication'],
    summary: 'Mandatory enrolment by passkey: gets the challenge',
    description: 'For an agent who got `202` `2fa_setup_required` (no session yet) and whom the policy lets enrol with a passkey: forwards the '
        + 'enrolment token to Core API, which answers the WebAuthn creation options (discoverable credential and user verification required, '
        + 'any password manager accepted). The token stays valid (five minutes) until the passkey is created. Same refusals as `POST /auth/passkey/setup`.',
    request: { body: { required: true, content: { 'application/json': { schema: TwoFactorSetupTokenViewSchema } } } },
    responses: {
        200: { description: 'Challenge created.', content: { 'application/json': { schema: PasskeyRegisterOptionsResponse } } },
        400: { description: 'Invalid data', content: { 'application/json': { schema: ErrorResponse } } },
        401: { description: 'Unknown, expired, spent or burnt enrolment token, or archived account.', content: { 'application/json': { schema: ErrorResponse } } },
        403: { description: 'The administrator does not accept passkeys (two-factor policy).', content: { 'application/json': { schema: ErrorResponse } } },
        409: { description: 'The account already has an active second factor: the token is of no use.', content: { 'application/json': { schema: ErrorResponse } } },
        429: tooManyAttempts,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: { description: 'Passkeys are not configured on this instance (Core has no WebAuthn relying party), or CORE_API_URL is not set: the front offers the authenticator application only.', content: { 'application/json': { schema: ErrorResponse } } },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/passkey/setup',
    security: [],
    tags: ['Authentication'],
    summary: 'Mandatory enrolment by passkey: sends the browser answer',
    description: 'Forwards the enrolment token, the label and the browser answer to Core API, which stores the passkey, spends the token and '
        + 'opens the session like `POST /auth/login` (HttpOnly `accessToken` and `refreshToken` cookies). A passkey satisfies the mandatory '
        + 'policy by itself: no backup codes are issued. A refused answer counts like a wrong code and the token is burnt at the fifth.',
    request: { body: { required: true, content: { 'application/json': { schema: PasskeySetupViewSchema } } } },
    responses: {
        200: {
            description: 'Passkey created and signed in; the access JWT is in the `accessToken` cookie and the refresh token in the `refreshToken` cookie.',
            headers: { 'Set-Cookie': { description: 'HttpOnly `accessToken` and `refreshToken` cookies', schema: { type: 'string' } } },
            content: { 'application/json': { schema: AuthSessionResponse } },
        },
        400: { description: 'Invalid data, or an answer Core refuses (the same token can try again until it is burnt).', content: { 'application/json': { schema: ErrorResponse } } },
        401: { description: 'Unknown, expired, spent or burnt enrolment token, or archived account.', content: { 'application/json': { schema: ErrorResponse } } },
        403: { description: 'The administrator does not accept passkeys (two-factor policy).', content: { 'application/json': { schema: ErrorResponse } } },
        409: { description: 'The account already has an active second factor, or this credential is already registered.', content: { 'application/json': { schema: ErrorResponse } } },
        429: tooManyAttempts,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: { description: 'Passkeys are not configured on this instance (Core has no WebAuthn relying party), or CORE_API_URL is not set.', content: { 'application/json': { schema: ErrorResponse } } },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/2fa/setup',
    security: [],
    tags: ['Authentication'],
    summary: 'Mandatory enrolment: starts the registration of the authenticator application',
    description: 'When the instance makes the second factor mandatory, `POST /auth/login` (or `/auth/reset_password`) answers `202` '
        + '`2fa_setup_required` for an account without a usable factor. Forwards that token to Core API, which answers the secret and '
        + 'the `otpauth://` URI to register in the authenticator application. No session exists yet: finish with `POST /auth/2fa/confirm`. '
        + 'Calling it again replaces the pending secret.',
    request: { body: { required: true, content: { 'application/json': { schema: TwoFactorSetupTokenViewSchema } } } },
    responses: {
        200: { description: 'Secret to register.', content: { 'application/json': { schema: TwoFactorEnrolmentResponse } } },
        400: { description: 'Invalid data', content: { 'application/json': { schema: ErrorResponse } } },
        401: { description: 'Unknown, expired or burnt enrolment token: a single detail points at `body.token` and the agent starts over from the password.', content: { 'application/json': { schema: ErrorResponse } } },
        409: { description: 'The account got a second factor meanwhile: sign in normally.', content: { 'application/json': { schema: ErrorResponse } } },
        429: tooManyAttempts,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: { description: 'The second factor is not configured on this instance (Core has no encryption key), or CORE_API_URL is not set.', content: { 'application/json': { schema: ErrorResponse } } },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/2fa/confirm',
    security: [],
    tags: ['Authentication'],
    summary: 'Mandatory enrolment: confirms with a first code and signs in',
    description: 'Forwards the enrolment token and the first code of the authenticator application to Core API, which activates the '
        + 'second factor and opens the session, delivered exactly like `POST /auth/login` (HttpOnly `accessToken` and `refreshToken` '
        + 'cookies). The ten single-use backup codes are in the body, once: the front must make the agent keep them. The token is single use '
        + 'and burnt after five wrong codes: restart from the password.',
    request: { body: { required: true, content: { 'application/json': { schema: TwoFactorSetupConfirmViewSchema } } } },
    responses: {
        200: {
            description: 'Enrolled and signed in; the access JWT is in the `accessToken` cookie and the refresh token in the `refreshToken` cookie.',
            headers: { 'Set-Cookie': { description: 'HttpOnly `accessToken` and `refreshToken` cookies', schema: { type: 'string' } } },
            content: { 'application/json': { schema: TwoFactorEnrolmentCompletedResponse } },
        },
        400: { description: 'Invalid data', content: { 'application/json': { schema: ErrorResponse } } },
        401: { description: 'Wrong first code (no detail: the token stays usable), or unknown, expired or burnt enrolment token (a single detail points at `body.token`: the agent starts over from the password).', content: { 'application/json': { schema: ErrorResponse } } },
        404: { description: '`POST /auth/2fa/setup` was not called with this token.', content: { 'application/json': { schema: ErrorResponse } } },
        429: tooManyAttempts,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: { description: 'The second factor is not configured on this instance (Core has no encryption key), or CORE_API_URL is not set.', content: { 'application/json': { schema: ErrorResponse } } },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/keycloak',
    security: [],
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
        429: CoreApiRateLimited,
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
function sendSession(res: Response, coreResponse: AxiosResponse, withPasskeyOffer = false): Response {
    openSession(res, coreResponse);
    const offer = withPasskeyOffer ? passkeyOfferOf(coreResponse.data) : undefined;

    return res.status(coreResponse.status).json(offer ? { message: 'Logged in successfully', passkey_offer: offer } : { message: 'Logged in successfully' });
}

/**
 * What a password sign-in tells the Login screen about passkeys: whether to propose creating one. Only the two
 * booleans are relayed; a Core that does not send them (older image) gives `undefined`.
 */
function passkeyOfferOf(value: unknown): { allowed: boolean; registered: boolean } | undefined {
    const offer = typeof value === 'object' && value !== null && 'passkey_offer' in value ? value.passkey_offer : undefined;
    if (typeof offer !== 'object' || offer === null) {
        return undefined;
    }
    const { allowed, registered } = offer as Record<string, unknown>;
    return typeof allowed === 'boolean' && typeof registered === 'boolean' ? { allowed, registered } : undefined;
}

/** Sets the session cookies from a Core sign-in response, without answering (the caller adds its own body). */
function openSession(res: Response, coreResponse: AxiosResponse): void {
    const authorizationHeader = coreResponse.headers?.authorization
        ?? coreResponse.headers?.Authorization;

    if (!isLoginResponseView(coreResponse.data) || !transmitAccessToken(res, authorizationHeader)) {
        throw new HttpError(502, 'Core API did not return a Bearer token in the Authorization header');
    }
    setRefreshTokenCookie(res, coreResponse.data.refresh_token);
}

/**
 * What the administrator allows, carried by Core's `2fa_setup_required` (MAIR-809): the agent has no session and cannot read
 * the policy, so the front takes it from here. Only the three booleans are relayed; a Core that does not send them (older
 * image) gives `undefined` and the front falls back to what it can do without them.
 */
function setupPolicyOf(value: unknown): { totp_allowed: boolean; passkey_allowed: boolean; backup_codes_allowed: boolean } | undefined {
    const policy = typeof value === 'object' && value !== null && 'policy' in value ? value.policy : undefined;
    if (typeof policy !== 'object' || policy === null) {
        return undefined;
    }
    const { totp_allowed, passkey_allowed, backup_codes_allowed } = policy as Record<string, unknown>;
    return typeof totp_allowed === 'boolean' && typeof passkey_allowed === 'boolean' && typeof backup_codes_allowed === 'boolean'
        ? { totp_allowed, passkey_allowed, backup_codes_allowed }
        : undefined;
}

/**
 * Answer of a sign-in that may need a second step: Core's 202 `2fa_required` (no session, MAIR-805) is relayed as
 * `{ status, token }` (the login token only opens `POST /auth/login/2fa`), anything else opens the session.
 */
function sendLoginOutcome(res: Response, coreResponse: AxiosResponse): Response {
    if (coreResponse.status === 202 && isTwoFactorRequired(coreResponse.data)) {
        // `2fa_required` (second step) or `2fa_setup_required` (mandatory enrolment, MAIR-808): the front routes on it.
        const { status, token } = coreResponse.data;
        const policy = status === '2fa_setup_required' ? setupPolicyOf(coreResponse.data) : undefined;
        return res.status(202).json(policy ? { status, token, policy } : { status, token });
    }
    return sendSession(res, coreResponse, true);
}

/** Core answers 503 when it has no TOTP encryption key: kept, so the front can tell it from a Core outage. */
function twoFactorUnavailable(error: unknown): HttpError | undefined {
    return axios.isAxiosError(error) && error.response?.status === 503
        ? new HttpError(503, 'Two-factor authentication is not configured')
        : undefined;
}

/** Plain-text 401 bodies of Core's second step that the front must tell apart from a wrong code. */
// A Map, not an object: an upstream body such as `toString` must not match an inherited property.
const SECOND_STEP_REFUSALS: ReadonlyMap<string, { message: string; path: string }> = new Map([
    ['Backup code already used.', { message: 'Backup code already used.', path: 'body.code' }],
    ['Invalid or expired login token.', { message: 'Invalid or expired login token.', path: 'body.token' }],
    // Mandatory enrolment (MAIR-809): the enrolment token is over, as opposed to a wrong first code.
    ['Invalid or expired enrolment token.', { message: 'Invalid or expired enrolment token.', path: 'body.token' }],
]);

/**
 * Core answers three different 401 on the second step: a wrong code (the login token stays usable), a backup code that
 * was already spent (same, the agent types another one) and an unknown, expired or burnt login token (the agent starts
 * over from the password). They are relayed as a 401 whose single detail points at `body.code` (spent backup code) or
 * `body.token` (login session over); a wrong code has no detail.
 */
function secondStepRefusal(error: unknown): HttpError | undefined {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || typeof error.response.data !== 'string') return undefined;
    const refusal = SECOND_STEP_REFUSALS.get(error.response.data);
    return refusal === undefined ? undefined : new HttpError(401, refusal.message, { details: [refusal] });
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
            return sendLoginOutcome(res, await loginUser(body, req));
        } catch (error) {
            // First sign-in: Core answers 412 with the one-time token of the password change. It is a regular
            // answer the front needs, not an error: only the token is relayed.
            const token = firstConnectionToken(error);
            if (token !== undefined) {
                return res.status(412).json({ token });
            }
            // Core API rate-limits sign-ins too (MAIR-425): its 429 is relayed, like the BFF's own limiter.
            throw twoFactorUnavailable(error) ?? upstreamError('CORE_API', error, [400, 401, 429]);
        }
    });

    router.post('/login/2fa', limiters.perIp, async (req: Request, res: Response) => {
        const body = parseRequest(LoginTwoFactorViewSchema, req.body, 'body');

        try {
            return sendSession(res, await loginUserTwoFactor(body, req), true);
        } catch (error) {
            throw twoFactorUnavailable(error) ?? secondStepRefusal(error) ?? upstreamError('CORE_API', error, [400, 401, 429]);
        }
    });

    router.post('/passkey/options', limiters.perIp, async (req: Request, res: Response) => {
        try {
            const { data } = await startPasskeyLogin(req);
            return res.status(200).json({ id: data.id, options: data.options });
        } catch (error) {
            throw passkeysUnavailable(error) ?? upstreamError('CORE_API', error, [403, 429]);
        }
    });

    router.post('/passkey', limiters.perIp, async (req: Request, res: Response) => {
        const body = parseRequest(PasskeyLoginViewSchema, req.body, 'body');

        try {
            return sendSession(res, await finishPasskeyLogin(body as never, req));
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            throw passkeysUnavailable(error) ?? upstreamError('CORE_API', error, [400, 401, 403, 429]);
        }
    });

    router.post('/2fa/setup', limiters.perIp, async (req: Request, res: Response) => {
        const body = parseRequest(TwoFactorSetupTokenViewSchema, req.body, 'body');

        try {
            const { data } = await startLoginEnrolment(body, req);
            return res.status(200).json({ secret: data.secret, otpauth_uri: data.otpauth_uri });
        } catch (error) {
            throw twoFactorUnavailable(error) ?? secondStepRefusal(error) ?? upstreamError('CORE_API', error, [400, 401, 409, 429]);
        }
    });

    router.post('/2fa/confirm', limiters.perIp, async (req: Request, res: Response) => {
        const body = parseRequest(TwoFactorSetupConfirmViewSchema, req.body, 'body');

        try {
            const coreResponse = await confirmLoginEnrolment(body, req);
            // The session goes to the cookies like a login; the one-time backup codes are the only secret of the body.
            openSession(res, coreResponse);
            return res.status(200).json({ message: 'Logged in successfully', backup_codes: coreResponse.data.backup_codes });
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            throw twoFactorUnavailable(error) ?? secondStepRefusal(error) ?? upstreamError('CORE_API', error, [400, 401, 404, 429]);
        }
    });

    router.post('/passkey/setup/options', limiters.perIp, async (req: Request, res: Response) => {
        const body = parseRequest(TwoFactorSetupTokenViewSchema, req.body, 'body');

        try {
            const { data } = await startPasskeyEnrolment(body, req);
            return res.status(200).json({ options: data.options });
        } catch (error) {
            throw passkeysUnavailable(error) ?? secondStepRefusal(error) ?? upstreamError('CORE_API', error, [400, 401, 403, 409, 429]);
        }
    });

    router.post('/passkey/setup', limiters.perIp, async (req: Request, res: Response) => {
        const body = parseRequest(PasskeySetupViewSchema, req.body, 'body');

        try {
            // The passkey satisfies the mandatory policy: the session opens like a login, with no backup codes.
            return sendSession(res, await finishPasskeyEnrolment(body as never, req));
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            throw passkeysUnavailable(error) ?? secondStepRefusal(error) ?? upstreamError('CORE_API', error, [400, 401, 403, 409, 429]);
        }
    });

    router.post('/keycloak', async (req: Request, res: Response) => {
        const body = parseRequest(KeycloakLoginViewSchema, req.body, 'body');

        try {
            return sendSession(res, await keycloakLoginUser(body, req));
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
            await forceChangeUserPassword(body, req);
            return res.status(204).send();
        } catch (error) {
            throw upstreamError('CORE_API', error, [400, 401, 403, 429]);
        }
    });

    router.post('/forgot_password', limiters.perIp, limiters.forgotPasswordPerIp, limiters.forgotPasswordPerAccount, async (req: Request, res: Response) => {
        const body = parseRequest(ForgotPasswordViewSchema, req.body, 'body');

        try {
            // Core answers the same empty 200 for a known or an unknown address (no account enumeration).
            await requestPasswordReset(body, req);
            return res.status(200).send();
        } catch (error) {
            throw upstreamError('CORE_API', error, [400, 429]);
        }
    });

    router.post('/reset_password', limiters.perIp, async (req: Request, res: Response) => {
        const body = parseRequest(ResetPasswordViewSchema, req.body, 'body');

        try {
            // Core consumes the token, saves the password and opens a session answered like a login.
            return sendLoginOutcome(res, await resetUserPassword(body, req));
        } catch (error) {
            throw twoFactorUnavailable(error) ?? upstreamError('CORE_API', error, [400, 401, 429]);
        }
    });

    router.post('/refresh', limiters.perIp, limiters.perRefreshToken, async (req: Request, res: Response) => {
        const body = parseRequest(RefreshViewSchema, req.body ?? {}, 'body');

        const refreshToken = refreshTokenOf(req, body.refresh_token);
        if (!refreshToken) {
            throw new HttpError(400, 'Missing refresh token');
        }

        try {
            const coreResponse = await refreshSession(refreshToken, req);
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
        // accessToken cookie); the accessToken cookie itself is never a credential.
        const hasSession = bearerToken(req) !== undefined;

        // MAIR-692: the refresh token alone ends its session (POST /api/v1/auth/logout, no JWT), so an agent whose
        // access JWT expired is still signed out for good. Core answers that call 204 even for a token matching no
        // session, so the Bearer session, when sent, is revoked as well (POST /api/v1/sessions/logout): a stale
        // refresh token must not leave a valid JWT's session open. Both start together. Once revoked, Core and the
        // other APIs refuse the session's JWTs. The calls are built inside the thunks: a missing CORE_API_URL (503)
        // must not prevent clearing the cookies.
        const revocations: Array<{ via: 'refresh_token' | 'jwt'; run: () => Promise<void> }> = [];
        if (refreshToken) {
            revocations.push({ via: 'refresh_token', run: () => logoutWithRefreshToken(refreshToken, asAnonymousClient('CORE_API', req)) });
        }
        if (hasSession) {
            revocations.push({ via: 'jwt', run: () => logoutSession(asCaller('CORE_API', req)) });
        }
        const results = await Promise.allSettled(revocations.map(async ({ run }) => run()));
        const sessionRevoked = results.some((result) => result.status === 'fulfilled');
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') return;
            const status = result.reason instanceof HttpError ? result.reason.status : upstreamStatus(result.reason);
            // Expected once the refresh token ended the session: the JWT had expired, or was revoked by that call.
            if (sessionRevoked && revocations[index].via === 'jwt' && status === 401) return;
            // Never log the tokens: the status is enough to diagnose.
            logger.warn('session revocation failed on logout', {
                request_id: requestId(req), via: revocations[index].via, status: status ?? 'network error',
            });
        });

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
