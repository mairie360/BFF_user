import { buildKeycloakLogoutUrl, getKeycloakConfig } from '../src/config/keycloak';

const KEYCLOAK_ENV = ['KEYCLOAK_REALM_URL', 'KEYCLOAK_CLIENT_ID', 'KEYCLOAK_POST_LOGOUT_REDIRECT_URI'] as const;

describe('getKeycloakConfig', () => {
    beforeEach(() => {
        for (const name of KEYCLOAK_ENV) delete process.env[name];
    });

    afterAll(() => {
        for (const name of KEYCLOAK_ENV) delete process.env[name];
    });

    it('is disabled without any Keycloak variable', () => {
        expect(getKeycloakConfig()).toBeNull();
    });

    it.each([
        ['an empty realm URL', { KEYCLOAK_REALM_URL: '  ', KEYCLOAK_CLIENT_ID: 'mairie360' }],
        ['no client id', { KEYCLOAK_REALM_URL: 'https://auth.mairie360.fr/realms/mairie360' }],
    ])('is disabled, with a warning, with %s', (_case, env) => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        Object.assign(process.env, env);

        expect(getKeycloakConfig()).toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it('reads the realm, the client and the default post-logout redirect, trimming a trailing slash', () => {
        process.env.KEYCLOAK_REALM_URL = 'https://auth.mairie360.fr/realms/mairie360/';
        process.env.KEYCLOAK_CLIENT_ID = 'mairie360';
        process.env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI = 'https://login.mairie360.fr/';

        expect(getKeycloakConfig()).toEqual({
            realmUrl: 'https://auth.mairie360.fr/realms/mairie360',
            clientId: 'mairie360',
            postLogoutRedirectUri: 'https://login.mairie360.fr/',
        });
    });
});

describe('buildKeycloakLogoutUrl', () => {
    const config = { realmUrl: 'https://auth.mairie360.fr/realms/mairie360', clientId: 'mairie360' };

    it('targets the end-session endpoint of the realm with the client id only', () => {
        expect(buildKeycloakLogoutUrl(config))
            .toBe('https://auth.mairie360.fr/realms/mairie360/protocol/openid-connect/logout?client_id=mairie360');
    });

    it('encodes the default post-logout redirect URI', () => {
        expect(buildKeycloakLogoutUrl({ ...config, postLogoutRedirectUri: 'https://login.mairie360.fr/?from=logout' }))
            .toBe('https://auth.mairie360.fr/realms/mairie360/protocol/openid-connect/logout'
                + '?client_id=mairie360&post_logout_redirect_uri=https%3A%2F%2Flogin.mairie360.fr%2F%3Ffrom%3Dlogout');
    });

    it('prefers the redirect URI chosen by the caller over the default one', () => {
        const url = new URL(buildKeycloakLogoutUrl(
            { ...config, postLogoutRedirectUri: 'https://login.mairie360.fr/' },
            'https://projects.mairie360.fr/login',
        ));

        expect(url.searchParams.get('post_logout_redirect_uri')).toBe('https://projects.mairie360.fr/login');
    });
});
