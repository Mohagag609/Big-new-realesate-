/**
 * Generates a unique ID with a given prefix.
 * @param {string} p - The prefix for the ID.
 * @returns {string} A unique ID string.
 */
export function uid(p) {
    return p + '-' + Math.random().toString(36).slice(2, 9);
}

/**
 * Gets today's date in YYYY-MM-DD format.
 * @returns {string} Today's date.
 */
export function today() {
    return new Date().toISOString().slice(0, 10);
}

// Add other general-purpose helper functions here in the future.
