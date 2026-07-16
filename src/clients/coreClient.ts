import '../config/registerGeneratedOpenApi';
import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getAdminRoles } from '@mairie360/core-api-openapi/endpoints/admin-roles/admin-roles';
import { getAdminUsers } from '@mairie360/core-api-openapi/endpoints/admin-users/admin-users';
import { getAuth } from '@mairie360/core-api-openapi/endpoints/auth/auth';
import { getGroups } from '@mairie360/core-api-openapi/endpoints/groups/groups';
import { getSessions } from '@mairie360/core-api-openapi/endpoints/sessions/sessions';
import { getUsers } from '@mairie360/core-api-openapi/endpoints/users/users';
import type {
    AddRoleToUserView,
    CreateUserView,
    ForceChangePasswordView,
    GetGroupResultView,
    GetGroupUsersResultView,
    GetGroupsResultView,
    GetMeResponseView,
    GetResponseView,
    GetUserResponseView,
    HistoryResponseView,
    LoginResponseView,
    LoginView,
    PatchMeView,
    PatchUserView,
    PatchView,
    PostGroupView,
    PostUserGroupView,
    RefreshRequestView,
    RevokeRequestView,
    RoleWriteView,
} from '@mairie360/core-api-openapi/models';
import { DEFAULT_JWT_TOKEN } from '../config/token';

type CoreAuthClient = {
    login: (loginView: LoginView, options?: AxiosRequestConfig) => Promise<AxiosResponse<LoginResponseView>>;
    forceChangePassword: (
        forceChangePasswordView: ForceChangePasswordView,
        options?: AxiosRequestConfig,
    ) => Promise<AxiosResponse<void>>;
};

type CoreAdminUsersClient = {
    adminPostUser: (createUserView: CreateUserView, options?: AxiosRequestConfig) => Promise<AxiosResponse<void>>;
    adminPatchUser: (
        userId: number,
        patchUserView: PatchUserView,
        options?: AxiosRequestConfig,
    ) => Promise<AxiosResponse<void>>;
    adminAddRoleToUser: (
        userId: number,
        addRoleToUserView: AddRoleToUserView,
        options?: AxiosRequestConfig,
    ) => Promise<AxiosResponse<void>>;
    adminDeleteUserRole: (
        userId: number,
        roleId: number,
        options?: AxiosRequestConfig,
    ) => Promise<AxiosResponse<void>>;
};

type CoreAdminRolesClient = {
    adminGetRole: (options?: AxiosRequestConfig) => Promise<AxiosResponse<GetResponseView>>;
    adminPostRole: (roleWriteView: RoleWriteView, options?: AxiosRequestConfig) => Promise<AxiosResponse<void>>;
    adminPutRole: (
        id: number,
        roleWriteView: RoleWriteView,
        options?: AxiosRequestConfig,
    ) => Promise<AxiosResponse<void>>;
    adminDeleteRole: (id: number, options?: AxiosRequestConfig) => Promise<AxiosResponse<void>>;
    adminPatchRole: (id: number, patchView: PatchView, options?: AxiosRequestConfig) => Promise<AxiosResponse<void>>;
};

type CoreUsersClient = {
    getMe: (options?: AxiosRequestConfig) => Promise<AxiosResponse<GetMeResponseView>>;
    patchMe: (patchMeView: PatchMeView, options?: AxiosRequestConfig) => Promise<AxiosResponse<void>>;
    getUser: (id: number, options?: AxiosRequestConfig) => Promise<AxiosResponse<GetUserResponseView>>;
};

type CoreGroupsClient = {
    getGroups: (options?: AxiosRequestConfig) => Promise<AxiosResponse<GetGroupsResultView>>;
    postGroup: (postGroupView: PostGroupView, options?: AxiosRequestConfig) => Promise<AxiosResponse<void>>;
    getGroup: (groupId: number, options?: AxiosRequestConfig) => Promise<AxiosResponse<GetGroupResultView>>;
    deleteGroup: (groupId: number, options?: AxiosRequestConfig) => Promise<AxiosResponse<void>>;
    getGroupUsers: (groupId: number, options?: AxiosRequestConfig) => Promise<AxiosResponse<GetGroupUsersResultView>>;
    addUserToGroup: (
        groupId: number,
        postUserGroupView: PostUserGroupView,
        options?: AxiosRequestConfig,
    ) => Promise<AxiosResponse<void>>;
    removeUserFromGroup: (
        groupId: number,
        userId: number,
        options?: AxiosRequestConfig,
    ) => Promise<AxiosResponse<void>>;
};

type CoreSessionsClient = {
    getActiveSessions: (options?: AxiosRequestConfig) => Promise<AxiosResponse<GetResponseView>>;
    history: (options?: AxiosRequestConfig) => Promise<AxiosResponse<HistoryResponseView>>;
    refresh: (refreshRequestView: RefreshRequestView, options?: AxiosRequestConfig) => Promise<AxiosResponse<void>>;
    revoke: (revokeRequestView: RevokeRequestView, options?: AxiosRequestConfig) => Promise<AxiosResponse<void>>;
};

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
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
    },
});

coreClient.interceptors.request.use(
    (config) => {
        const currentAuth = config.headers.Authorization;
        const isLoginRequest = config.url === '/api/v1/auth/login';

        if (!isLoginRequest && !currentAuth && DEFAULT_JWT_TOKEN) {
            config.headers.Authorization = DEFAULT_JWT_TOKEN.startsWith('Bearer ')
                ? DEFAULT_JWT_TOKEN
                : `Bearer ${DEFAULT_JWT_TOKEN}`;
        }

        if (config.url === '/api/v1/auth/force-change-password/') {
            config.url = '/api/v1/auth/force_change_password';
        }

        console.log('URL OpenAPI envoyee :', config.baseURL + '' + config.url);
        return config;
    },
    (error) => Promise.reject(error),
);

export const coreAuthClient: CoreAuthClient = getAuth(coreClient);
export const coreAdminUsersClient: CoreAdminUsersClient = getAdminUsers(coreClient);
export const coreAdminRolesClient: CoreAdminRolesClient = getAdminRoles(coreClient);
export const coreUsersClient: CoreUsersClient = getUsers(coreClient);
export const coreGroupsClient: CoreGroupsClient = getGroups(coreClient);
export const coreSessionsClient: CoreSessionsClient = getSessions(coreClient);
