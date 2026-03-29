import { z } from 'zod';

export const LoginRequestSchema = z.object({
    email: z.email('Invalid email address'),
    password: z.string(),
});

export const validateLoginInput = (email, password) => {
    try {
        LoginRequestSchema.parse({ email, password });
        return { valid: true };
    } catch (error) {
        return { valid: false, errors: error };
    }
};
