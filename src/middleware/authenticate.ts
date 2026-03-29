
import tokenService from '../services/tokenService';

export const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: 'Missing Authorization header' });
    }

    const token = authHeader && authHeader.split(' ')[1]; // Get token place after "Bearer"
    if (!token) {
        return res.status(401).json({ message: 'Missing or invalid token' });
    }

    if (token) {
        const payload = tokenService.verifyAccessToken(token);
        if (!payload) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        req.userId = payload.userId;
        next();
    }
};
