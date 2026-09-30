import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { Request, Response } from 'express';

function asBearerToken(token: string): string {
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

function maskToken(token?: string): string {
    if (!token) {
        return 'absent';
    }

    if (token.length <= 16) {
        return `${token.slice(0, 4)}...`;
    }

    return `${token.slice(0, 12)}...${token.slice(-4)}`;
}

export function bearerToken(req: Request): string | undefined {
    const authorization = req.header('authorization');
    if (authorization) {
        return authorization;
    }

    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const sessionToken = req.header('x-session-token') ?? cookies?.accessToken ?? cookies?.session;

    return sessionToken ? asBearerToken(sessionToken) : undefined;
}

export function coreRequestOptions(req: Request): AxiosRequestConfig {
    const authorization = bearerToken(req);
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;

    console.log('[BFF Admin] Token recu/transmis', {
        incomingAuthorization: maskToken(req.header('authorization')),
        incomingXSessionToken: maskToken(req.header('x-session-token')),
        incomingAccessTokenCookie: maskToken(cookies?.accessToken),
        incomingSessionCookie: maskToken(cookies?.session),
        forwardedAuthorization: maskToken(authorization),
    });

    return authorization
        ? {
            headers: {
                Authorization: authorization,
            },
        }
        : {};
}

export function forwardCoreResponse<T>(res: Response, response: AxiosResponse<T>): Response {
    if (response.status === 204 || response.data === undefined || response.data === '') {
        return res.status(response.status).send();
    }

    // Core renvoie parfois un texte (ex. "User created successfully!") : le contrat du BFF annonce du JSON.
    return res.status(response.status).json(toJsonBody(response.data));
}

function toJsonBody(data: unknown): unknown {
    // Le Core renvoie parfois un corps texte (ex. "Forbidden: User is not an admin.") :
    // on le normalise en JSON pour garder un Content-Type cohérent côté BFF.
    return typeof data === 'string' ? { message: data } : data;
}

export function parsePositiveInteger(value: string): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
