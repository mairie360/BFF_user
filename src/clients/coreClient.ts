import '../config/registerGeneratedOpenApi';
import axios, { type AxiosRequestConfig } from 'axios';
import { getCoreApi } from '@mairie360/core-api-openapi/endpoints/coreApi';

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
        // Aucun jeton par défaut : chaque appel transmet uniquement la session de l'appelant, et les routes
        // publiques de Core (/api/v1/auth/*) restent anonymes.

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
