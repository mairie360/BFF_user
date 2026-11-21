import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ErrorResponseSchema } from '@mairie360/bffs-lib';
import { z } from 'zod';

// Adds the .openapi() methods to Zod
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

/** 429 of every route that calls Core API: bffs-lib >= 2.4.0 relays a Core 429 with its Retry-After (MAIR-562). */
export const CoreApiRateLimited = {
    description: 'Core API rate limit reached: retry after the Retry-After header (seconds)',
    content: { 'application/json': { schema: ErrorResponse } },
};

/** 503 of every route that calls Core API: `CORE_API_URL` is missing or invalid on this instance (MAIR-431). */
export const CoreApiNotConfigured = {
    description: 'Instance misconfigured: CORE_API_URL or the session key (JWT_PUBLIC_KEY) is not set, or one of them is invalid',
    content: { 'application/json': { schema: ErrorResponse } },
};

export const LoginViewSchema = z.object({
    email: z.email().openapi({
        description: 'E-mail address of the user',
        example: 'alice.dupont@mairie360.fr',
    }),
    password: z.string().min(1).openapi({
        description: 'Password of the user',
        example: 'MotDePasse123',
    }),
    device_info: z.string().openapi({
        description: 'Device used to sign in (an empty string is accepted, as Core API does)',
        example: 'Firefox',
    }),
}).openapi('LoginView');

export const LoginTwoFactorViewSchema = z.object({
    token: z.string().min(1).max(512).openapi({
        description: 'Login token returned by `POST /auth/login` (or `/auth/reset_password`) with `status: "2fa_required"`. Single use, valid 5 minutes.',
        example: 'example-two-factor-token',
    }),
    code: z.string().min(1).max(32).openapi({
        description: 'Six-digit code of the authenticator application, or a backup code (`xxxx-xxxx`).',
        example: '492039',
    }),
}).openapi('LoginTwoFactorView');

export const PasskeyLoginOptionsResponse = z.object({
    id: z.string().openapi({
        description: 'Identifier of the ceremony: send it back, with the browser answer, to `POST /auth/passkey`. Single use, valid two minutes.',
        example: 'example-two-factor-token',
    }),
    options: z.record(z.string(), z.unknown()).openapi({
        description: 'WebAuthn `PublicKeyCredentialRequestOptions` for `navigator.credentials.get` (discoverable: no account is named, user verification required).',
        example: { publicKey: { challenge: 'q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9z0x1c', rpId: 'mairie360-eip.fr', userVerification: 'required' }, mediation: 'conditional' },
    }),
}).openapi('PasskeyLoginOptionsResponse');

export const PasskeyLoginViewSchema = z.object({
    id: z.string().min(1).max(512).openapi({
        description: 'The `id` returned by `POST /auth/passkey/options`.',
        example: 'example-two-factor-token',
    }),
    credential: z.record(z.string(), z.unknown()).openapi({
        description: 'The `PublicKeyCredential` returned by `navigator.credentials.get`, in its WebAuthn JSON form (base64url binary fields). Forwarded as is: Core verifies it.',
        example: { id: 'k3m9x7p2', rawId: 'k3m9x7p2', type: 'public-key', response: { authenticatorData: 'SZYN5Y', clientDataJSON: 'eyJ0eXBl', signature: 'MEUCIQ', userHandle: 'bWFpcmll' } },
    }),
    device_info: z.string().max(512).openapi({
        description: 'Device used to sign in (an empty string is accepted, as for the password login).',
        example: 'Firefox',
    }),
}).openapi('PasskeyLoginView');

const WEBAUTHN_CREDENTIAL_EXAMPLE = { id: 'k3m9x7p2', rawId: 'k3m9x7p2', type: 'public-key', response: { attestationObject: 'o2NmbXRkbm9uZQ', clientDataJSON: 'eyJ0eXBl' } };

