import { assertStartupConfiguration } from '../src/index';
import { JWT_PUBLIC_KEY } from './support/session-keys';

// Fail-fast startup check of the entry point (MAIR-431): run before listen(), never when tests import the app.
describe('assertStartupConfiguration', () => {
    const saved = {
        url: process.env.CORE_API_URL, port: process.env.CORE_API_PORT, publicKey: process.env.JWT_PUBLIC_KEY, secret: process.env.JWT_SECRET,
    };

    afterEach(() => {
        for (const [name, value] of [
            ['CORE_API_URL', saved.url], ['CORE_API_PORT', saved.port], ['JWT_PUBLIC_KEY', saved.publicKey], ['JWT_SECRET', saved.secret],
        ] as const) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    });

    it('accepts a configured instance', () => {
        process.env.CORE_API_URL = 'core';
        process.env.CORE_API_PORT = '3000';
        process.env.JWT_PUBLIC_KEY = JWT_PUBLIC_KEY;

        expect(() => assertStartupConfiguration()).not.toThrow();
    });

    it.each([
        ['missing', undefined],
        ['blank', '  '],
        ['invalid', 'http://exa mple'],
    ])('refuses to start when CORE_API_URL is %s', (_label, url) => {
        if (url === undefined) delete process.env.CORE_API_URL;
        else process.env.CORE_API_URL = url;
        process.env.JWT_PUBLIC_KEY = JWT_PUBLIC_KEY;

        expect(() => assertStartupConfiguration()).toThrow('Missing or invalid upstream configuration: CORE_API_URL');
    });

    it('refuses to start without a session key (MAIR-680)', () => {
        process.env.CORE_API_URL = 'http://core:3000';
        delete process.env.JWT_PUBLIC_KEY;
        delete process.env.JWT_SECRET;

        expect(() => assertStartupConfiguration()).toThrow('Missing configuration: JWT_PUBLIC_KEY');
    });
});
