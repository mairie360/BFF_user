import { authorization, baseUrl, HttpError } from '@mairie360/bffs-lib';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { Request, Response } from 'express';
import type { z } from 'zod';

/**
 * Options of a Core API call on behalf of the caller: the `Authorization: Bearer <jwt>` header of the
 * request, forwarded as is. Throws a 401 before any upstream call when the request carries no Bearer
 * token (cookies and other headers are ignored: the fronts' proxy turns the `accessToken` cookie into
 * this header). Core API's URL is read now (`CORE_API_URL`): 503 when it is missing, after the 401.
 */
export function coreRequestOptions(req: Request): AxiosRequestConfig {
    const Authorization = authorization(req);
    return { baseURL: baseUrl('CORE_API'), headers: { Authorization } };
}

/** Core API's URL as call options, read now (503 when missing): anonymous calls (sign-in, refresh) or with a session already read. */
export function coreUrlOptions(): AxiosRequestConfig {
    return { baseURL: baseUrl('CORE_API') };
}

/**
 * Keeps only the fields declared by the BFF contract: anything Core API adds to its answer is dropped
 * instead of being relayed. An answer that does not match the contract is an invalid upstream answer (502).
 */
export function whitelist<T>(schema: z.ZodType<T>, data: unknown): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        throw new HttpError(502, 'Core API returned an unexpected response');
    }
    return parsed.data;
}

/**
 * Relays a Core API answer. With a schema, the body is reduced to the fields of the BFF contract
 * (`whitelist`); without one (write routes whose contract is an opaque `CoreResponse`), it is relayed as is.
 */
export function forwardCoreResponse<T>(res: Response, response: AxiosResponse<T>, schema?: z.ZodType): Response {
    if (response.status === 204 || response.data === undefined || response.data === '') {
        return res.status(response.status).send();
    }

    // Core sometimes answers plain text (e.g. "User created successfully!"): the BFF contract announces JSON.
    const body = toJsonBody(response.data);
    return res.status(response.status).json(schema ? whitelist(schema, body) : body);
}

function toJsonBody(data: unknown): unknown {
    // Core sometimes answers a text body (e.g. "Forbidden: User is not an admin."): it is wrapped in JSON
    // to keep a consistent Content-Type on the BFF side.
    return typeof data === 'string' ? { message: data } : data;
}

export function parsePositiveInteger(value: string): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
