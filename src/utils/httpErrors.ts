import { HttpError, mapUpstreamError } from '@mairie360/bffs-lib';
import axios from 'axios';
import type { ZodError } from 'zod';

type InputLocation = 'body' | 'query' | 'params';

/** 400 for a request that fails its Zod schema; every issue becomes a `{ path, message }` detail (`body.email`, ...). */
export function invalidInput(message: string, error: ZodError, location: InputLocation): HttpError {
    return new HttpError(400, message, {
        details: error.issues.map((issue) => ({
            path: [location, ...issue.path.map(String)].join('.'),
            message: issue.message,
        })),
    });
}

/** 400 for one invalid parameter, e.g. `invalidParameter('params', 'userId')`. */
export function invalidParameter(location: InputLocation, name: string): HttpError {
    return new HttpError(400, `Invalid ${name}`, { details: [{ path: `${location}.${name}`, message: 'Must be a positive integer' }] });
}

/**
 * Error to throw for a failed Core API call. Only the Core 4xx the route declares in its contract
 * (`declared`) are kept, with a generic message; any other Core status and a network failure become a
 * 502. The Core body is never relayed. Anything that is not an upstream failure (a bug) is returned
 * unchanged, so errorHandler() answers a generic 500.
 */
export function coreError(error: unknown, declared: readonly number[] = []): unknown {
    if (error instanceof HttpError) return error;
    if (!axios.isAxiosError(error)) return error;
    if (error.response === undefined) return new HttpError(502, 'The Core API service is unavailable.');
    return mapUpstreamError(error, declared);
}
