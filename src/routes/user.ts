import { asCaller, callUpstream, noStore, parseRequest, requireSession, upstreamError } from '@mairie360/bffs-lib';
import { Request, Response, Router } from 'express';
import {
    AboutResponseViewSchema,
    AlertIdParams,
    CoreApiNotConfigured,
    CoreApiRateLimited,
    ErrorResponse,
    PasskeyRegisterOptionsResponse,
    PasskeyIdParams,
    PasskeyRegisterViewSchema,
    PasskeyRenameViewSchema,
    PasskeyResponse,
    registry,
    ReportSessionResponseSchema,
    ReportSessionViewSchema,
    SecurityAlertSchema,
    UserIdParams,
} from '../openapi-registry';
import { coreSecurityAlertsClient } from '../clients/coreClient';
import { fetchUserAbout, finishPasskeyRegistration, renamePasskey, startPasskeyRegistration } from './core_helpers';
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

registry.registerPath({
    method: 'patch',
    path: '/user/me/passkeys/{passkeyId}',
    tags: ['Users'],
    summary: 'Rename one of my passkeys',
    description: 'Forwards the new label to Core API `PATCH /api/v1/user/me/passkeys/{id}/`, with the caller\'s session (MAIR-811). The Login screen '
        + 'creates the passkey, then shows the `provider` Core deduced as its name: the name the agent keeps is saved here. A passkey of another '
        + 'account answers 404, like an unknown one. No e-mail is sent.',
    request: {
        params: PasskeyIdParams,
        body: { required: true, content: { 'application/json': { schema: PasskeyRenameViewSchema } } },
    },
    responses: {
        200: { description: 'Passkey renamed.', content: { 'application/json': { schema: PasskeyResponse } } },
        400: { description: 'Invalid id or label (empty, more than 100 characters, control character).', content: { 'application/json': { schema: ErrorResponse } } },
        401: { description: 'Missing, invalid or expired session.', content: { 'application/json': { schema: ErrorResponse } } },
        404: { description: 'No such passkey among the caller\'s.', content: { 'application/json': { schema: ErrorResponse } } },
        429: CoreApiRateLimited,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: { description: 'CORE_API_URL is not set.', content: { 'application/json': { schema: ErrorResponse } } },
    },
});

router.post('/me/passkeys/options', async (req: Request, res: Response) => {
    let data: unknown;
    try {
        ({ data } = await startPasskeyRegistration(asCaller('CORE_API', req)));
    } catch (error) {
        throw passkeysUnavailable(error) ?? upstreamError('CORE_API', error, [401, 403, 429]);
    }
    // A Core answer without `options` is a 502, not an empty 200 the Login screen cannot use.
    return res.status(200).json(whitelist(PasskeyRegisterOptionsResponse, data));
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

router.patch('/me/passkeys/:passkeyId', async (req: Request, res: Response) => {
    const { passkeyId } = parseRequest(PasskeyIdParams, req.params, 'params');
    const body = parseRequest(PasskeyRenameViewSchema, req.body, 'body');

    try {
        const { data } = await renamePasskey(passkeyId, { label: body.label }, asCaller('CORE_API', req));
        return res.status(200).json(whitelist(PasskeyResponse, data));
    } catch (error) {
        throw upstreamError('CORE_API', error, [400, 401, 404]);
    }
});

// Stolen sessions (MAIR-773).
registry.registerPath({
    method: 'post',
    path: '/user/me/sessions/report',
    tags: ['Users'],
    summary: 'Report a use of the session from another device',
    description: 'Called by the front proxies with the session they checked (MAIR-773), forwarded to Core API '
        + '`POST /api/v1/sessions/report`. `certain` and `possible` close the session (`revoked: true` when it was active) and alert '
        + 'the agent and the administrators; `ip_change` is only logged.',
    request: { body: { required: true, content: { 'application/json': { schema: ReportSessionViewSchema } } } },
    responses: {
        200: { description: 'The use is recorded.', content: { 'application/json': { schema: ReportSessionResponseSchema } } },
        400: { description: 'Invalid body, or a session token without session id.', content: { 'application/json': { schema: ErrorResponse } } },
        401: { description: 'Missing, invalid or expired session.', content: { 'application/json': { schema: ErrorResponse } } },
        429: CoreApiRateLimited,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: CoreApiNotConfigured,
    },
});

router.post('/me/sessions/report', async (req: Request, res: Response) => {
    const body = parseRequest(ReportSessionViewSchema, req.body, 'body');

    try {
        const { data } = await coreSecurityAlertsClient.reportSessionUse(
            { level: body.level, ip_address: body.ip_address, device_info: body.device_info ?? '' },
            asCaller('CORE_API', req),
        );
        return res.status(200).json(whitelist(ReportSessionResponseSchema, data));
    } catch (error) {
        throw upstreamError('CORE_API', error, [400, 401]);
    }
});

registry.registerPath({
    method: 'get',
    path: '/user/me/security-alert',
    tags: ['Users'],
    summary: 'My pending security alert',
    description: 'The latest alert of a session of the caller used from another device that the caller has not read yet (Core '
        + '`GET /api/v1/user/me/security-alert/`, MAIR-773). The Login screen shows it right after the sign-in. `204` when there is none.',
    responses: {
        200: { description: 'The pending alert.', content: { 'application/json': { schema: SecurityAlertSchema } } },
        204: { description: 'No pending alert.' },
        401: { description: 'Missing, invalid or expired session.', content: { 'application/json': { schema: ErrorResponse } } },
        429: CoreApiRateLimited,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: CoreApiNotConfigured,
    },
});

router.get('/me/security-alert', async (req: Request, res: Response) => {
    const response = await callUpstream('CORE_API', () => coreSecurityAlertsClient.getMySecurityAlert(asCaller('CORE_API', req)), { declared: [401], retry: true });
    if (response.status === 204 || !response.data) {
        return res.status(204).send();
    }
    return res.status(200).json(whitelist(SecurityAlertSchema, response.data));
});

registry.registerPath({
    method: 'post',
    path: '/user/me/security-alert/{alertId}/acknowledge',
    tags: ['Users'],
    summary: 'Mark my security alert as read',
    description: 'Forwarded to Core API `POST /api/v1/user/me/security-alert/{alertId}/acknowledge/` (MAIR-773): the Login screen no longer '
        + 'shows the alert. An unknown alert, another account\'s or one already read answers 404.',
    request: { params: AlertIdParams },
    responses: {
        204: { description: 'The alert is read.' },
        400: { description: 'Invalid alert id.', content: { 'application/json': { schema: ErrorResponse } } },
        401: { description: 'Missing, invalid or expired session.', content: { 'application/json': { schema: ErrorResponse } } },
        404: { description: 'No unread alert of the caller has this id.', content: { 'application/json': { schema: ErrorResponse } } },
        429: CoreApiRateLimited,
        500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
        502: { description: 'Core API unavailable or invalid upstream answer', content: { 'application/json': { schema: ErrorResponse } } },
        503: CoreApiNotConfigured,
    },
});

router.post('/me/security-alert/:alertId/acknowledge', async (req: Request, res: Response) => {
    const { alertId } = parseRequest(AlertIdParams, req.params, 'params');

    try {
        await coreSecurityAlertsClient.acknowledgeMySecurityAlert(alertId, asCaller('CORE_API', req));
        return res.status(204).send();
    } catch (error) {
        throw upstreamError('CORE_API', error, [400, 401, 404]);
    }
});

export default router;
