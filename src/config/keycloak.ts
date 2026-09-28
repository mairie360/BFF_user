/**
 * Keycloak single sign-on settings of the BFF (MAIR-143, single logout).
 *
 * The BFF never talks to Keycloak itself: Core API redeems the authorization code (`POST /auth/keycloak`)
 * and keeps neither the ID token nor a Keycloak refresh token, so the BFF cannot close the Keycloak session
 * from the server side. It instead builds the OpenID Connect end-session URL that the browser must
 * navigate to on logout, so Keycloak clears its own SSO cookie and, through its front-channel /
 * back-channel logout, ends the sessions of the other tools of the realm (n8n, ...).
 *
 * Keycloak is optional during the transition from password logins: without `KEYCLOAK_REALM_URL` and
 * `KEYCLOAK_CLIENT_ID`, `POST /auth/logout` only clears the `accessToken` cookie.
 */

export interface KeycloakConfig {
    /** Public URL of the realm, as the browser reaches it (e.g. `https://auth.mairie360.fr/realms/mairie360`). */
    realmUrl: string;
    /** OIDC client the fronts sign in with; Keycloak checks the post-logout redirect URI against it. */
    clientId: string;
    /** Where Keycloak sends the browser once the session is closed, unless the caller supplies its own. */
    postLogoutRedirectUri?: string;
}

function readEnv(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}

/**
 * Reads `KEYCLOAK_REALM_URL`, `KEYCLOAK_CLIENT_ID` and the optional `KEYCLOAK_POST_LOGOUT_REDIRECT_URI` on every
 * call (the same values as Core, minus the client secret, which the BFF never needs).
 *
 * Returns `null`, which disables the Keycloak logout, when the realm URL or the client id is missing.
 */
export function getKeycloakConfig(): KeycloakConfig | null {
    const realmUrl = readEnv('KEYCLOAK_REALM_URL');
    const clientId = readEnv('KEYCLOAK_CLIENT_ID');

    if (!realmUrl || !clientId) {
        if (realmUrl || clientId) {
            console.warn('Keycloak logout disabled: KEYCLOAK_REALM_URL and KEYCLOAK_CLIENT_ID must both be set.');
        }
        return null;
    }

    return {
        realmUrl: realmUrl.replace(/\/+$/, ''),
        clientId,
        postLogoutRedirectUri: readEnv('KEYCLOAK_POST_LOGOUT_REDIRECT_URI'),
    };
}

/**
 * OpenID Connect RP-initiated logout URL of the realm (`GET /protocol/openid-connect/logout`).
 *
 * Core consumes the ID token when it opens the session, so the URL carries `client_id` instead of
 * `id_token_hint`: Keycloak then asks the user to confirm the logout before closing the session, and only
 * accepts `post_logout_redirect_uri` if the client lists it among its valid post-logout redirect URIs.
 */
export function buildKeycloakLogoutUrl(config: KeycloakConfig, postLogoutRedirectUri?: string): string {
    const url = new URL(`${config.realmUrl}/protocol/openid-connect/logout`);
    url.searchParams.set('client_id', config.clientId);

    const redirectUri = postLogoutRedirectUri ?? config.postLogoutRedirectUri;
    if (redirectUri) {
        url.searchParams.set('post_logout_redirect_uri', redirectUri);
    }

    return url.toString();
}
