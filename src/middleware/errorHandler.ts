import { Request, Response, NextFunction } from 'express';

function getErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) {
        return undefined;
    }

    // body-parser (express.json) et http-errors exposent status et statusCode.
    for (const key of ['status', 'statusCode'] as const) {
        if (key in error) {
            const value = (error as Record<string, unknown>)[key];
            if (typeof value === 'number') {
                return value;
            }
        }
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

    // Autres erreurs client (ex. JSON malformé -> 400, corps trop volumineux -> 413) :
    // on conserve le statut sans exposer le détail interne.
    if (status !== undefined && status >= 400 && status < 500) {
        return res.status(status).json({
            message: 'Requête invalide',
            error: process.env.NODE_ENV === 'development' ? message : undefined,
        });
    }

    // Erreur par défaut
    res.status(500).json({
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? message : undefined,
    });
}
