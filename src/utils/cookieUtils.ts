import type { CookieOptions, Response } from 'express';

function accessTokenCookieOptions(): CookieOptions {
    const domain = process.env.COOKIE_DOMAIN?.trim();

    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        ...(domain ? { domain } : {}),
    };
}

/**
 * Ajouter le token d'accès dans un cookie HttpOnly
 * @param res - Response Express
 * @param token - Token JWT du Core API
 */
export function setTokenCookie(res: Response, token: string): void {
    res.cookie('accessToken', token, {
        ...accessTokenCookieOptions(),
        maxAge: 24 * 60 * 60 * 1000
    });
}

/**
 * Transmet le JWT d'accès retourné par le Core et le stocke sans le préfixe
 * `Bearer` dans le cookie HttpOnly.
 */
export function transmitAccessToken(res: Response, authorizationHeader: string | undefined): boolean {
    const token = extractTokenFromHeader(authorizationHeader);
    if (!token) {
        return false;
    }

    setTokenCookie(res, token);
    res.setHeader('Authorization', `Bearer ${token}`);
    res.setHeader('Access-Control-Expose-Headers', 'Authorization');
    return true;
}

/**
 * Supprimer le token d'accès du cookie
 * @param res - Response Express
 */
export function clearTokenCookie(res: Response): void {
    res.clearCookie('accessToken', accessTokenCookieOptions());
}

/**
 * Extraire le token du header Authorization
 * @param authHeader - Header Authorization
 * @returns Token ou null
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
        return null;
    }

    // Format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }

    return parts[1];
}
