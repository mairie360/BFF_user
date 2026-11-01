import { coreClient } from '../src/clients/coreClient';
import { keycloakLoginUser } from '../src/routes/core_helpers';
import { axiosResponse, loginResponse } from './support/core-fixtures';
import { captureLogs } from './support/logs';

// POST /api/v1/auth/keycloak is still called by hand (coreClient.ts), so the contract-driven mock of
// user.upstream-mocks.test.ts does not serve it: the hand-written call is checked here instead.
describe('coreAuthClient.keycloakLogin', () => {
    const client = { ip: '203.0.113.7', socket: {} } as never;

    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.CORE_API_URL;
    });

    it('posts the authorization code anonymously to Core API /api/v1/auth/keycloak', async () => {
        captureLogs();
        const post = jest.spyOn(coreClient, 'post').mockResolvedValue(axiosResponse(loginResponse()));
        const view = { code: 'code', redirect_uri: 'https://login.mairie360.fr/auth/callback', device_info: 'Firefox' };

        process.env.CORE_API_URL = 'http://core.test';

        const response = await keycloakLoginUser(view, client);

        expect(response.data).toEqual(loginResponse());
        // MAIR-679: the browser's address is relayed, so Core rate-limits that client and not the BFF pod.
        expect(post).toHaveBeenCalledWith('/api/v1/auth/keycloak', view, {
            baseURL: 'http://core.test', timeout: 10_000, headers: { 'X-Forwarded-For': '203.0.113.7' },
        });
    });

    it('never falls back to a localhost URL: 503 without any call when CORE_API_URL is missing', async () => {
        const post = jest.spyOn(coreClient, 'post');
        delete process.env.CORE_API_URL;

        await expect(keycloakLoginUser({ code: 'code', redirect_uri: 'https://login.mairie360.fr/auth/callback', device_info: 'Firefox' }, client))
            .rejects.toMatchObject({ status: 503, message: 'The CORE_API service is not configured.' });
        expect(post).not.toHaveBeenCalled();
        expect(coreClient.defaults.baseURL).toBeUndefined();
    });
});
