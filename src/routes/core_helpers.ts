import { callUpstream, withoutSession, type UpstreamRequestOptions } from '@mairie360/bffs-lib';
import type { AxiosResponse } from 'axios';
import type {
    ForceChangePasswordView,
    LoginResponseView,
    KeycloakLoginView,
    LoginView,
    RefreshResponseView,
} from '@mairie360/core-api-openapi/model';
import { coreAuthClient, coreSessionsClient, coreUsersClient } from '../clients/coreClient';
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
    return coreAuthClient.login(loginView, withoutSession('CORE_API'));
}

/**
 * Renews the access JWT from a refresh token alone: Core serves POST /api/v1/sessions/refresh outside
 * its JWT middleware (>= 1.2.0), so no session is forwarded and an expired JWT is not needed.
 * Core >= 2.0.0 rotates the refresh token: the one sent stops working and the body carries its replacement.
 */
export async function refreshSession(refreshToken: string): Promise<AxiosResponse<RefreshResponseView>> {
    return coreSessionsClient.refresh({ refresh_token: refreshToken }, withoutSession('CORE_API'));
}

/**
 * Revokes the caller's own Core session (POST /api/v1/sessions/revoke): Core checks that the refresh
 * token belongs to the JWT's user, then rejects that JWT on its next session check.
 */
export async function revokeSession(refreshToken: string, caller: UpstreamRequestOptions): Promise<void> {
    await coreSessionsClient.revoke({ refresh_token: refreshToken }, caller);
}

/** Keycloak sign-in: POST /api/v1/auth/keycloak, public on Core API like the password login. */
export async function keycloakLoginUser(
    keycloakLoginView: KeycloakLoginView,
): Promise<AxiosResponse<LoginResponseView>> {
    return coreAuthClient.keycloakLogin(keycloakLoginView, withoutSession('CORE_API'));
}

export async function forceChangeUserPassword(
    forceChangePasswordView: ForceChangePasswordView,
): Promise<void> {
    await coreAuthClient.forceChangePassword(forceChangePasswordView, withoutSession('CORE_API'));
}

/**
 * Public profile of a user, read with the caller's session (`asCaller('CORE_API', req)`). Core's 401 and 404
 * are relayed, any other failure is a 502; the idempotent read is retried once on a transient failure.
 */
export async function fetchUserAbout(userId: number, caller: UpstreamRequestOptions): Promise<AboutResponseView> {
    const { data } = await callUpstream('CORE_API', () => coreUsersClient.getUser(userId, caller), { declared: [401, 404], retry: true });
    // Only the public fields of the contract are exposed: role, groups and archiving stay internal.
    return {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone ?? null,
        status: data.status,
    };
}
