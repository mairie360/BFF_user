import axios, { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import type { Response } from 'express';
import type {
    ForceChangePasswordView,
    LoginResponseView,
    LoginView,
    RegisterView,
} from '@mairie360/core-api-openapi/model';
import { coreAuthClient, coreUsersClient } from '../clients/coreClient';
import type { KeycloakLoginView } from '../clients/coreClient';
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

/** Keycloak sign-in: POST /api/v1/auth/keycloak, public on Core API like the password login. */
export async function keycloakLoginUser(
    keycloakLoginView: KeycloakLoginView,
): Promise<AxiosResponse<LoginResponseView>> {
    return coreAuthClient.keycloakLogin(keycloakLoginView);
}

/** Inscription publique : POST /api/v1/auth/register, exempté de JWT par Core API (aucun jeton privilégié). */
export async function registerUser(registerView: RegisterView): Promise<void> {
    await coreAuthClient.register(registerView);
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
