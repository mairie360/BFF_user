import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// On ajoute les méthodes .openapi() à Zod
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

export const ApiErrorResponse = z.object({
    message: z.string().openapi({
        description: 'Message lisible de l\'erreur',
        example: 'Invalid credentials provided.',
    }),
    error: z.unknown().optional().openapi({
        description: 'Détail technique optionnel de l\'erreur',
    }),
}).openapi('ApiErrorResponse');

export const LoginViewSchema = z.object({
    email: z.email().openapi({
        description: 'Adresse email de l\'utilisateur',
        example: 'alice.dupont@mairie360.fr',
    }),
    password: z.string().min(1).openapi({
        description: 'Mot de passe de l\'utilisateur',
        example: 'MotDePasse123',
    }),
    device_info: z.string().openapi({
        description: 'Informations sur le périphérique utilisé pour se connecter (chaîne vide acceptée, comme par Core API)',
        example: 'Firefox',
    }),
}).openapi('LoginView');

export const ForceChangePasswordViewSchema = z.object({
    new_password: z.string().min(1).openapi({
        description: 'Nouveau mot de passe de l\'utilisateur',
        example: 'NouveauMotDePasse123',
    }),
    token: z.string().min(1).openapi({
        description: 'Token de changement forcé du mot de passe',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    }),
}).openapi('ForceChangePasswordView');

export const AboutResponseViewSchema = z.object({
    email: z.email().openapi({
        description: 'Adresse email de l\'utilisateur',
        example: 'alice.dupont@mairie360.fr',
    }),
    first_name: z.string().openapi({
        description: 'Prénom de l\'utilisateur',
        example: 'Alice',
    }),
    last_name: z.string().openapi({
        description: 'Nom de l\'utilisateur',
        example: 'Dupont',
    }),
    phone: z.string().nullable().openapi({
        description: 'Numéro de téléphone de l\'utilisateur (null si non renseigné)',
        example: '+33123456789',
    }),
    status: z.string().openapi({
        description: 'Statut du compte utilisateur',
        example: 'active',
    }),
}).openapi('AboutResponseView');
export type AboutResponseView = z.infer<typeof AboutResponseViewSchema>;

export const AuthTokenResponse = z.object({
    refresh_token: z.string().openapi({
        description: 'Refresh token retourné par le Core API',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    }),
}).openapi('AuthTokenResponse');

export const LogoutViewSchema = z.object({
    refresh_token: z.string().min(1).optional().openapi({
        description: 'Refresh token returned by /auth/login. When sent with the session, the Core API session is revoked, which invalidates the access JWT immediately.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    }),
}).openapi('LogoutView');

export const LogoutResponse = z.object({
    message: z.string().openapi({
        example: 'Logged out successfully',
    }),
    session_revoked: z.boolean().openapi({
        description: 'Whether the Core API session was revoked. `false` when no session or refresh token was sent, or when Core API refused or failed the revocation; the cookie is cleared in every case.',
        example: true,
    }),
}).openapi('LogoutResponse');

export const UserIdParams = z.object({
    userId: z.coerce.number().int().positive().openapi({
        description: 'Identifiant numérique de l\'utilisateur',
        example: 42,
    }),
}).openapi('UserIdParams');

registry.register('ApiErrorResponse', ApiErrorResponse);
registry.register('LoginView', LoginViewSchema);
registry.register('ForceChangePasswordView', ForceChangePasswordViewSchema);
registry.register('AboutResponseView', AboutResponseViewSchema);
registry.register('AuthTokenResponse', AuthTokenResponse);
registry.register('LogoutView', LogoutViewSchema);
registry.register('LogoutResponse', LogoutResponse);
registry.register('UserIdParams', UserIdParams);
