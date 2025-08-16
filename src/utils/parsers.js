/**
 * Parses a string to a number, removing non-numeric characters.
 * @param {string} v - The string to parse.
 * @returns {number} The parsed number.
 */
export function parseNumber(v) {
    if (v === null || v === undefined) return 0;
    const str = String(v).replace(/[^\d.]/g, '');
    return Number(str) || 0;
}
