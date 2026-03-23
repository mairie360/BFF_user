import { z } from 'zod';

export const LoginRequestSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
    accessToken: z.string(),
    user: z.object({
        id: z.string(),
        email: z.email(),
        name: z.string(),
        createdAt: z.string(),
    }),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RefreshTokenRequestSchema = z.object({
    // No body parameters, refresh token is sent via cookie
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const UserSchema = z.object({
    id: z.string(),
    email: z.email(),
    name: z.string(),
    createdAt: z.string(),
});

export type User = z.infer<typeof UserSchema>;

export const RefreshResponseSchema = z.object({
    accessToken: z.string(),
});

export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export const ErrorResponseSchema = z.object({
    message: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;