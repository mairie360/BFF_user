import type { AxiosResponse } from 'axios';
import type {
    ForceChangePasswordView,
    LoginResponseView,
    LoginView,
} from '@mairie360/core-api-openapi/model';
import { coreAuthClient, coreSessionsClient, coreUsersClient } from '../clients/coreClient';
import type { KeycloakLoginView } from '../clients/coreClient';
import type { AboutResponseView } from '../openapi-registry';

export function isLoginResponseView(value: unknown): value is LoginResponseView {
    return (
        typeof value === 'object'
        && value !== null
        && 'refresh_token' in value
        && typeof value.refresh_token === 'string'
    );
}

export async function loginUser(loginView: LoginView): Promise<AxiosResponse<LoginResponseView>> {
    return coreAuthClient.login(loginView);
}

/**
 * Renews the access JWT from a refresh token alone: Core serves POST /api/v1/sessions/refresh outside
 * its JWT middleware (>= 1.2.0), so no session is forwarded and an expired JWT is not needed.
 */
export async function refreshSession(refreshToken: string): Promise<AxiosResponse<string>> {
    return coreSessionsClient.refresh({ refresh_token: refreshToken });
}

/**
 * Revokes the caller's own Core session (POST /api/v1/sessions/revoke): Core checks that the refresh
 * token belongs to the JWT's user, then rejects that JWT on its next session check.
 */
export async function revokeSession(refreshToken: string, authorization: string): Promise<void> {
    await coreSessionsClient.revoke({ refresh_token: refreshToken }, { headers: { Authorization: authorization } });
}

/** Keycloak sign-in: POST /api/v1/auth/keycloak, public on Core API like the password login. */
export async function keycloakLoginUser(
    keycloakLoginView: KeycloakLoginView,
): Promise<AxiosResponse<LoginResponseView>> {
    return coreAuthClient.keycloakLogin(keycloakLoginView);
}

export async function forceChangeUserPassword(
    forceChangePasswordView: ForceChangePasswordView,
): Promise<void> {
    await coreAuthClient.forceChangePassword(forceChangePasswordView);
}

export async function fetchUserAbout(userId: number, authorization: string): Promise<AboutResponseView> {
    const { data } = await coreUsersClient.getUser(userId, { headers: { Authorization: authorization } });
    // Seules les informations publiques du contrat sont exposées : rôle, groupes et archivage restent internes.
    return {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone ?? null,
        status: data.status,
    };
}
