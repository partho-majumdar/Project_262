/** GroupMart shows every amount in Bangladeshi Taka. */
export const CURRENCY_CODE = 'BDT';
export const CURRENCY_SYMBOL = '৳';

/** `৳1234.50` style amount with two decimals. */
export const formatTaka = (value) => `${CURRENCY_SYMBOL}${Number(value ?? 0).toFixed(2)}`;
