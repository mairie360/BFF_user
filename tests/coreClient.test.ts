import { coreClient } from '../src/clients/coreClient';
import { deleteUserPasskey, keycloakLoginUser, passkeyLoginOptions, registerUserPasskey } from '../src/routes/core_helpers';
import { axiosResponse, loginResponse } from './support/core-fixtures';

// POST /api/v1/auth/keycloak is still called by hand (coreClient.ts), so the contract-driven mock of
// user.upstream-mocks.test.ts does not serve it: the hand-written call is checked here instead.
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
        expect(post).toHaveBeenCalledWith('/api/v1/auth/keycloak', view, { baseURL: 'http://core.test', timeout: 10_000 });
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

// The passkey operations (MAIR-505) are hand-written too: @mairie360/core-api-openapi 2.0.0 predates them.
describe('passkey calls of coreClient', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.CORE_API_URL;
    });

    it('opens the sign-in ceremony anonymously, without a body', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const options = { challenge_id: '2f9a1c74-5b3e-4d21-9c8a-7e6f0b1d4a35', public_key: { publicKey: {} } };
        const post = jest.spyOn(coreClient, 'post').mockResolvedValue(axiosResponse(options));
        process.env.CORE_API_URL = 'http://core.test';

        const response = await passkeyLoginOptions();

        expect(response.data).toEqual(options);
        expect(post).toHaveBeenCalledWith('/api/v1/auth/passkey/options', undefined, { baseURL: 'http://core.test', timeout: 10_000 });
    });

    it('registers and deletes with the caller\'s session on the trailing-slash Core paths', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const post = jest.spyOn(coreClient, 'post').mockResolvedValue(axiosResponse({ id: 12 }, 201));
        const del = jest.spyOn(coreClient, 'delete').mockResolvedValue(axiosResponse(undefined, 204));
        process.env.CORE_API_URL = 'http://core.test';
        const caller = { baseURL: 'http://core.test', timeout: 10_000, headers: { Authorization: 'Bearer jwt' } };
        const view = { challenge_id: '2f9a1c74-5b3e-4d21-9c8a-7e6f0b1d4a35', label: 'Clé', credential: { id: 'x' } };

        await registerUserPasskey(view, caller);
        await deleteUserPasskey(12, caller);

        expect(post).toHaveBeenCalledWith('/api/v1/user/me/passkeys/', view, caller);
        expect(del).toHaveBeenCalledWith('/api/v1/user/me/passkeys/12/', caller);
    });
});
