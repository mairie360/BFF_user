import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type {
    CreateUserView,
    GetUserResponseView,
    LoginResponseView,
    LoginView,
} from '@mairie360/core-api-openapi/model';

type CoreAuthClient = {
    login: (loginView: LoginView, options?: AxiosRequestConfig) => Promise<AxiosResponse<LoginResponseView>>;
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
    headers: {
        'Content-Type': 'application/json',
    },
});

function registerTsNodeForGeneratedPackage(): void {
    // The published OpenAPI package exposes TypeScript sources. Register ts-node so
    // runtime requires from node_modules work the same way as in the other BFFs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('ts-node').register({
        transpileOnly: true,
        ignore: [],
        compilerOptions: { module: 'commonjs' },
    });
}

function loadGeneratedCoreClients(axiosInstance: AxiosInstance): {
    auth: CoreAuthClient;
    adminUsers: CoreAdminUsersClient;
    users: CoreUsersClient;
} {
    registerTsNodeForGeneratedPackage();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuth } = require('@mairie360/core-api-openapi/endpoints/auth/auth') as {
        getAuth: (instance?: AxiosInstance) => CoreAuthClient;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAdminUsers } = require('@mairie360/core-api-openapi/endpoints/admin-users/admin-users') as {
        getAdminUsers: (instance?: AxiosInstance) => CoreAdminUsersClient;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getUsers } = require('@mairie360/core-api-openapi/endpoints/users/users') as {
        getUsers: (instance?: AxiosInstance) => CoreUsersClient;
    };

    return {
        auth: getAuth(axiosInstance),
        adminUsers: getAdminUsers(axiosInstance),
        users: getUsers(axiosInstance),
    };
}

const generatedCoreClients = loadGeneratedCoreClients(coreClient);

export const coreAuthClient = generatedCoreClients.auth;
export const coreAdminUsersClient = generatedCoreClients.adminUsers;
export const coreUsersClient = generatedCoreClients.users;
