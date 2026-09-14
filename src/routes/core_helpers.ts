import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { Response } from 'express';
import type {
    CreateUserView,
    ForceChangePasswordView,
    GetUserResponseView,
    LoginResponseView,
    LoginView,
} from '@mairie360/core-api-openapi/model';
import { coreAdminUsersClient, coreAuthClient, coreUsersClient } from '../clients/coreClient';

function authOptions(incomingRequestToken?: string): AxiosRequestConfig {
    if (!incomingRequestToken) {
        return {};
    }

    return {
        headers: {
            Authorization: incomingRequestToken,
        },
    };
}

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

export async function registerUser(registerView: CreateUserView): Promise<void> {
    await coreAdminUsersClient.adminPostUser(registerView);
}

export async function forceChangeUserPassword(
    forceChangePasswordView: ForceChangePasswordView,
): Promise<void> {
    await coreAuthClient.forceChangePassword(forceChangePasswordView);
}

export async function fetchUserAbout(
    userId: number,
    incomingRequestToken?: string,
): Promise<GetUserResponseView> {
    const response = await coreUsersClient.getUser(userId, authOptions(incomingRequestToken));
    return response.data;
}
