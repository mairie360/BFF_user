import { createHash } from 'node:crypto';
import { createRateLimiter, parseTrustProxy } from '@mairie360/bffs-lib';
import type { Request, RequestHandler, Response } from 'express';
import { logger } from '../logger';
import { readCookie, REFRESH_TOKEN_COOKIE } from '../utils/cookieUtils';

/**
 * Rate limiting of the authentication routes (brute force of passwords and one-time tokens), built on
 * `createRateLimiter` of `@mairie360/bffs-lib` (429 in the shared error envelope, `RateLimit` and
 * `Retry-After` headers).
 *
 * Only failed attempts are counted, so users who sign in normally are never throttled; a 412 (first
 * sign-in, password to change) is a regular answer, not a failure. Counters live in memory, per BFF replica.
 *
 * Environment (prefix `AUTH_RATE_LIMIT`):
 * - `AUTH_RATE_LIMIT_ENABLED`     `false` disables every limiter (load tests), default enabled.
 * - `AUTH_RATE_LIMIT_WINDOW_MS`   window length, default 15 minutes.
 * - `AUTH_RATE_LIMIT_MAX`         failed logins per account e-mail and window, default 10.
 *                                 Also the failed refreshes per refresh token on `/auth/refresh`.
 * - `AUTH_RATE_LIMIT_IP_MAX`      failed attempts per client IP and window over every limited route,
 *                                 default 100, over /auth/login, /auth/force_change_password,
 *                                 /auth/forgot_password, /auth/reset_password and /auth/refresh. Only applied when `TRUST_PROXY` is set and the request
 *                                 carries `X-Forwarded-For`.
 * - `AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX` reset e-mail requests on /auth/forgot_password per client IP and per
 *                                 account e-mail and window, default 10 (MAIR-679). Every request counts, not only
 *                                 the failed ones: the route answers the same 200 for any address, so a failed-only
 *                                 limiter would never count it. The per-IP part follows the same `TRUST_PROXY` /
 *                                 `X-Forwarded-For` rule as `AUTH_RATE_LIMIT_IP_MAX`; the per-e-mail part is keyed on
 *                                 the SHA-256 of the normalized address alone, so it holds across client IPs.
 *
 * The per-e-mail and per-refresh-token counters are keyed on the account / token hash alone
 * (`perIp: false`), so they hold across client IPs. The IP-only limit is keyed on `req.ip`, which is only the
 * real client when `TRUST_PROXY` (see `parseTrustProxy` of `@mairie360/bffs-lib`) tells Express to read it
 * from `X-Forwarded-For`; otherwise it is the calling front pod's, shared by every user, and the limit would
 * become a global lockout any attacker can trigger. It therefore only runs when `TRUST_PROXY` is set and the
 * request carries `X-Forwarded-For`.
 */

export const RATE_LIMIT_MESSAGE = 'Too many attempts, please try again later';

const ENV_PREFIX = 'AUTH_RATE_LIMIT';
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_ACCOUNT_MAX = 10;
const DEFAULT_IP_MAX = 100;
const DEFAULT_FORGOT_PASSWORD_MAX = 10;

export interface AuthRateLimitOptions {
    enabled: boolean;
    windowMs: number;
    accountMax: number;
    ipMax: number;
    /** Reset e-mail requests per client IP and per account e-mail and window (every request counts). Default 10. */
    forgotPasswordMax?: number;
    /** Whether `req.ip` identifies the client (`TRUST_PROXY` set): enables the per-IP limit. */
    perClientIp: boolean;
}

export interface AuthRateLimiters {
    /** Failed attempts per client IP, shared by every limited authentication route (only with `X-Forwarded-For`). */
    perIp: RequestHandler;
    /** Failed logins per account e-mail (lower-cased), whatever the client IP. */
    perAccount: RequestHandler;
    /**
     * Failed refreshes per refresh token (SHA-256, the raw token never reaches the store), whatever the client IP. The
     * refresh body carries no e-mail; without `TRUST_PROXY` the IP is the front pod's, so the token is the
     * only part that cannot lock other users out. It stops replaying a revoked or stolen token; guessing a
     * valid one is out of reach (high-entropy token) and is further capped by `perIp` when `TRUST_PROXY` is set.
     */
    perRefreshToken: RequestHandler;
    /**
     * Every `/auth/forgot_password` request per client IP (only with `X-Forwarded-For` behind `TRUST_PROXY`), success or
     * not: one client flooding the form is refused without touching the others (MAIR-679).
     */
    forgotPasswordPerIp: RequestHandler;
    /**
     * Every `/auth/forgot_password` request per account e-mail (SHA-256 of the trimmed, lower-cased address), whatever
     * the client IP: spreading the requests over many addresses does not flood one mailbox.
     */
    forgotPasswordPerAccount: RequestHandler;
}

function positiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function authRateLimitOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): AuthRateLimitOptions {
    return {
        enabled: env[`${ENV_PREFIX}_ENABLED`]?.trim().toLowerCase() !== 'false',
        windowMs: positiveInteger(env[`${ENV_PREFIX}_WINDOW_MS`], DEFAULT_WINDOW_MS),
        accountMax: positiveInteger(env[`${ENV_PREFIX}_MAX`], DEFAULT_ACCOUNT_MAX),
        ipMax: positiveInteger(env[`${ENV_PREFIX}_IP_MAX`], DEFAULT_IP_MAX),
        forgotPasswordMax: positiveInteger(env[`${ENV_PREFIX}_FORGOT_PASSWORD_MAX`], DEFAULT_FORGOT_PASSWORD_MAX),
        perClientIp: parseTrustProxy(env.TRUST_PROXY) !== false,
    };
}

/** Whether a proxy told us who the client is; otherwise `req.ip` is the calling pod's, shared by every user. */
function hasForwardedClientIp(req: Request): boolean {
    const forwardedFor = req.headers['x-forwarded-for'];
    const value = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
    return typeof value === 'string' && value.trim().length > 0;
}

function refreshTokenHashOf(req: Request): string {
    // Same precedence as the /auth/refresh route: the body field, else the HttpOnly refreshToken cookie.
    const fromBody: unknown = (req.body as { refresh_token?: unknown } | undefined)?.refresh_token;
    const token = typeof fromBody === 'string' ? fromBody : readCookie(req, REFRESH_TOKEN_COOKIE) ?? '';
    return createHash('sha256').update(token).digest('hex');
}

/** SHA-256 of the normalized account e-mail, so the raw address never reaches the limiter's store. */
function accountHashOf(req: Request): string {
    return createHash('sha256').update(accountOf(req).trim().toLowerCase()).digest('hex');
}

/** A body without a usable e-mail is refused by the route's validation: it must not spend a shared counter. */
function hasAccount(req: Request): boolean {
    return accountOf(req).trim().length > 0;
}

function accountOf(req: Request): string {
    const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' ? email : '';
}

/** 412 is the regular answer of a first sign-in (password to change), not a failed attempt. */
function requestWasSuccessful(_req: Request, res: Response): boolean {
    return res.statusCode < 400 || res.statusCode === 412;
}

let warnedPerIpDisabled = false;

const passThrough: RequestHandler = (_req, _res, next) => next();

export function createAuthRateLimiters(options: AuthRateLimitOptions = authRateLimitOptionsFromEnv()): AuthRateLimiters {
    if (options.enabled && !options.perClientIp && !warnedPerIpDisabled) {
        warnedPerIpDisabled = true;
        // MAIR-679: the address relayed to Core API is then the front pod's too, so Core's own per-IP budgets
        // (forgot password 10 / 15 min, sign-in 30 / min) are shared by every user behind that pod.
        logger.warn('TRUST_PROXY is not set: per-IP rate limiting is disabled, only the per-e-mail limit applies, '
            + 'and Core API sees every client as the front pod (its per-IP limits are shared by all users).');
    }

    const common = {
        envPrefix: ENV_PREFIX,
        enabled: options.enabled,
        windowMs: options.windowMs,
        failedOnly: true,
        succeeded: requestWasSuccessful,
        message: RATE_LIMIT_MESSAGE,
    };

    const perIp = createRateLimiter({ ...common, limit: options.ipMax });
    // Every request counts (failedOnly: false): /auth/forgot_password always answers 200 (MAIR-679).
    const everyRequest = { ...common, failedOnly: false, limit: options.forgotPasswordMax ?? DEFAULT_FORGOT_PASSWORD_MAX };
    const forgotPasswordPerIp = createRateLimiter({ ...everyRequest, keyOf: () => 'forgot_password' });
    const forgotPasswordPerAccount = createRateLimiter({
        ...everyRequest, perIp: false, keyOf: (req) => `forgot_password|${accountHashOf(req)}`,
    });

    return {
        // Only on requests whose client IP comes from X-Forwarded-For behind a trusted proxy.
        perIp: options.perClientIp
            ? (req, res, next) => (hasForwardedClientIp(req) ? perIp(req, res, next) : next())
            : passThrough,
        // Keyed on the account / token alone (perIp: false): a brute force spread over many client IPs
        // still trips the limit, whatever TRUST_PROXY and X-Forwarded-For say.
        perAccount: createRateLimiter({ ...common, perIp: false, limit: options.accountMax, keyOf: accountOf }),
        perRefreshToken: createRateLimiter({ ...common, perIp: false, limit: options.accountMax, keyOf: refreshTokenHashOf }),
        // Same TRUST_PROXY / X-Forwarded-For rule as perIp: without them every client is the front pod.
        forgotPasswordPerIp: options.perClientIp
            ? (req, res, next) => (hasForwardedClientIp(req) ? forgotPasswordPerIp(req, res, next) : next())
            : passThrough,
        forgotPasswordPerAccount: (req, res, next) => (hasAccount(req) ? forgotPasswordPerAccount(req, res, next) : next()),
    };
}
