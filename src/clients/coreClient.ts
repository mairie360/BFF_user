import axios from 'axios';

export function getCoreApiBaseUrl(): string {
    const coreApiUrl = process.env.CORE_API_URL;
    const coreApiPort = process.env.CORE_API_PORT;

    if (!coreApiUrl) {
        return '';
    }

    return coreApiUrl.startsWith('http')
        ? coreApiUrl
        : `http://${coreApiUrl}${coreApiPort ? `:${coreApiPort}` : ''}`;
}

export const coreClient = axios.create({
    baseURL: getCoreApiBaseUrl(),
});
