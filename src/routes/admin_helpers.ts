import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { Request, Response } from 'express';

function asBearerToken(token: string): string {
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
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

    return authorization
        ? {
            headers: {
                Authorization: authorization,
            },
        }
        : {};
}

export function forwardCoreResponse<T>(res: Response, response: AxiosResponse<T>): Response {
    if (response.status === 204 || response.data === undefined) {
        return res.status(response.status).send();
    }

    return res.status(response.status).send(response.data);
}

export function handleUnknownError(res: Response, error: unknown): Response {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status ?? 502;

        if (axiosError.response?.data !== undefined) {
            return res.status(status).send(axiosError.response.data);
        }

        return res.status(status).json({ message: axiosError.message });
    }

    return res.status(500).json({
        message: error instanceof Error ? error.message : 'Unexpected error',
    });
}

export function parsePositiveInteger(value: string): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
