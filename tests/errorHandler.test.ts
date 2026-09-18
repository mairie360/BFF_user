import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../src/middleware/errorHandler';

function handle(error: unknown) {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    errorHandler(error, {} as Request, { status } as unknown as Response, jest.fn() as NextFunction);
    return { status: (status.mock.calls[0] as unknown[])[0], body: (json.mock.calls[0] as unknown[])[0] };
}

function withStatus(message: string, fields: Record<string, unknown>) {
    return Object.assign(new Error(message), fields);
}

describe('errorHandler', () => {
    const nodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        process.env.NODE_ENV = nodeEnv;
    });

    it.each([
        [401, 'Authentification échouée'],
        [403, 'Accès refusé'],
        [404, 'Ressource non trouvée'],
    ])('maps an upstream %i to its dedicated message', (code, message) => {
        expect(handle(withStatus('détail interne', { status: code }))).toEqual({
            status: code,
            body: { message, error: undefined },
        });
    });

    it('keeps other client errors, read from statusCode, without exposing the detail', () => {
        expect(handle(withStatus('Unexpected token', { statusCode: 400 }))).toEqual({
            status: 400,
            body: { message: 'Requête invalide', error: undefined },
        });
    });

    it('ignores a non-numeric status and falls back to 500', () => {
        expect(handle(withStatus('boom', { status: '413' }))).toEqual({
            status: 500,
            body: { message: 'Erreur serveur', error: undefined },
        });
    });

    it.each([
        ['a server status', withStatus('boom', { status: 503 })],
        ['a non-object error', 'boom'],
        ['a null error', null],
    ])('answers 500 for %s', (_label, error) => {
        expect(handle(error)).toEqual({ status: 500, body: { message: 'Erreur serveur', error: undefined } });
    });

    it('exposes the error message in development only', () => {
        process.env.NODE_ENV = 'development';

        expect(handle(withStatus('JSON invalide', { status: 400 })).body).toEqual({ message: 'Requête invalide', error: 'JSON invalide' });
        expect(handle({ status: 404 }).body).toEqual({ message: 'Ressource non trouvée', error: undefined });
    });
});
