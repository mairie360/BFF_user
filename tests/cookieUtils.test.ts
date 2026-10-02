import type { Response } from 'express';
import {
    clearRefreshTokenCookie,
    clearTokenCookie,
    extractTokenFromHeader,
    setRefreshTokenCookie,
    transmitAccessToken,
} from '../src/utils/cookieUtils';

describe('cookieUtils', () => {
    it('extracts a Bearer token without the scheme', () => {
        expect(extractTokenFromHeader('Bearer header.payload.signature'))
            .toBe('header.payload.signature');
        expect(extractTokenFromHeader('bearer header.payload.signature'))
            .toBe('header.payload.signature');
    });

    it('rejects a malformed Authorization header or another scheme', () => {
        expect(extractTokenFromHeader('header.payload.signature')).toBeNull();
        expect(extractTokenFromHeader('Basic dXNlcjpwYXNz')).toBeNull();
        expect(extractTokenFromHeader('Bearer a b')).toBeNull();
        expect(extractTokenFromHeader(undefined)).toBeNull();
    });

    it('stores the raw JWT in a strict HttpOnly cookie and never in a response header', () => {
        const cookie = jest.fn();
        const setHeader = jest.fn();
        const response = { cookie, setHeader } as unknown as Response;

        const transmitted = transmitAccessToken(
            response,
            'Bearer header.payload.signature',
        );

        expect(transmitted).toBe(true);
        expect(cookie).toHaveBeenCalledWith(
            'accessToken',
            'header.payload.signature',
            expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' }),
        );
        expect(setHeader).not.toHaveBeenCalled();
    });

    it('scopes the refresh-token cookie to /auth', () => {
        const cookie = jest.fn();
        const clearCookie = jest.fn();
        const response = { cookie, clearCookie } as unknown as Response;

        setRefreshTokenCookie(response, 'opaque-refresh-token');
        clearRefreshTokenCookie(response);

        expect(cookie).toHaveBeenCalledWith(
            'refreshToken',
            'opaque-refresh-token',
            expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/auth' }),
        );
        expect(clearCookie).toHaveBeenCalledWith(
            'refreshToken',
            expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/auth' }),
        );
    });

    it('uses the configured domain consistently when setting and clearing the cookie', () => {
        process.env.COOKIE_DOMAIN = '.dev.mairie360-eip.fr';
        const cookie = jest.fn();
        const clearCookie = jest.fn();
        const response = { cookie, clearCookie } as unknown as Response;

        transmitAccessToken(response, 'Bearer header.payload.signature');
        clearTokenCookie(response);

        expect(cookie).toHaveBeenCalledWith(
            'accessToken',
            'header.payload.signature',
            expect.objectContaining({
                domain: '.dev.mairie360-eip.fr',
                path: '/',
            }),
        );
        expect(clearCookie).toHaveBeenCalledWith(
            'accessToken',
            expect.objectContaining({
                domain: '.dev.mairie360-eip.fr',
                path: '/',
            }),
        );

        delete process.env.COOKIE_DOMAIN;
    });
});
