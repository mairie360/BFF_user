import { coreClient } from '../src/clients/coreClient';
import { keycloakLoginUser } from '../src/routes/core_helpers';
import { axiosResponse, loginResponse } from './support/core-fixtures';

// POST /api/v1/auth/keycloak is not in @mairie360/core-api-openapi 1.2.0 yet, so the contract-driven mock of
// user.upstream-mocks.test.ts cannot serve it: the hand-written call is checked here instead.
describe('coreAuthClient.keycloakLogin', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.CORE_API_URL;
    });

    it('posts the authorization code anonymously to Core API /api/v1/auth/keycloak', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const post = jest.spyOn(coreClient, 'post').mockResolvedValue(axiosResponse(loginResponse()));
        const view = { code: 'code', redirect_uri: 'https://login.mairie360.fr/auth/callback', device_info: 'Firefox' };

        process.env.CORE_API_URL = 'http://core.test';

        const response = await keycloakLoginUser(view);

        expect(response.data).toEqual(loginResponse());
        expect(post).toHaveBeenCalledWith('/api/v1/auth/keycloak', view, { baseURL: 'http://core.test' });
    });

    it('never falls back to a localhost URL: 503 without any call when CORE_API_URL is missing', async () => {
        const post = jest.spyOn(coreClient, 'post');
        delete process.env.CORE_API_URL;

        await expect(keycloakLoginUser({ code: 'code', redirect_uri: 'https://login.mairie360.fr/auth/callback', device_info: 'Firefox' }))
            .rejects.toMatchObject({ status: 503, message: 'The CORE_API service is not configured.' });
        expect(post).not.toHaveBeenCalled();
        expect(coreClient.defaults.baseURL).toBeUndefined();
    });
});
