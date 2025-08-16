// This file contains helper functions for querying data from the application state.
// They are kept separate to be reusable across different components.

export function unitById(id, units) {
    return units.find(u => u.id === id);
}

export function custById(id, customers) {
    return customers.find(c => c.id === id);
}

export function partnerById(id, partners) {
    return partners.find(p => p.id === id);
}

export function unitCode(id, units) {
    const unit = unitById(id, units);
    return (unit || {}).code || '—';
}
