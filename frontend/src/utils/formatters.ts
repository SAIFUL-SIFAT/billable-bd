export interface FormatMoneyOptions {
    showCode?: boolean;
    codePlacement?: 'before' | 'after';
}

/**
 * Parses and formats monetary amounts safely without floating-point inaccuracies.
 * Supports string representations ("118000.00") and numbers.
 * BDT uses South Asian lakh/crore grouping (1,18,000.00) via Intl ('en-IN', trying 'en-BD' first).
 * All other currencies use standard International grouping (100,000.00).
 */
export const formatMoneyNumber = (
    amount: number | string | null | undefined,
    currency: string = 'BDT'
): string => {
    if (amount === null || amount === undefined || amount === '') {
        return '0.00';
    }

    const cleanStr = String(amount).trim();
    const isNegative = cleanStr.startsWith('-');
    const absStr = isNegative ? cleanStr.slice(1) : cleanStr;

    // Split integer and decimal parts
    const parts = absStr.split('.');
    const integerPart = parts[0] || '0';
    let fractionPart = parts[1] || '';

    // Quantize / round fraction to 2 decimal places using ROUND_HALF_UP logic
    if (fractionPart.length > 2) {
        const thirdDigit = parseInt(fractionPart[2], 10);
        let firstTwo = parseInt(fractionPart.slice(0, 2), 10);
        let intVal = BigInt(integerPart);

        if (thirdDigit >= 5) {
            firstTwo += 1;
            if (firstTwo === 100) {
                firstTwo = 0;
                intVal += 1n;
            }
        }
        fractionPart = String(firstTwo).padStart(2, '0');
        return formatFormattedParts(intVal.toString(), fractionPart, currency, isNegative);
    } else {
        fractionPart = fractionPart.padEnd(2, '0');
        return formatFormattedParts(integerPart, fractionPart, currency, isNegative);
    }
};

function formatFormattedParts(
    integerStr: string,
    fractionStr: string,
    currency: string,
    isNegative: boolean
): string {
    const isBDT = currency.toUpperCase() === 'BDT';

    let formattedInt = '';
    if (isBDT) {
        // Try 'en-BD' first, fallback to 'en-IN' for lakh/crore grouping if en-BD lacks 2-grouping
        let supportsBDGrouping = false;
        try {
            const check = new Intl.NumberFormat('en-BD').format(100000);
            supportsBDGrouping = check === '1,00,000';
        } catch {
            supportsBDGrouping = false;
        }

        const locale = supportsBDGrouping ? 'en-BD' : 'en-IN';
        try {
            formattedInt = new Intl.NumberFormat(locale).format(BigInt(integerStr));
        } catch {
            formattedInt = manualSouthAsianGrouping(integerStr);
        }
    } else {
        try {
            formattedInt = new Intl.NumberFormat('en-US').format(BigInt(integerStr));
        } catch {
            formattedInt = integerStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
    }

    const result = `${formattedInt}.${fractionStr}`;
    return isNegative ? `-${result}` : result;
}

function manualSouthAsianGrouping(str: string): string {
    if (str.length <= 3) return str;
    const lastThree = str.slice(-3);
    const otherDigits = str.slice(0, -3);
    const withCommas = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return `${withCommas},${lastThree}`;
}

export const formatMoney = (
    amount: number | string | null | undefined,
    currency: string = 'BDT',
    options?: FormatMoneyOptions
): string => {
    const numFormatted = formatMoneyNumber(amount, currency);
    const showCode = options?.showCode ?? true;
    const codePlacement = options?.codePlacement ?? 'before';

    if (!showCode) {
        return numFormatted;
    }

    if (codePlacement === 'after') {
        return `${numFormatted} ${currency.toUpperCase()}`;
    }

    return `${currency.toUpperCase()} ${numFormatted}`;
};

// Backwards-compatible formatters
export const formatBDT = (amount: number | string | null | undefined): string => {
    return formatMoney(amount, 'BDT', { showCode: true, codePlacement: 'before' });
};

export const formatCurrency = (
    amount: number | string | null | undefined,
    currency: string = 'BDT'
): string => {
    return formatMoney(amount, currency, { showCode: true, codePlacement: 'before' });
};

/**
 * Format date string safely without timezone offset shifts.
 * Treats plain "YYYY-MM-DD" as year, month, day directly to avoid off-by-one errors.
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    // If format is YYYY-MM-DD, parse parts manually to prevent UTC vs Local day shift
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
    }
    const d = new Date(dateString);
    return isNaN(d.getTime())
        ? dateString
        : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Format date as "14 days overdue" or "Due in 12 days" or "Due today".
 */
export const formatRelativeDue = (dueDateString: string | null | undefined, status?: string): string => {
    if (!dueDateString) return '';
    if (status === 'PAID' || status === 'VOID') return '';

    const parts = dueDateString.split('T')[0].split('-');
    if (parts.length !== 3) return '';

    const due = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Due today';
    } else if (diffDays < 0) {
        const daysAgo = Math.abs(diffDays);
        return `${daysAgo} day${daysAgo === 1 ? '' : 's'} overdue`;
    } else {
        return `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    }
};

/**
 * Safe live effective rate calculation: received_bdt / (applied - fee)
 */
export const calculateEffectiveRate = (
    applied: number | string | null | undefined,
    fee: number | string | null | undefined,
    receivedBdt: number | string | null | undefined
): string | null => {
    const appliedNum = typeof applied === 'string' ? parseFloat(applied) : Number(applied || 0);
    const feeNum = typeof fee === 'string' ? parseFloat(fee) : Number(fee || 0);
    const bdtNum = typeof receivedBdt === 'string' ? parseFloat(receivedBdt) : Number(receivedBdt || 0);

    const net = appliedNum - feeNum;
    if (isNaN(net) || isNaN(bdtNum) || net <= 0 || bdtNum <= 0) {
        return null;
    }
    return (bdtNum / net).toFixed(2);
};
