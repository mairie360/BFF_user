import axios, { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import type { Response } from 'express';
import type {
    ForceChangePasswordView,
    LoginResponseView,
    LoginView,
} from '@mairie360/core-api-openapi/model';
import { coreAuthClient, coreSessionsClient, coreUsersClient } from '../clients/coreClient';
import type { AboutResponseView } from '../openapi-registry';

function toJsonErrorBody(data: unknown): unknown {
    // Le Core renvoie parfois un corps texte : on le normalise en JSON pour
    // garder un Content-Type cohérent côté BFF.
    return typeof data === 'string' ? { message: data } : data;
}

export function handleUnknownError(res: Response, error: unknown): Response {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status ?? 502;

        // Une erreur 5xx du Core est une défaillance amont : 502 Bad Gateway.
        if (status >= 500) {
            console.error('[BFF] Upstream error', status, axiosError.message);
            return res.status(502).json({ message: 'Upstream service error' });
        }

        if (axiosError.response?.data !== undefined) {
            return res.status(status).json(toJsonErrorBody(axiosError.response.data));
        }

        return res.status(status).json({ message: axiosError.message });
    }

    // Ne jamais exposer le message d'une erreur interne (fuite d'information).
    console.error('[BFF] Unexpected error', error);
    return res.status(500).json({ message: 'Internal server error' });
}

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
