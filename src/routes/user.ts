import { asCaller, HttpError, noStore, parseRequest, requireBearer, upstreamError } from '@mairie360/bffs-lib';
import axios from 'axios';
import { Request, Response, Router } from 'express';
import {
    AboutResponseViewSchema,
    CoreApiNotConfigured,
    ErrorResponse,
    PasskeyCeremonyOptionsResponse,
    PasskeyIdParams,
    PasskeyListResponse,
    PasskeySchema,
    PasskeysNotConfigured,
    RegisterPasskeyViewSchema,
    registry,
    UserIdParams,
} from '../openapi-registry';
import { whitelist } from './admin_helpers';
import {
    deleteUserPasskey,
    fetchPasskeys,
    fetchUserAbout,
    passkeyRegistrationOptions,
    registerUserPasskey,
} from './core_helpers';

const router = Router();

// Session-bound: never cached, and 401 before anything else (validation, upstream call) without a Bearer token.
router.use(noStore, requireBearer);

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

// --- Passkeys of the signed-in user (MAIR-505) ---

const unauthorized = {
    description: 'Missing `Authorization: Bearer` header, or invalid or expired session',
    content: { 'application/json': { schema: ErrorResponse } },
};
const serverError = { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } };
const badGateway = {
    description: 'Core API unavailable or invalid upstream answer',
    content: { 'application/json': { schema: ErrorResponse } },
};

registry.registerPath({
    method: 'post',
    path: '/user/me/passkeys/options',
    tags: ['Users'],
    summary: 'Starts the registration of a passkey',
    description: 'Opens a passkey (WebAuthn) registration ceremony for the signed-in user on Core API (POST '
        + '/api/v1/user/me/passkeys/options) and returns the options to hand to `navigator.credentials.create()`: the '
        + 'account as the user entity, user verification required, the passkeys already registered excluded. The '
        + '`challenge_id` identifies the ceremony for POST /user/me/passkeys; it is single use, expires after two minutes '
        + 'and can only be finished by the same account.',
    responses: {
        200: {
            description: 'Ceremony opened: the creation options and the id of the ceremony.',
            content: { 'application/json': { schema: PasskeyCeremonyOptionsResponse } },
        },
        401: unauthorized,
        500: serverError,
        502: badGateway,
        503: PasskeysNotConfigured,
    },
});

registry.registerPath({
    method: 'post',
    path: '/user/me/passkeys',
    tags: ['Users'],
    summary: 'Registers a passkey',
    description: 'Completes the registration opened by POST /user/me/passkeys/options: forwards the attestation and the label '
        + 'to Core API (POST /api/v1/user/me/passkeys/), which checks it and stores the passkey of the signed-in user. The '
        + 'passkey can then sign in through POST /auth/passkey.',
    request: {
        body: {
            required: true,
            content: { 'application/json': { schema: RegisterPasskeyViewSchema } },
        },
    },
    responses: {
        201: {
            description: 'Passkey registered.',
            content: { 'application/json': { schema: PasskeySchema } },
        },
        400: {
            description: 'Invalid payload, label empty or longer than 100 characters, unknown or expired `challenge_id`, or attestation refused by Core API: start the registration again.',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        401: unauthorized,
        409: {
            description: 'This passkey is already registered.',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        500: serverError,
        502: badGateway,
        503: PasskeysNotConfigured,
    },
});

registry.registerPath({
    method: 'get',
    path: '/user/me/passkeys',
    tags: ['Users'],
    summary: 'Lists the passkeys of the signed-in user',
    description: 'Forwards the caller\'s session to Core API (GET /api/v1/user/me/passkeys/) and returns the registered '
        + 'passkeys, oldest first: id, label and dates only (contract fields), never the public keys.',
    responses: {
        200: {
            description: 'The registered passkeys, possibly none.',
            content: { 'application/json': { schema: PasskeyListResponse } },
        },
        401: unauthorized,
        500: serverError,
        502: badGateway,
        503: CoreApiNotConfigured,
    },
});

registry.registerPath({
    method: 'delete',
    path: '/user/me/passkeys/{passkeyId}',
    tags: ['Users'],
    summary: 'Deletes a passkey of the signed-in user',
    description: 'Forwards the deletion to Core API (DELETE /api/v1/user/me/passkeys/{id}/): the passkey can no longer sign '
        + 'in. A passkey of another account answers 404, like an unknown one.',
    request: {
        params: PasskeyIdParams,
    },
    responses: {
        204: { description: 'Passkey deleted.' },
        400: {
            description: 'Invalid passkey id',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        401: unauthorized,
        404: {
            description: 'No passkey with this id on this account.',
            content: { 'application/json': { schema: ErrorResponse } },
        },
        500: serverError,
        502: badGateway,
        503: CoreApiNotConfigured,
    },
});

/** Core answers 503 when it has no WebAuthn relying party: kept so the front can hide the passkey settings. */
function passkeysNotConfigured(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 503;
}

router.post('/me/passkeys/options', async (req: Request, res: Response) => {
    try {
        const coreResponse = await passkeyRegistrationOptions(asCaller('CORE_API', req));
        return res.status(200).json(whitelist(PasskeyCeremonyOptionsResponse, coreResponse.data));
    } catch (error) {
        if (passkeysNotConfigured(error)) {
            throw new HttpError(503, 'Passkeys are not configured');
        }
        throw upstreamError('CORE_API', error, [401]);
    }
});

router.post('/me/passkeys', async (req: Request, res: Response) => {
    const body = parseRequest(RegisterPasskeyViewSchema, req.body, 'body');

    try {
        const coreResponse = await registerUserPasskey(body, asCaller('CORE_API', req));
        return res.status(201).json(whitelist(PasskeySchema, coreResponse.data));
    } catch (error) {
        if (passkeysNotConfigured(error)) {
            throw new HttpError(503, 'Passkeys are not configured');
        }
        throw upstreamError('CORE_API', error, [400, 401, 409]);
    }
});

router.get('/me/passkeys', async (req: Request, res: Response) => {
    return res.status(200).json(whitelist(PasskeyListResponse, await fetchPasskeys(asCaller('CORE_API', req))));
});

router.delete('/me/passkeys/:passkeyId', async (req: Request, res: Response) => {
    const { passkeyId } = parseRequest(PasskeyIdParams, req.params, 'params');
    await deleteUserPasskey(passkeyId, asCaller('CORE_API', req));
    return res.status(204).send();
});

router.get('/:userId/about', async (req: Request, res: Response) => {
    const { userId } = parseRequest(UserIdParams, req.params, 'params');
    return res.status(200).json(await fetchUserAbout(userId, asCaller('CORE_API', req)));
});

export default router;
