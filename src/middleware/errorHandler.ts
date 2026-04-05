import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de gestion centralisée des erreurs
 */
export function errorHandler(
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.error('Error:', error);

    // Erreurs du Core API
    if (error.status === 401) {
        return res.status(401).json({ 
            message: 'Authentification échouée',
            error: error.message 
        });
    }

    if (error.status === 403) {
        return res.status(403).json({ 
            message: 'Accès refusé',
            error: error.message 
        });
    }

    if (error.status === 404) {
        return res.status(404).json({ 
            message: 'Ressource non trouvée',
            error: error.message 
        });
    }

    // Erreur par défaut
    res.status(500).json({
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
}
