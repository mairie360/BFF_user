import request from 'supertest';
import { app } from '../src/app';
import { fetchUserAbout } from '../src/routes/core_helpers';

// Final middlewares of the app (@mairie360/bffs-lib): every error ends in { error: { code, message, details } }.
jest.mock('../src/routes/core_helpers', () => ({
    ...jest.requireActual<typeof import('../src/routes/core_helpers')>('../src/routes/core_helpers'),
    fetchUserAbout: jest.fn(),
}));

describe('error envelope of the app', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        process.env.CORE_API_URL = 'http://core.test';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('answers an unknown route with a JSON 404', async () => {
        const response = await request(app).get('/unknown');

        expect(response.status).toBe(404);
        expect(response.type).toBe('application/json');
        expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found', details: [] } });
    });

    it('answers an unparsable JSON body with a 400, without the parser detail', async () => {
        const response = await request(app)
            .post('/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"email":');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Invalid request', details: [] } });
    });

    it('answers an unexpected error with a generic 500 that hides its message', async () => {
        jest.mocked(fetchUserAbout).mockRejectedValue(new TypeError('Cannot read properties of undefined (reading secret)'));

        const response = await request(app).get('/user/42/about').set('Authorization', 'Bearer header.payload.signature');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: [] } });
    });
});

describe('security headers of the app (@mairie360/bffs-lib securityHeaders + apiOnlyHeaders)', () => {
    it('sends the strict API-only headers on the JSON routes, without X-Powered-By', async () => {
        const response = await request(app).get('/health');

        expect(response.headers['content-security-policy']).toBe("default-src 'none'");
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['permissions-policy']).toBe('geolocation=(), camera=(), microphone=()');
        expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
        expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('keeps the strict headers on body-parse errors', async () => {
        const response = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{"email":');

        expect(response.status).toBe(400);
        expect(response.headers['content-security-policy']).toBe("default-src 'none'");
    });

    it('lets the interactive documentation load its scripts', async () => {
        const response = await request(app).get('/docs/');

        expect(response.status).toBe(200);
        expect(response.headers['content-security-policy']).not.toBe("default-src 'none'");
        expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    });
});
