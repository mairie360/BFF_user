import '../config/registerGeneratedOpenApi';
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { getCoreAPIMairie360 } from '@mairie360/core-api-openapi/endpoints/coreAPIMairie360';
import type { LoginResponseView } from '@mairie360/core-api-openapi/model';

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
        console.log('URL Core API envoyée :', `${config.baseURL ?? ''}${config.url ?? ''}`);
        return config;
    },
    (error) => Promise.reject(error),
);

/** API générée à partir du contrat OpenAPI du Core API. */
export const coreApi = getCoreAPIMairie360(coreClient);

/** Body of Core's `POST /api/v1/auth/keycloak` (`KeycloakLoginView`). */
export interface KeycloakLoginView {
    code: string;
    redirect_uri: string;
    code_verifier?: string | null;
    nonce?: string | null;
    device_info: string;
}

/**
 * Keycloak single sign-on: Core redeems the authorization code and answers like `POST /api/v1/auth/login`.
 * Hand-written because `@mairie360/core-api-openapi` 1.2.0 predates this route: replace it with
 * `coreApi.keycloakLogin` once the package that ships it is installed.
 */
export const keycloakLogin = (keycloakLoginView: KeycloakLoginView, options?: AxiosRequestConfig) => (
    coreClient.post<LoginResponseView>('/api/v1/auth/keycloak', keycloakLoginView, options)
);

// Les regroupements ci-dessous gardent l'interface consommée par les routes
// du BFF, tout en utilisant l'unique client généré `getCoreAPIMairie360`.
export const coreAuthClient = {
    login: coreApi.login,
    keycloakLogin,
    register: coreApi.register,
    forceChangePassword: coreApi.forceChangePassword,
    forgotPassword: coreApi.forgotPassword,
    resetPassword: coreApi.resetPassword,
};

export const coreAdminUsersClient = {
    adminListUsers: coreApi.adminListUsers,
    adminGetUser: coreApi.adminGetUser,
    adminPostUser: coreApi.adminPostUser,
    adminPatchUser: coreApi.adminPatchUser,
    adminDeleteUser: coreApi.adminDeleteUser,
    adminResetUserPassword: coreApi.adminResetUserPassword,
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
    patchGroup: coreApi.patchGroup,
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
