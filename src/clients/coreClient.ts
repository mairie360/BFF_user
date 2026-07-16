import '../config/registerGeneratedOpenApi';
import axios, { type AxiosRequestConfig } from 'axios';
import { getCoreApi } from '@mairie360/core-api-openapi/endpoints/coreApi';
import { DEFAULT_JWT_TOKEN } from '../config/token';

/**
 * Construit l'URL du Core API depuis la configuration Docker ou locale.
 * Dans Compose, CORE_API_URL vaut généralement `core` et CORE_API_PORT `3000`.
 */
export function getCoreApiBaseUrl(): string {
    const configuredUrl = process.env.CORE_API_URL || 'http://localhost:3000';
    const configuredPort = process.env.CORE_API_PORT;

    if (configuredUrl.startsWith('http://') || configuredUrl.startsWith('https://')) {
        return configuredUrl;
    }

    return `http://${configuredUrl}${configuredPort ? `:${configuredPort}` : ''}`;
}

/** Instance Axios partagée par tous les endpoints générés par Orval. */
export const coreClient = axios.create({
    baseURL: getCoreApiBaseUrl(),
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
    },
});

coreClient.interceptors.request.use(
    (config) => {
        const currentAuth = config.headers?.Authorization ?? config.headers?.authorization;
        const isLoginRequest = config.url === '/api/v1/auth/login';

        // Le login doit rester anonyme. Pour les autres appels, le token par
        // défaut est utilisé uniquement si la route n'en a pas fourni un.
        if (!isLoginRequest && !currentAuth && DEFAULT_JWT_TOKEN) {
            config.headers.Authorization = DEFAULT_JWT_TOKEN.startsWith('Bearer ')
                ? DEFAULT_JWT_TOKEN
                : `Bearer ${DEFAULT_JWT_TOKEN}`;
        }

        // Le Core expose cet endpoint sans slash final, alors que le client
        // OpenAPI généré le produit avec un slash.
        if (config.url === '/api/v1/auth/force_change_password/') {
            config.url = '/api/v1/auth/force_change_password';
        }

        console.log('URL Core API envoyée :', `${config.baseURL ?? ''}${config.url ?? ''}`);
        return config;
    },
    (error) => Promise.reject(error),
);

/** API générée à partir du contrat OpenAPI du Core API. */
export const coreApi = getCoreApi(coreClient);

// Les regroupements ci-dessous gardent l'interface consommée par les routes
// du BFF, tout en utilisant l'unique client généré `getCoreApi`.
export const coreAuthClient = {
    login: coreApi.login,
    register: coreApi.register,
    forceChangePassword: coreApi.forceChangePassword,
    forgotPassword: coreApi.forgotPassword,
    resetPassword: coreApi.resetPassword,
};

export const coreAdminUsersClient = {
    adminPostUser: coreApi.adminPostUser,
    adminPatchUser: coreApi.adminPatchUser,
    adminDeleteUser: (userId: number, options?: AxiosRequestConfig) =>
        coreClient.delete<void>(`/api/v1/admin/users/${userId}/`, options),
    adminAddRoleToUser: coreApi.adminAddRoleToUser,
    adminDeleteUserRole: coreApi.adminDeleteUserRole,
};

export const coreAdminRolesClient = {
    adminGetRole: coreApi.adminGetRole,
    adminPostRole: coreApi.adminPostRole,
    adminPutRole: coreApi.adminPutRole,
    adminDeleteRole: coreApi.adminDeleteRole,
    adminPatchRole: coreApi.adminPatchRole,
};

export const coreUsersClient = {
    getMe: coreApi.getMe,
    patchMe: coreApi.patchMe,
    getUser: coreApi.getUser,
};

export const coreGroupsClient = {
    getGroups: coreApi.getGroups,
    postGroup: coreApi.postGroup,
    getGroup: coreApi.getGroup,
    deleteGroup: coreApi.deleteGroup,
    // Nom historique conservé pour les routes du BFF.
    getGroupUsers: coreApi.getGroupMembers,
    addUserToGroup: coreApi.addUserToGroup,
    removeUserFromGroup: coreApi.removeUserFromGroup,
};

export const coreSessionsClient = {
    getActiveSessions: coreApi.getActiveSessions,
    history: coreApi.history,
    refresh: coreApi.refresh,
    revoke: coreApi.revoke,
};

export default coreApi;
