import { asAnonymousClient, callUpstream, type UpstreamRequestOptions } from '@mairie360/bffs-lib';
import type { Request } from 'express';
import type { AxiosResponse } from 'axios';
import type {
    ForceChangePasswordView,
    ForgotPasswordView,
    LoginResponseView,
    LoginView,
    RefreshResponseView,
    ResetPasswordResponseView,
    ResetPasswordView,
} from '@mairie360/core-api-openapi/model';
import { coreAuthClient, coreSessionsClient, coreUsersClient } from '../clients/coreClient';
import type { KeycloakLoginView } from '../clients/coreClient';
import type { AboutResponseView } from '../openapi-registry';

/**
 * The anonymous client a public auth route acts for. Its address (`req.ip`, resolved behind `TRUST_PROXY`) is relayed
 * to Core as `X-Forwarded-For` (`asAnonymousClient`), so Core's per-IP budgets count that client, not this BFF's pod
 * shared by every user (MAIR-679).
 */
export type AnonymousClient = Pick<Request, 'ip' | 'socket' | 'app'>;

export function isLoginResponseView(value: unknown): value is LoginResponseView {
    return (
        typeof value === 'object'
        && value !== null
        && 'refresh_token' in value
        && typeof value.refresh_token === 'string'
    );
}

export async function loginUser(loginView: LoginView, client: AnonymousClient): Promise<AxiosResponse<LoginResponseView>> {
    return coreAuthClient.login(loginView, asAnonymousClient('CORE_API', client));
}

/**
 * Renews the access JWT from a refresh token alone: Core serves POST /api/v1/sessions/refresh outside
 * its JWT middleware (>= 1.2.0), so no session is forwarded and an expired JWT is not needed.
 * Core >= 2.0.0 rotates the refresh token: the one sent stops working and the body carries its replacement.
 */
export async function refreshSession(refreshToken: string, client: AnonymousClient): Promise<AxiosResponse<RefreshResponseView>> {
    return coreSessionsClient.refresh({ refresh_token: refreshToken }, asAnonymousClient('CORE_API', client));
}

/**
 * Ends the session of a refresh token, without a JWT (POST /api/v1/auth/logout, MAIR-692): works after the
 * access JWT expired. Called with `asAnonymousClient('CORE_API', req)`: Core rate-limits it per client
 * address (refresh budget). Core answers the same 204 whether the token matched a session or not.
 */
export async function logoutWithRefreshToken(refreshToken: string, client: UpstreamRequestOptions): Promise<void> {
    await coreAuthClient.logoutWithRefreshToken({ refresh_token: refreshToken }, client);
}

/**
 * Revokes the session the caller's JWT belongs to, from the JWT alone (POST /api/v1/sessions/logout,
 * Core >= 2.0.0): used by /auth/logout when no refresh token is available.
 */
export async function logoutSession(caller: UpstreamRequestOptions): Promise<void> {
    await coreSessionsClient.logout(caller);
}

/** Keycloak sign-in: POST /api/v1/auth/keycloak, public on Core API like the password login. */
export async function keycloakLoginUser(
    keycloakLoginView: KeycloakLoginView,
    client: AnonymousClient,
): Promise<AxiosResponse<LoginResponseView>> {
    return coreAuthClient.keycloakLogin(keycloakLoginView, asAnonymousClient('CORE_API', client));
}

export async function forceChangeUserPassword(
    forceChangePasswordView: ForceChangePasswordView,
    client: AnonymousClient,
): Promise<void> {
    await coreAuthClient.forceChangePassword(forceChangePasswordView, asAnonymousClient('CORE_API', client));
}

/**
 * Asks Core to e-mail a reset link (POST /api/v1/auth/forgot_password, public). Core answers the same empty 200
 * whether the e-mail matches an account or not.
 */
export async function requestPasswordReset(forgotPasswordView: ForgotPasswordView, client: AnonymousClient): Promise<void> {
    await coreAuthClient.forgotPassword(forgotPasswordView, asAnonymousClient('CORE_API', client));
}

/**
 * Consumes the e-mailed reset token (POST /api/v1/auth/reset_password, public): Core saves the new password,
 * revokes the other sessions and opens one, answered like a login (JWT in `Authorization`, refresh token in the body).
 */
export async function resetUserPassword(
    resetPasswordView: ResetPasswordView,
    client: AnonymousClient,
): Promise<AxiosResponse<ResetPasswordResponseView>> {
    return coreAuthClient.resetPassword(resetPasswordView, asAnonymousClient('CORE_API', client));
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
