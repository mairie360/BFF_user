import { createHash } from 'node:crypto';
import { createRateLimiter, parseTrustProxy } from '@mairie360/bffs-lib';
import type { Request, RequestHandler, Response } from 'express';
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
 *                                 default 100. Only applied when `TRUST_PROXY` is set and the request
 *                                 carries `X-Forwarded-For`.
 *
 * The lib keys every counter on `req.ip` plus an optional part (`<ip>|<e-mail>`, `<ip>|<token hash>`).
 * `req.ip` is only the real client when `TRUST_PROXY` (see `parseTrustProxy` of `@mairie360/bffs-lib`)
 * tells Express to read it from `X-Forwarded-For`; otherwise it is the calling front pod's, shared by every
 * user. The per-e-mail and per-refresh-token keys then stay per account / per token (one counter per front
 * pod), while the IP-only limit, which would become a global lockout any attacker can trigger, is skipped:
 * it only runs when `TRUST_PROXY` is set and the request carries `X-Forwarded-For`.
 */

export const RATE_LIMIT_MESSAGE = 'Too many attempts, please try again later';

const ENV_PREFIX = 'AUTH_RATE_LIMIT';
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_ACCOUNT_MAX = 10;
const DEFAULT_IP_MAX = 100;

export interface AuthRateLimitOptions {
    enabled: boolean;
    windowMs: number;
    accountMax: number;
    ipMax: number;
    /** Whether `req.ip` identifies the client (`TRUST_PROXY` set): enables the per-IP limit. */
    perClientIp: boolean;
}

export interface AuthRateLimiters {
    /** Failed attempts per client IP, shared by every limited authentication route (only with `X-Forwarded-For`). */
    perIp: RequestHandler;
    /** Failed logins per (client IP, account e-mail). */
    perAccount: RequestHandler;
    /**
     * Failed refreshes per (client IP, refresh token SHA-256; the raw token never reaches the store). The
     * refresh body carries no e-mail; without `TRUST_PROXY` the IP is the front pod's, so the token is the
     * only part that cannot lock other users out. It stops replaying a revoked or stolen token; guessing a
     * valid one is out of reach (high-entropy token) and is further capped by `perIp` when `TRUST_PROXY` is set.
     */
    perRefreshToken: RequestHandler;
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
        console.warn('[BFF Auth] TRUST_PROXY is not set: per-IP rate limiting is disabled, only the per-e-mail limit applies.');
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

    return {
        // Only on requests whose client IP comes from X-Forwarded-For behind a trusted proxy.
        perIp: options.perClientIp
            ? (req, res, next) => (hasForwardedClientIp(req) ? perIp(req, res, next) : next())
            : passThrough,
        perAccount: createRateLimiter({ ...common, limit: options.accountMax, keyOf: accountOf }),
        perRefreshToken: createRateLimiter({ ...common, limit: options.accountMax, keyOf: refreshTokenHashOf }),
    };
}
