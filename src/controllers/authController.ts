import { Request, Response } from 'express';
import { AuthenticationService } from '@mairie360/core-api-openapi';
import { validateLoginInput } from '../utils/validators';
import { setTokenCookie, clearTokenCookie } from '../utils/cookieUtils';

/**
 * Login - Authentifier un utilisateur
 * POST /auth/login
 */
export async function login(req: Request, res: Response) {
    try {
        const { email, password } = req.body;

        // Valider les inputs (verification en plus de celle du coreapi)
        const validation = validateLoginInput(email, password);
        if (!validation.valid) {
            return res.status(400).json({ 
                message: 'Validation error',
                errors: validation.errors 
            });
        }

        const token = await AuthenticationService.login({
            email,
            password
        });

        // token en cookie HttpOnly
        setTokenCookie(res, token);

        res.json({ 
            accessToken: token,
            message: 'Login successful' 
        });

    } catch (error: any) {
        console.error('Login error:', error);
        
        if (error.status === 401) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        res.status(500).json({ message: 'Authentication failed' });
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
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Logout failed' });
    }
}

/**
 * Get current user info
 * GET /auth/me (PROTÉGÉE)
 */
export function getMe(req: Request, res: Response) {
    try {
        res.json(req.user || { message: 'No user info available' });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Failed to get user info' });
    }
}

export default {
    login,
    logout,
    getMe
};