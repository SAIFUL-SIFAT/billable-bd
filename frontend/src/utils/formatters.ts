export const formatBDT = (amount: number | string | null | undefined): string => {
    if (amount === null || amount === undefined || amount === '') return '৳0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '৳0.00';
    return new Intl.NumberFormat('en-BD', {
        style: 'currency',
        currency: 'BDT',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
};

export const formatCurrency = (
    amount: number | string | null | undefined,
    currency: string = 'BDT'
): string => {
    if (amount === null || amount === undefined || amount === '') {
        return `${currency} 0.00`;
    }
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return `${currency} 0.00`;
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(num);
    } catch {
        return `${currency} ${num.toFixed(2)}`;
    }
};

export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return isNaN(d.getTime())
        ? dateString
        : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

