import { Response } from 'express';

/**
 * Ajouter le token d'accès dans un cookie HttpOnly
 * @param res - Response Express
 * @param token - Token JWT du Core API
 */
export function setTokenCookie(res: Response, token: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('accessToken', token, {
        httpOnly: true,           
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 
    });
}

/**
 * Supprimer le token d'accès du cookie
 * @param res - Response Express
 */
export function clearTokenCookie(res: Response): void {
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
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
