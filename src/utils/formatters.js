/**
 * Formats a number as Egyptian Pounds (EGP).
 * @param {number} v - The value to format.
 * @returns {string} The formatted currency string.
 */
const fmt = new Intl.NumberFormat('ar-EG');
export function egp(v) { v = Number(v || 0); return isFinite(v) ? fmt.format(v) + ' ج.م' : '' }

// You can add other formatters here in the future, e.g., for dates.
