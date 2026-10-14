import { describe, it, expect } from 'vitest';
import { formatMoney, formatMoneyNumber, calculateEffectiveRate } from './formatters';

describe('formatMoney and formatMoneyNumber', () => {
    it('formats BDT with Bangladeshi lakh/crore digit grouping', () => {
        expect(formatMoneyNumber(118000, 'BDT')).toBe('1,18,000.00');
        expect(formatMoneyNumber('118000.00', 'BDT')).toBe('1,18,000.00');
        expect(formatMoneyNumber(125000, 'BDT')).toBe('1,25,000.00');
        expect(formatMoneyNumber(177000, 'BDT')).toBe('1,77,000.00');
        expect(formatMoneyNumber('316050.83', 'BDT')).toBe('3,16,050.83');
        expect(formatMoneyNumber(10000000, 'BDT')).toBe('1,00,00,000.00');
    });

    it('formats non-BDT currencies with standard international thousand grouping', () => {
        expect(formatMoneyNumber(100000, 'USD')).toBe('100,000.00');
        expect(formatMoneyNumber(125000.5, 'EUR')).toBe('125,000.50');
        expect(formatMoneyNumber('1000000.00', 'GBP')).toBe('1,000,000.00');
    });

    it('handles ROUND_HALF_UP rounding on fraction digits', () => {
        expect(formatMoneyNumber('10.495', 'USD')).toBe('10.50');
        expect(formatMoneyNumber('10.494', 'USD')).toBe('10.49');
        expect(formatMoneyNumber('9.999', 'BDT')).toBe('10.00');
    });

    it('formats with currency code placed before or after', () => {
        expect(formatMoney(118000, 'BDT')).toBe('BDT 1,18,000.00');
        expect(formatMoney(118000, 'BDT', { codePlacement: 'after' })).toBe('1,18,000.00 BDT');
        expect(formatMoney(118000, 'BDT', { showCode: false })).toBe('1,18,000.00');
    });

    it('handles null, undefined, empty string gracefully', () => {
        expect(formatMoneyNumber(null, 'BDT')).toBe('0.00');
        expect(formatMoneyNumber(undefined, 'USD')).toBe('0.00');
        expect(formatMoneyNumber('', 'EUR')).toBe('0.00');
    });
});

describe('calculateEffectiveRate', () => {
    it('calculates weighted effective rate = received_bdt / (applied - fee)', () => {
        // e.g. applied $1000, fee $50 -> net $950. received 118,000 BDT -> 118000 / 950 = 124.21
        const rate = calculateEffectiveRate(1000, 50, 118000);
        expect(rate).toBe('124.21');
    });

    it('handles decimal string inputs correctly', () => {
        const rate = calculateEffectiveRate('500.00', '15.00', '59000.00');
        // net = 485. 59000 / 485 = 121.649... -> 121.65
        expect(rate).toBe('121.65');
    });

    it('returns null on zero or negative net amount or zero received', () => {
        expect(calculateEffectiveRate(50, 50, 5000)).toBeNull(); // net is 0
        expect(calculateEffectiveRate(50, 60, 5000)).toBeNull(); // net is negative
        expect(calculateEffectiveRate(100, 10, 0)).toBeNull(); // received is 0
    });
});
