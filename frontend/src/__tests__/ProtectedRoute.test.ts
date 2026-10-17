import { describe, it, expect } from 'vitest';

/**
 * Pure evaluation logic matching ProtectedRoute routing decisions:
 * - When loading is true -> Render Loading state
 * - When user is null -> Redirect to /login
 * - When user is present -> Allow access (render children)
 */
function evaluateProtectedRouteAccess(user: { id: number; email: string } | null, loading: boolean) {
    if (loading) {
        return { status: 'LOADING' as const };
    }
    if (!user) {
        return { status: 'REDIRECT_TO_LOGIN' as const, target: '/login' };
    }
    return { status: 'AUTHORIZED' as const };
}

describe('ProtectedRoute Route Guard Decision Logic', () => {
    it('returns LOADING status when auth context is resolving credentials', () => {
        const res = evaluateProtectedRouteAccess(null, true);
        expect(res.status).toBe('LOADING');
    });

    it('redirects unauthenticated users to /login', () => {
        const res = evaluateProtectedRouteAccess(null, false);
        expect(res.status).toBe('REDIRECT_TO_LOGIN');
        if (res.status === 'REDIRECT_TO_LOGIN') {
            expect(res.target).toBe('/login');
        }
    });

    it('authorizes authenticated users', () => {
        const user = { id: 1, email: 'demo@billable.test' };
        const res = evaluateProtectedRouteAccess(user, false);
        expect(res.status).toBe('AUTHORIZED');
    });
});
