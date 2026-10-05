import { HttpError } from '@mairie360/bffs-lib';
import type { AxiosResponse } from 'axios';
import type { Response } from 'express';
import type { z } from 'zod';

/**
 * Keeps only the fields declared by the BFF contract: anything Core API adds to its answer is dropped
 * instead of being relayed. An answer that does not match the contract is an invalid upstream answer (502).
 */
export function whitelist<T>(schema: z.ZodType<T>, data: unknown): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        throw new HttpError(502, 'The CORE_API answer is invalid.');
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
