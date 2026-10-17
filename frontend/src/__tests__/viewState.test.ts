import { describe, it, expect } from 'vitest';

/**
 * Helper representing common UI view state resolution for list and detail views.
 */
function resolveViewState<T>(params: {
    loading: boolean;
    error: string | null;
    items: T[];
}) {
    if (params.loading) return 'LOADING';
    if (params.error) return 'ERROR';
    if (!params.items || params.items.length === 0) return 'EMPTY';
    return 'DATA';
}

describe('UI Empty and Error State Resolution Logic', () => {
    it('resolves to LOADING when fetching data', () => {
        const state = resolveViewState({
            loading: true,
            error: null,
            items: [],
        });
        expect(state).toBe('LOADING');
    });

    it('resolves to ERROR when network request fails', () => {
        const state = resolveViewState({
            loading: false,
            error: 'Failed to load invoices from server.',
            items: [],
        });
        expect(state).toBe('ERROR');
    });

    it('resolves to EMPTY state when response array is empty', () => {
        const state = resolveViewState({
            loading: false,
            error: null,
            items: [],
        });
        expect(state).toBe('EMPTY');
    });

    it('resolves to DATA state when active records are returned', () => {
        const state = resolveViewState({
            loading: false,
            error: null,
            items: [{ id: 1, name: 'Acme Corp' }],
        });
        expect(state).toBe('DATA');
    });
});
