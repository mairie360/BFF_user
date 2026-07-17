import type { Response } from 'express';
import {
    clearTokenCookie,
    extractTokenFromHeader,
    transmitAccessToken,
} from '../src/utils/cookieUtils';

describe('cookieUtils', () => {
    it('extracts a Bearer token without the scheme', () => {
        expect(extractTokenFromHeader('Bearer header.payload.signature'))
            .toBe('header.payload.signature');
    });

    it('rejects a malformed Authorization header', () => {
        expect(extractTokenFromHeader('header.payload.signature')).toBeNull();
        expect(extractTokenFromHeader(undefined)).toBeNull();
    });

    it('transmits the Bearer header and stores the raw JWT cookie', () => {
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
            expect.objectContaining({ httpOnly: true }),
        );
        expect(setHeader).toHaveBeenCalledWith(
            'Authorization',
            'Bearer header.payload.signature',
        );
        expect(setHeader).toHaveBeenCalledWith(
            'Access-Control-Expose-Headers',
            'Authorization',
        );
    });

    it('uses the configured domain consistently when setting and clearing the cookie', () => {
        process.env.COOKIE_DOMAIN = '.dev.mairie360-eip.fr';
        const cookie = jest.fn();
        const clearCookie = jest.fn();
        const setHeader = jest.fn();
        const response = { cookie, clearCookie, setHeader } as unknown as Response;

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
