import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Login validation schema mirrored from Login.tsx
const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

describe('Login Form Validation Schema', () => {
    it('accepts valid email and non-empty password', () => {
        const result = loginSchema.safeParse({
            email: 'freelancer@billable.test',
            password: 'secretpassword123',
        });
        expect(result.success).toBe(true);
    });

    it('rejects invalid email formats', () => {
        const invalidEmails = ['plainaddress', '@missingusername.com', 'user@.com', ''];
        for (const email of invalidEmails) {
            const result = loginSchema.safeParse({
                email,
                password: 'validpassword',
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Invalid email address');
            }
        }
    });

    it('rejects empty password', () => {
        const result = loginSchema.safeParse({
            email: 'user@test.com',
            password: '',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Password is required');
        }
    });
});