export const PasskeyRegisterOptionsResponse = z.object({
    options: z.record(z.string(), z.unknown()).openapi({
        description: 'WebAuthn `PublicKeyCredentialCreationOptions` for `navigator.credentials.create` (discoverable credential and user verification required, no `authenticatorAttachment`: every password manager is accepted).',
        example: { publicKey: { challenge: 'q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9z0x1c', rp: { id: 'mairie360-eip.fr', name: 'Mairie 360' }, user: { id: 'bWFpcmll', name: 'camille@mairie360.test', displayName: 'Camille Trois' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { residentKey: 'required', userVerification: 'required' } } },
    }),
}).openapi('PasskeyRegisterOptionsResponse');

export const PasskeyRegisterViewSchema = z.object({
    label: z.string().min(1).max(100).openapi({ description: 'Name of the passkey, to recognise it in the list. The front proposes the `provider` of a previous creation or the device.', example: 'Google Password Manager' }),
    credential: z.record(z.string(), z.unknown()).openapi({
        description: 'The `PublicKeyCredential` returned by `navigator.credentials.create`, in its WebAuthn JSON form (base64url binary fields). Forwarded as is: Core verifies it.',
        example: WEBAUTHN_CREDENTIAL_EXAMPLE,
    }),
}).openapi('PasskeyRegisterView');

export const PasskeyResponse = z.object({
    id: z.number().int().openapi({ example: 7 }),
    label: z.string().openapi({ example: 'Google Password Manager' }),
    provider: z.string().nullable().openapi({ description: 'Name of the passkey manager deduced by Core from the authenticator (iCloud Keychain, Google Password Manager, ...); `null` when unknown: the agent types a name.', example: 'Google Password Manager' }),
    created_at: z.string().openapi({ example: '2026-11-19T09:12:00Z' }),
    last_used_at: z.string().nullable().openapi({ description: '`null` until the passkey signs in.', example: null }),
}).openapi('PasskeyResponse');

export const PasskeySetupViewSchema = z.object({
    token: z.string().min(1).max(512).openapi({ description: 'Token returned by `POST /auth/login` (or `/auth/reset_password`) with `status: "2fa_setup_required"`. Single use, valid 5 minutes.', example: 'example-two-factor-token' }),
    label: PasskeyRegisterViewSchema.shape.label,
    credential: PasskeyRegisterViewSchema.shape.credential,
}).openapi('PasskeySetupView');

export const TwoFactorRequiredResponse = z.object({
    status: z.enum(['2fa_required', '2fa_setup_required']).openapi({
        description: '`2fa_required`: the account has a second factor, send the token with a code to `POST /auth/login/2fa`. '
            + '`2fa_setup_required` (MAIR-808): the instance makes the second factor mandatory and the account has none, '
            + 'send the token to `POST /auth/2fa/setup` then `POST /auth/2fa/confirm`. No session is open in both cases.',
    }),
    token: z.string().openapi({ description: 'Single-use token, valid 5 minutes: it opens the second step (`2fa_required`) or the enrolment (`2fa_setup_required`) and nothing else.', example: 'example-two-factor-token' }),
    policy: z.object({
        totp_allowed: z.boolean().openapi({ description: 'The authenticator application is an accepted mode.', example: true }),
        passkey_allowed: z.boolean().openapi({ description: 'Passkeys are an accepted mode.', example: false }),
        backup_codes_allowed: z.boolean().openapi({ description: 'Backup codes are accepted at login: when `false`, none must be shown.', example: true }),
    }).optional().openapi({
        description: 'Only with `2fa_setup_required` (MAIR-809): what the administrator allows, so the screen offers nothing else. Absent from `2fa_required`, and from the answer of a Core that does not send it.',
    }),
}).openapi('TwoFactorRequiredResponse');

export const TwoFactorSetupTokenViewSchema = z.object({
    token: z.string().min(1).max(512).openapi({
        description: 'Token returned by `POST /auth/login` (or `/auth/reset_password`) with `status: "2fa_setup_required"`. Single use, valid 5 minutes.',
        example: 'example-two-factor-token',
    }),
}).openapi('TwoFactorSetupTokenView');

export const TwoFactorSetupConfirmViewSchema = z.object({
    token: z.string().min(1).max(512).openapi({
        description: 'The same enrolment token as `POST /auth/2fa/setup`.',
        example: 'example-two-factor-token',
    }),
    code: z.string().min(1).max(32).openapi({
        description: 'First six-digit code displayed by the authenticator application.',
        example: '492039',
    }),
}).openapi('TwoFactorSetupConfirmView');

export const TwoFactorEnrolmentResponse = z.object({
    secret: z.string().openapi({ description: 'Base32 secret to type in the authenticator application.', example: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' }),
    otpauth_uri: z.string().openapi({ description: '`otpauth://` URI to render as a QR code.', example: 'otpauth://totp/Mairie360:camille@mairie.fr?secret=JBSWY3DPEHPK3PXP&issuer=Mairie360' }),
}).openapi('TwoFactorEnrolmentResponse');

export const TwoFactorEnrolmentCompletedResponse = z.object({
    message: z.string().openapi({ example: 'Logged in successfully' }),
    backup_codes: z.array(z.string()).openapi({ description: 'The ten single-use backup codes, shown once: the front must make the agent keep them.', example: ['a1b2-c3d4', 'e5f6-a7b8'] }),
}).openapi('TwoFactorEnrolmentCompletedResponse');

// Same password policy as the admin routes (AdminUserCreateBody, AdminUserPasswordResetBody): the length rule of Core
// API's CNIL 2022 policy; Core also refuses common passwords and the account's e-mail or names, with a 400.
/** Minimum password length of Core API's policy (CNIL 2022). */
export const PASSWORD_MIN_LENGTH = 12;

export const ForceChangePasswordViewSchema = z.object({
    new_password: z.string().min(PASSWORD_MIN_LENGTH).max(255).openapi({
        description: 'New password of the user: 12 to 255 characters, not a commonly used password, not containing the account\'s e-mail, first name or last name (Core API policy: 400 otherwise).',
        example: 'Riviere-Velo-Mairie-2026',
    }),
    token: z.string().min(1).openapi({
        description: 'One-time token of the forced password change (412 answer of /auth/login).',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    }),
}).openapi('ForceChangePasswordView');

export const ForgotPasswordViewSchema = z.object({
    email: z.email().max(320).openapi({
        description: 'E-mail address of the account whose password is to be reset (at most 320 characters).',
        example: 'alice.dupont@mairie360.fr',
    }),
}).openapi('ForgotPasswordView');

/** Format of the reset token Core API e-mails (a UUID), as its `ResetPasswordView` declares it. */
const RESET_TOKEN_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const ResetPasswordViewSchema = z.object({
    token: z.string().regex(RESET_TOKEN_PATTERN).openapi({
        description: 'One-time reset token, the `token` query parameter of the link of the reset e-mail (a UUID).',
        example: '2f9a1c74-5b3e-4d21-9c8a-7e6f0b1d4a35',
    }),
    new_password: z.string().min(PASSWORD_MIN_LENGTH).max(255).openapi({
        description: 'New password of the user: 12 to 255 characters, not a commonly used password, not containing the account\'s e-mail, first name or last name (Core API policy: 400 otherwise).',
        example: 'Riviere-Velo-Mairie-2026',
    }),
    device_info: z.string().max(512).openapi({
        description: 'Description of the device, kept on the session the reset opens (at most 512 characters).',
        example: 'Firefox',
    }),
}).openapi('ResetPasswordView');

export const AboutResponseViewSchema = z.object({
    email: z.email().openapi({
        description: 'E-mail address of the user',
        example: 'alice.dupont@mairie360.fr',
    }),
    first_name: z.string().openapi({
        description: 'First name of the user',
        example: 'Alice',
    }),
    last_name: z.string().openapi({
        description: 'Last name of the user',
        example: 'Dupont',
    }),
    phone: z.string().nullable().openapi({
        description: 'Phone number of the user (null if not set)',
        example: '+33123456789',
    }),
    status: z.string().openapi({
        description: 'Status of the user account',
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

export const PasskeyOfferSchema = z.object({
    allowed: z.boolean().openapi({ description: 'The instance accepts passkeys (Core has a WebAuthn relying party and the policy allows them).', example: true }),
    registered: z.boolean().openapi({ description: 'The account already has at least one passkey.', example: false }),
}).openapi('PasskeyOffer');

// Answer of the password sign-ins: the session goes to the cookies, the body only carries what the screen needs next.
export const LoginSessionResponse = z.object({
    message: z.string().openapi({ example: 'Logged in successfully' }),
    passkey_offer: PasskeyOfferSchema.optional().openapi({
        description: 'Only after a password sign-in on a Core that sends it: whether the Login screen proposes to create a passkey. Absent after a sign-in by passkey, and from an older Core.',
    }),
}).openapi('LoginSessionResponse');

export const RefreshViewSchema = z.object({
    refresh_token: z.string().min(1).optional().openapi({
        description: 'Refresh token of the session. Optional: browsers send the HttpOnly `refreshToken` cookie set at sign-in instead; the body field wins when both are present.',
        example: 'example-two-factor-token',
    }),
}).openapi('RefreshView');

export const RefreshResponse = z.object({
    message: z.string().openapi({
        example: 'JWT refreshed successfully',
    }),
}).openapi('RefreshResponse');

export const LogoutViewSchema = z.object({
    refresh_token: z.string().min(1).optional().openapi({
        description: 'Refresh token of the session, else the HttpOnly `refreshToken` cookie set at sign-in. The Core API session is revoked through it (POST /api/v1/auth/logout), with or without a valid JWT (MAIR-692); without it, the session is revoked from the JWT alone (POST /api/v1/sessions/logout). Either way the access JWT stops working immediately.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
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
}).openapi('LogoutResponse');

export const UserIdParams = z.object({
    userId: z.coerce.number().int().positive().openapi({
        description: 'Numeric id of the user',
        example: 42,
    }),
}).openapi('UserIdParams');

registry.register('LoginView', LoginViewSchema);
registry.register('LoginTwoFactorView', LoginTwoFactorViewSchema);
registry.register('PasskeyLoginView', PasskeyLoginViewSchema);
registry.register('PasskeyRegisterView', PasskeyRegisterViewSchema);
registry.register('PasskeySetupView', PasskeySetupViewSchema);
registry.register('TwoFactorSetupTokenView', TwoFactorSetupTokenViewSchema);
registry.register('TwoFactorSetupConfirmView', TwoFactorSetupConfirmViewSchema);
registry.register('ForceChangePasswordView', ForceChangePasswordViewSchema);
registry.register('ForgotPasswordView', ForgotPasswordViewSchema);
registry.register('ResetPasswordView', ResetPasswordViewSchema);
registry.register('AboutResponseView', AboutResponseViewSchema);
registry.register('AuthSessionResponse', AuthSessionResponse);
registry.register('RefreshView', RefreshViewSchema);
registry.register('RefreshResponse', RefreshResponse);
registry.register('LogoutView', LogoutViewSchema);
registry.register('LogoutResponse', LogoutResponse);
registry.register('UserIdParams', UserIdParams);
