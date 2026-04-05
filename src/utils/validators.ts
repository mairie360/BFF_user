import { z } from 'zod';
import { LoginRequest } from '../types/auth';

/**
 * Schéma de validation pour le login
 */
const loginSchema = z.object({
    email: z.email('Email invalide'),
    password: z.string().min(6, 'Le mot de passe doit contenir au minimum 6 caractères')
});

/**
 * Résultat de la validation
 */
interface ValidationResult {
    valid: boolean;
    errors?: string[];
}

/**
 * Valider les inputs du login
 * @param email - Email de l'utilisateur
 * @param password - Mot de passe
 * @returns Résultat de la validation
 */
export function validateLoginInput(email: LoginRequest['email'], password: LoginRequest['password']): ValidationResult {
    try {
        loginSchema.parse({ email, password });
        return { valid: true };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.issues.map((issue: z.ZodIssue) => issue.message);
            return { valid: false, errors };
        }
        return { 
            valid: false, 
            errors: ['Erreur de validation inconnue'] 
        };
    }
}
