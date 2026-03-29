import { Request, Response } from 'express';
import { login as loginService } from '../services/authService';
import tokenService from '../services/tokenService';
import coreClient from '../clients/coreClient';

// Override Express Request type to include user information
declare global {
    namespace Express {
        interface Request {
            user?: { userId: string };
        }
    }
}

async function login(req: Request, res: Response) {
    const body = req.body as { email?: string; password?: string };
    const { email, password } = body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const data = await loginService(email, password);
        const { accessToken, refreshToken, user } = data.data;
        tokenService.setRefreshCookieInResponse(res, refreshToken); // Set refresh token in HTTP-only cookie
        res.json({ accessToken, user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ message: 'Invalid email or password' });
    }
}

async function refresh(req: Request, res: Response) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Missing refresh token' });
    }

    const payload = tokenService.verifyRefreshToken(refreshToken);
    if (!payload) {
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    // will the backend refresh the token

    // const userId = payload.userId;

    // try {
    //     const data = await coreClient.GET(`/users/${userId}`);
    //     const { accessToken, refreshTokenpo: newRefreshToken } = data.data;
    //     tokenService.setRefreshCookieInResponse(res, newRefreshToken); // Update refresh token in cookie
    //     res.json({ accessToken });
    // } catch (error) {
    //     console.error('Error refreshing token:', error);
    //     res.status(500).json({ message: 'Failed to refresh token' });
    // }
}

function logout(req: Request, res: Response) {
    tokenService.clearRefreshCookie(res); // Clear the refresh token cookie
    res.json({ message: 'Logged out successfully' });
}

function getMe(req: Request, res: Response) {
    res.json({ user: req.user });
}

export default {
    login,
    refresh,
    logout,
    getMe
};