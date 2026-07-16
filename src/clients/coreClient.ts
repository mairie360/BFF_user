import '../config/registerGeneratedOpenApi';
import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getAdminUsers } from '@mairie360/core-api-openapi/endpoints/admin-users/admin-users';
import { getAuth } from '@mairie360/core-api-openapi/endpoints/auth/auth';
import { getUsers } from '@mairie360/core-api-openapi/endpoints/users/users';
import type {
    CreateUserView,
    ForceChangePasswordView,
    GetUserResponseView,
    LoginResponseView,
    LoginView,
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
};

type CoreUsersClient = {
    getUser: (id: number, options?: AxiosRequestConfig) => Promise<AxiosResponse<GetUserResponseView>>;
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
export const coreUsersClient: CoreUsersClient = getUsers(coreClient);
