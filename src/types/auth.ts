export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    user: User;
}

export interface User {
    id: string;
    email: string;
    name: string;
    createdAt: string;
}