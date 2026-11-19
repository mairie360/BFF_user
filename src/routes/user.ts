import { asCaller, noStore, parseRequest, requireSession, upstreamError } from '@mairie360/bffs-lib';
import { Request, Response, Router } from 'express';
import {
    AboutResponseViewSchema,
    CoreApiNotConfigured,
    CoreApiRateLimited,
    ErrorResponse,
    PasskeyRegisterOptionsResponse,
    PasskeyRegisterViewSchema,
    PasskeyResponse,
    registry,
    UserIdParams,
} from '../openapi-registry';
import { fetchUserAbout, finishPasskeyRegistration, startPasskeyRegistration } from './core_helpers';
import { passkeysUnavailable } from './passkey_errors';
import { whitelist } from './admin_helpers';

const router = Router();

// Session-bound: never cached, and 401 before anything else (validation, upstream call) without a valid
// session token (verified locally: EdDSA with JWT_PUBLIC_KEY, MAIR-680, expiry).
router.use(noStore, requireSession);

registry.registerPath({
    method: 'get',
    path: '/user/{userId}/about',
    tags: ['Users'],
    summary: 'Gets the public information of a user',
    description: 'Forwards the caller\'s `Authorization: Bearer` header to Core API on /api/v1/user/{id}/ and only returns the public information.',
    request: {
        params: UserIdParams,
    },
    responses: {
        200: {
            description: 'Public information of the user',
            content: {
                'application/json': {
                    schema: AboutResponseViewSchema,
                },
            },
        },
        400: {
            description: 'Invalid user id',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        401: {
            description: 'Missing `Authorization: Bearer` header, or invalid or expired session',
            content: {
                'application/json': {
                    schema: ErrorResponse,
                },
            },
        },
        404: {
            description: 'Unknown user',
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
        429: CoreApiRateLimited,
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

router.get('/:userId/about', async (req: Request, res: Response) => {
    const { userId } = parseRequest(UserIdParams, req.params, 'params');
    return res.status(200).json(await fetchUserAbout(userId, asCaller('CORE_API', req)));
});

const passkeyRefusals = {
    401: { description: 'Missing `Authorization: Bearer` header, or invalid or expired session', content: { 'application/json': { schema: ErrorResponse } } },
    403: { description: 'The administrator does not accept passkeys (two-factor policy).', content: { 'application/json': { schema: ErrorResponse } } },
    429: { description: 'Too many attempts (Core API rate limit); retry after the `Retry-After` delay.', headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'integer' as const } } }, content: { 'application/json': { schema: ErrorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
    502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
    503: { description: 'Passkeys are not configured on this instance (Core has no WebAuthn relying party), or CORE_API_URL is not set.', content: { 'application/json': { schema: ErrorResponse } } },
};

registry.registerPath({
    method: 'post',
    path: '/user/me/passkeys/options',
    tags: ['Users'],
    summary: 'Passkey creation by a signed-in agent: gets the challenge',
    description: 'Forwards the caller\'s `Authorization: Bearer` header to Core API `POST /api/v1/user/me/passkeys/options/`, which answers the WebAuthn '
        + 'creation options (discoverable credential and user verification required, no `authenticatorAttachment`, passkeys already registered excluded). '
        + 'Used by the Login screen right after the password sign-in (`passkey_offer.allowed`). The management of the list (rename, delete) is Settings\'.',
    responses: {
        200: { description: 'Challenge created.', content: { 'application/json': { schema: PasskeyRegisterOptionsResponse } } },
        ...passkeyRefusals,
    },
});

registry.registerPath({
    method: 'post',
    path: '/user/me/passkeys',
    tags: ['Users'],
    summary: 'Passkey creation by a signed-in agent: sends the browser answer',
    description: 'Forwards the label and the browser answer to Core API `POST /api/v1/user/me/passkeys/`, with the caller\'s session. Core stores the '
        + 'passkey and sends the agent a security e-mail. The answer carries the `provider` (name of the passkey manager deduced by Core, `null` when '
        + 'unknown) the front offers as the name of the passkey.',
    request: { body: { required: true, content: { 'application/json': { schema: PasskeyRegisterViewSchema } } } },
    responses: {
        201: { description: 'Passkey registered.', content: { 'application/json': { schema: PasskeyResponse } } },
        400: { description: 'Invalid data, or a browser answer Core refuses (challenge replayed, wrong origin, user verification missing).', content: { 'application/json': { schema: ErrorResponse } } },
        409: { description: 'This credential is already registered.', content: { 'application/json': { schema: ErrorResponse } } },
        ...passkeyRefusals,
    },
});

router.post('/me/passkeys/options', async (req: Request, res: Response) => {
    try {
        const { data } = await startPasskeyRegistration(asCaller('CORE_API', req));
        return res.status(200).json({ options: data.options });
    } catch (error) {
        throw passkeysUnavailable(error) ?? upstreamError('CORE_API', error, [401, 403, 429]);
    }
});

router.post('/me/passkeys', async (req: Request, res: Response) => {
    const body = parseRequest(PasskeyRegisterViewSchema, req.body, 'body');

    try {
        const { data } = await finishPasskeyRegistration(body as never, asCaller('CORE_API', req));
        return res.status(201).json(whitelist(PasskeyResponse, data));
    } catch (error) {
        throw passkeysUnavailable(error) ?? upstreamError('CORE_API', error, [400, 401, 403, 409, 429]);
    }
});

export default router;
