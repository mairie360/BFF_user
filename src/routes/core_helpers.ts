import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig } from 'axios';
import type { Response } from 'express';
import type {
    CreateUserView,
    ForceChangePasswordView,
    GetUserResponseView,
    LoginResponseView,
    LoginView,
} from '@mairie360/core-api-openapi/models';
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

export function handleUnknownError(res: Response, error: unknown): Response {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status ?? 502;

        return res.status(status).json(axiosError.response?.data ?? {
            message: axiosError.message,
        });
    }

    return res.status(500).json({
        message: error instanceof Error ? error.message : 'Unexpected error',
    });
}

export function isLoginResponseView(value: unknown): value is LoginResponseView {
    return (
        typeof value === 'object'
        && value !== null
        && 'refresh_token' in value
        && typeof value.refresh_token === 'string'
    );
}

export async function loginUser(loginView: LoginView): Promise<LoginResponseView> {
    const response = await coreAuthClient.login(loginView);
    return response.data;
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
