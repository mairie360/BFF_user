import { Request, Response } from 'express';
import axios from 'axios';
import { clearTokenCookie, setTokenCookie } from '../utils/cookieUtils';
import type {
    CreateUserView,
    ForceChangePasswordView,
    LoginResponseView,
    LoginView,
} from '@mairie360/core-api-openapi/models';
import { coreAdminUsersClient, coreAuthClient } from '../clients/coreClient';

function sendCoreError(error: unknown, res: Response) {
    if (axios.isAxiosError(error) && error.response) {
        return res.status(error.response.status).json(error.response.data);
    }

    return res.status(500).json({ message: 'Unknown error', error });
}

function isHttpError(error: unknown): error is { status: number; body: unknown } {
    return (
        typeof error === 'object'
        && error !== null
        && 'status' in error
        && 'body' in error
        && typeof error.status === 'number'
    );
}

/**
 * Login - Authentifier un utilisateur
 * POST /auth/login
 */
export async function login(req: Request, res: Response) {
    try {
        const loginView: LoginView = req.body;
        const { data: token } = await coreAuthClient.login(loginView);

        if (isLoginResponseView(token)) {
            setTokenCookie(res, token.refresh_token);
        }

        res.status(200).json(token);
    } catch (error) {
        sendCoreError(error, res);
    }
}

/**
 * Register - Créer un utilisateur
 * POST /auth/register
 */
export async function register(req: Request, res: Response) {
    try {
        const registerView: CreateUserView = req.body;
        await coreAdminUsersClient.adminPostUser(registerView);

        res.status(201).send();
    } catch (error) {
        sendCoreError(error, res);
    }
}

/**
 * Force change password - Change un mot de passe via token Core API
 * POST /auth/force-change-password
 */
export async function forceChangePassword(req: Request, res: Response) {
    try {
        const forceChangePasswordView: ForceChangePasswordView = req.body;
        await coreAuthClient.forceChangePassword(forceChangePasswordView);

        res.status(204).send();
    } catch (error) {
        sendCoreError(error, res);
    }
}

/**
 * Logout - Déconnecter un utilisateur
 * POST /auth/logout
 */
export function logout(req: Request, res: Response) {
    try {
        clearTokenCookie(res);

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        if (isHttpError(error)) {
            res.status(error.status).json(error.body);
        } else {
            console.error('Logout error:', error);
            res.status(500).json({ message: 'Logout failed', error });
        }
    }
}

function isLoginResponseView(value: unknown): value is LoginResponseView {
    return (
        typeof value === 'object'
        && value !== null
        && 'refresh_token' in value
        && typeof value.refresh_token === 'string'
    );
}

export default {
    login,
    register,
    forceChangePassword,
    logout,
};
