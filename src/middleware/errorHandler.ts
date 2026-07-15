import { Request, Response, NextFunction } from 'express';

function getErrorStatus(error: unknown): number | undefined {
    if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
        return error.status;
    }

    return undefined;
}

function getErrorMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.message;
    }

    return undefined;
}

/**
 * Middleware de gestion centralisée des erreurs
 */
export function errorHandler(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    console.error('Error:', error);
    const status = getErrorStatus(error);
    const message = getErrorMessage(error);

    // Erreurs du Core API
    if (status === 401) {
        return res.status(401).json({ 
            message: 'Authentification échouée',
            error: message,
        });
    }

    if (status === 403) {
        return res.status(403).json({ 
            message: 'Accès refusé',
            error: message,
        });
    }

    if (status === 404) {
        return res.status(404).json({ 
            message: 'Ressource non trouvée',
            error: message,
        });
    }

    // Erreur par défaut
    res.status(500).json({
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? message : undefined,
    });
}
