import { Request, Response } from 'express';
import axios from 'axios';
import { clearTokenCookie, setTokenCookie } from '../utils/cookieUtils';
import type { LoginView } from '@mairie360/core-api-openapi/models/LoginView';
import type { RegisterView } from '@mairie360/core-api-openapi/models/RegisterView';
import { coreClient, getCoreApiBaseUrl } from '../clients/coreClient';

function sendCoreError(error: unknown, res: Response) {
    if (axios.isAxiosError(error) && error.response) {
        return res.status(error.response.status).json(error.response.data);
    }

    return res.status(500).json({ message: 'Unknown error', error });
}

/**
 * Login - Authentifier un utilisateur
 * POST /auth/login
 */
export async function login(req: Request, res: Response) {
    try {
        const loginView: LoginView = req.body;
        const { data: token } = await coreClient.post<string>(
            '/api/v1/auth/login',
            loginView,
            { baseURL: getCoreApiBaseUrl() },
        );

        if (typeof token === 'string') {
            setTokenCookie(res, token);
        }

        res.status(200).json(token);
    } catch (error: any) {
        sendCoreError(error, res);
    }
}

/**
 * Register - Créer un utilisateur
 * POST /auth/register
 */
export async function register(req: Request, res: Response) {
    try {
        const registerView: RegisterView = req.body;
        const { data: result } = await coreClient.post<string>(
            '/api/v1/auth/register',
            registerView,
            { baseURL: getCoreApiBaseUrl() },
        );

        res.status(201).json(result);
    } catch (error: any) {
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
    } catch (error: any) {
        if (error && error.status && error.body) {
            res.status(error.status).json(error.body);
        } else {
            console.error('Logout error:', error);
            res.status(500).json({ message: 'Logout failed', error });
        }
    }
}

export default {
    login,
    register,
    logout,
};
