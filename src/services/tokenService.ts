import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Response } from 'express';
import { de } from 'zod/v4/locales';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';

export function verifyAccessToken(token: string) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        return { userId: decoded.sub as string };
    } catch (err) {
        console.error('Invalid access token:', err);
        return null;
    }
}

export function verifyRefreshToken(token: string) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        return { userId: decoded.sub as string };
    } catch (err) {
        console.error('Invalid refresh token:', err);
        return null;
    }
}

export function setRefreshCookieInResponse(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true, // Only work over HTTPS
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });
}

export function clearRefreshCookie(res: Response) {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true, // Only work over HTTPS
        sameSite: 'strict',
    });
}


export default {
    verifyAccessToken,
    verifyRefreshToken,
    setRefreshCookieInResponse,
    clearRefreshCookie
};