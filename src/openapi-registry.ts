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
}).openapi('LoginView');

export const RegisterViewSchema = z.object({
    email: z.email().openapi({
        description: 'Adresse email du nouvel utilisateur',
        example: 'alice.dupont@mairie360.fr',
    }),
    first_name: z.string().min(1).openapi({
        description: 'Prénom du nouvel utilisateur',
        example: 'Alice',
    }),
    last_name: z.string().min(1).openapi({
        description: 'Nom du nouvel utilisateur',
        example: 'Dupont',
    }),
    password: z.string().min(1).openapi({
        description: 'Mot de passe du nouvel utilisateur',
        example: 'MotDePasse123',
    }),
    phone_number: z.string().nullable().optional().openapi({
        description: 'Numéro de téléphone du nouvel utilisateur',
        example: '+33123456789',
    }),
}).openapi('RegisterView');

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
    phone: z.string().openapi({
        description: 'Numéro de téléphone de l\'utilisateur',
        example: '+33123456789',
    }),
    status: z.string().openapi({
        description: 'Statut du compte utilisateur',
        example: 'active',
    }),
}).openapi('AboutResponseView');

export const AuthTokenResponse = z.string().openapi({
    description: 'Token JWT retourné par le Core API',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
});

export const LogoutResponse = z.object({
    message: z.string().openapi({
        example: 'Logged out successfully',
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
registry.register('RegisterView', RegisterViewSchema);
registry.register('AboutResponseView', AboutResponseViewSchema);
registry.register('AuthTokenResponse', AuthTokenResponse);
registry.register('LogoutResponse', LogoutResponse);
registry.register('UserIdParams', UserIdParams);
