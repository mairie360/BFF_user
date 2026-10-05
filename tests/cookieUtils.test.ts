import type { Response } from 'express';
import {
    clearRefreshTokenCookie,
    clearTokenCookie,
    setRefreshTokenCookie,
    transmitAccessToken,
} from '../src/utils/cookieUtils';

describe('cookieUtils', () => {
    it.each([
        ['Bearer header.payload.signature', 'header.payload.signature'],
        ['bearer header.payload.signature', 'header.payload.signature'],
    ])('stores the token of the Core header %s without the scheme', (header, token) => {
        const cookie = jest.fn();
        const response = { cookie } as unknown as Response;

        expect(transmitAccessToken(response, header)).toBe(true);
        expect(cookie).toHaveBeenCalledWith('accessToken', token, expect.any(Object));
    });

    it.each([
        ['a header without scheme', 'header.payload.signature'],
        ['another scheme', 'Basic dXNlcjpwYXNz'],
        ['a token with spaces', 'Bearer a b'],
        ['no header', undefined],
    ])('sets no cookie for %s', (_label, header) => {
        const cookie = jest.fn();
        const response = { cookie } as unknown as Response;

        expect(transmitAccessToken(response, header)).toBe(false);
        expect(cookie).not.toHaveBeenCalled();
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
