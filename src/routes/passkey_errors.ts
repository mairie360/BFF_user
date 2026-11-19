import axios from 'axios';
import { HttpError } from '@mairie360/bffs-lib';

/** Core answers 503 when it has no WebAuthn relying party: kept, so the front falls back to the password. */
export function passkeysUnavailable(error: unknown): HttpError | undefined {
    return axios.isAxiosError(error) && error.response?.status === 503
        ? new HttpError(503, 'Passkeys are not configured')
        : undefined;
}
