import type { Request, RequestHandler, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

/**
 * Rate limiting of the authentication routes (brute force of passwords and one-time tokens).
 *
 * Only failed attempts are counted (`skipSuccessfulRequests`), so users who sign in normally are
 * never throttled. Counters live in memory, per BFF replica.
 *
 * Environment:
 * - `AUTH_RATE_LIMIT_ENABLED`     `false` disables every limiter (load tests), default enabled.
 * - `AUTH_RATE_LIMIT_WINDOW_MS`   window length, default 15 minutes.
 * - `AUTH_RATE_LIMIT_MAX`         failed logins per (client IP, account e-mail) and window, default 10.
 * - `AUTH_RATE_LIMIT_IP_MAX`      failed attempts per client IP and window over every limited route,
 *                                 default 100.
 *
 * The client IP is `req.ip`: behind a reverse proxy, set `TRUST_PROXY` (see `parseTrustProxy`)
 * so that Express reads it from `X-Forwarded-For`, otherwise every client shares the proxy's IP.
 */

export const RATE_LIMIT_MESSAGE = 'Too many attempts, please try again later';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_ACCOUNT_MAX = 10;
const DEFAULT_IP_MAX = 100;

export interface AuthRateLimitOptions {
    enabled: boolean;
    windowMs: number;
    accountMax: number;
    ipMax: number;
}

export interface AuthRateLimiters {
    /** Failed attempts per client IP, shared by every limited authentication route. */
    perIp: RequestHandler;
    /** Failed logins per (client IP, account e-mail). */
    perAccount: RequestHandler;
}

function positiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function authRateLimitOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): AuthRateLimitOptions {
    return {
        enabled: env.AUTH_RATE_LIMIT_ENABLED?.trim().toLowerCase() !== 'false',
        windowMs: positiveInteger(env.AUTH_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS),
        accountMax: positiveInteger(env.AUTH_RATE_LIMIT_MAX, DEFAULT_ACCOUNT_MAX),
        ipMax: positiveInteger(env.AUTH_RATE_LIMIT_IP_MAX, DEFAULT_IP_MAX),
    };
}

function clientIp(req: Request): string {
    return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown');
}

function accountOf(req: Request): string {
    const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * A request counts as a failure when it ends in an error status. 412 is the regular answer of a
 * first sign-in (password to change), not a failed attempt.
 */
function requestWasSuccessful(_req: Request, res: Response): boolean {
    return res.statusCode < 400 || res.statusCode === 412;
}

export function createAuthRateLimiters(options: AuthRateLimitOptions = authRateLimitOptionsFromEnv()): AuthRateLimiters {
    const common = {
        windowMs: options.windowMs,
        standardHeaders: 'draft-8' as const,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        requestWasSuccessful,
        skip: () => !options.enabled,
        message: { message: RATE_LIMIT_MESSAGE },
    };

    return {
        perIp: rateLimit({
            ...common,
            identifier: 'auth-ip',
            requestPropertyName: 'authIpRateLimit',
            limit: options.ipMax,
            keyGenerator: (req) => clientIp(req),
        }),
        perAccount: rateLimit({
            ...common,
            identifier: 'auth-account',
            requestPropertyName: 'authAccountRateLimit',
            limit: options.accountMax,
            keyGenerator: (req) => `${clientIp(req)}|${accountOf(req)}`,
        }),
    };
}

/**
 * Parses `TRUST_PROXY` into Express' `trust proxy` setting:
 * unset or `false` → do not trust any proxy (default), `true` → trust every hop,
 * an integer → number of trusted hops, anything else → comma-separated addresses/subnets
 * (e.g. `loopback, 10.0.0.0/8`).
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.toLowerCase() === 'false') {
        return false;
    }
    if (trimmed.toLowerCase() === 'true') {
        return true;
    }
    if (/^\d+$/.test(trimmed)) {
        return Number(trimmed);
    }
    return trimmed;
}
