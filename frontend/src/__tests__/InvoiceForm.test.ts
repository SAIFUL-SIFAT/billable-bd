import { describe, it, expect } from 'vitest';

interface InvoiceLineItem {
    description: string;
    quantity: number | string;
    unit_price: number | string;
}

/**
 * Pure calculation logic matching InvoiceFormPage:
 * Computes subtotal, tax amount, and total due.
 */
function calculateInvoiceTotals(items: InvoiceLineItem[], taxRatePercent: number | string) {
    const rate = Number(taxRatePercent) || 0;
    const subtotal = items.reduce((acc, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        return acc + qty * price;
    }, 0);

    const taxAmount = (subtotal * rate) / 100;
    const total = subtotal + taxAmount;

    return {
        subtotal: Number(subtotal.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        total: Number(total.toFixed(2)),
    };
}

describe('Invoice Form Line Items Calculations', () => {
    it('computes subtotal accurately across multiple line items', () => {
        const items: InvoiceLineItem[] = [
            { description: 'Frontend Development', quantity: 20, unit_price: 50 }, // 1000
            { description: 'Code Review & Architecture', quantity: 5, unit_price: 80 }, // 400
        ];
        const res = calculateInvoiceTotals(items, 0);
        expect(res.subtotal).toBe(1400.00);
        expect(res.taxAmount).toBe(0.00);
        expect(res.total).toBe(1400.00);
    });

    it('applies percentage tax rate correctly', () => {
        const items: InvoiceLineItem[] = [
            { description: 'API Design', quantity: 10, unit_price: 100 }, // 1000
        ];
        const res = calculateInvoiceTotals(items, 15); // 15% tax
        expect(res.subtotal).toBe(1000.00);
        expect(res.taxAmount).toBe(150.00);
        expect(res.total).toBe(1150.00);
    });

    it('handles decimal string inputs and fractional quantities safely', () => {
        const items: InvoiceLineItem[] = [
            { description: 'Hourly Consulting', quantity: '2.5', unit_price: '75.50' }, // 188.75
            { description: 'Cloud Setup', quantity: '1', unit_price: '50.25' }, // 50.25 -> 239.00
        ];
        const res = calculateInvoiceTotals(items, '5'); // 5% tax -> 11.95
        expect(res.subtotal).toBe(239.00);
        expect(res.taxAmount).toBe(11.95);
        expect(res.total).toBe(250.95);
    });

    it('gracefully handles empty line items', () => {
        const res = calculateInvoiceTotals([], 10);
        expect(res.subtotal).toBe(0.00);
        expect(res.taxAmount).toBe(0.00);
        expect(res.total).toBe(0.00);
    });
});
