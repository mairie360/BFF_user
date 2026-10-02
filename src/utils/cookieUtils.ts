import type { CookieOptions, Request, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

/** The refresh token is only ever needed by `/auth/refresh` and `/auth/logout`. */
const REFRESH_TOKEN_COOKIE_PATH = '/auth';
const ACCESS_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** HttpOnly + SameSite=Strict, like the cookies set by the Login front. */
function sessionCookieOptions(path: string): CookieOptions {
    const domain = process.env.COOKIE_DOMAIN?.trim();

    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path,
        ...(domain ? { domain } : {}),
    };
}

/** Stores the access JWT in the HttpOnly `accessToken` cookie. */
export function setTokenCookie(res: Response, token: string): void {
    res.cookie(ACCESS_TOKEN_COOKIE, token, {
        ...sessionCookieOptions('/'),
        maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });
}

/** Stores the Core refresh token in the HttpOnly `refreshToken` cookie, only sent to `/auth/*`. */
export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        ...sessionCookieOptions(REFRESH_TOKEN_COOKIE_PATH),
        maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
}

/**
 * Stores the access JWT returned by Core (`Authorization: Bearer <jwt>`) in the HttpOnly cookie only:
 * the token is never copied to a channel readable by the browser's JavaScript (response header or body).
 */
export function transmitAccessToken(res: Response, authorizationHeader: string | undefined): boolean {
    const token = extractTokenFromHeader(authorizationHeader);
    if (!token) {
        return false;
    }

    setTokenCookie(res, token);
    return true;
}

/** Clears the access-token cookie. */
export function clearTokenCookie(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, sessionCookieOptions('/'));
}

/** Clears the refresh-token cookie. */
export function clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, sessionCookieOptions(REFRESH_TOKEN_COOKIE_PATH));
}

/** Value of a cookie parsed by `cookie-parser`, if it is a non-empty string. */
export function readCookie(req: Request, name: string): string | undefined {
    const value: unknown = (req as Request & { cookies?: Record<string, unknown> }).cookies?.[name];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Extracts the token of a `Bearer <token>` Authorization header (scheme case-insensitive).
 * @returns the token, or null for a missing header or any other scheme
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
        return null;
    }

    const match = /^Bearer ([^\s]+)$/i.exec(authHeader.trim());
    return match ? match[1] : null;
}
