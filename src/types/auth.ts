export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    user: User;
}

export interface TokenPayload {
    sub: string; // user ID
    email: string;
    iat: number; // issued at
    exp: number; // expiration time
}

export interface RefreshTokenRequest {
    accessToken: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
    createdAt: string;
}