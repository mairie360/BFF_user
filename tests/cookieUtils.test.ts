import type { Response } from 'express';
import {
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
});
