import React from 'react';
import { formatMoneyNumber } from '../utils/formatters';

export interface MoneyProps {
    amount: number | string | null | undefined;
    currency?: string;
    className?: string;
    codeClassName?: string;
    numberClassName?: string;
    codePlacement?: 'before' | 'after';
}

/**
 * <Money /> Component
 * Renders monetary figures with a small, muted uppercase currency code
 * and a bold, styled numerical figure (with lakh/crore grouping for BDT).
 * Example: <span className="text-xs text-slate-400 font-semibold mr-1">USD</span><span className="font-bold">1,000.00</span>
 */
export const Money: React.FC<MoneyProps> = ({
    amount,
    currency = 'BDT',
    className = 'inline-flex items-baseline',
    codeClassName = 'text-xs text-slate-500 font-semibold uppercase tracking-wider',
    numberClassName = 'font-bold font-mono',
    codePlacement = 'before',
}) => {
    const formatted = formatMoneyNumber(amount, currency);
    const currCode = (currency || 'BDT').toUpperCase();

    if (codePlacement === 'after') {
        return (
            <span className={className}>
                <span className={numberClassName}>{formatted}</span>
                <span className={`ml-1.5 ${codeClassName}`}>{currCode}</span>
            </span>
        );
    }

    return (
        <span className={className}>
            <span className={`mr-1.5 ${codeClassName}`}>{currCode}</span>
            <span className={numberClassName}>{formatted}</span>
        </span>
    );
};
