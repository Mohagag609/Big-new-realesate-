const APPKEY = 'estate_pro_final_v3';

// This function loads the initial state from localStorage or returns a default structure.
function initialState() {
    try {
        const s = JSON.parse(localStorage.getItem(APPKEY)) || {};
        // The default structure ensures all necessary arrays and objects exist.
        return {
            customers: [],
            units: [],
            partners: [],
            unitPartners: [],
            contracts: [],
            installments: [],
            payments: [],
            partnerDebts: [],
            settings: { theme: 'dark', font: 16 },
            locked: false,
            ...s
        };
    } catch {
        // In case of any error, return a clean default state.
        return {
            customers: [],
            units: [],
            partners: [],
            unitPartners: [],
            contracts: [],
            installments: [],
            payments: [],
            partnerDebts: [],
            settings: { theme: 'dark', font: 16 },
            locked: false
        };
    }
}

// The main state object for the entire application.
export const state = initialState();

// --- Undo/Redo System ---
let historyStack = [];
let historyIndex = -1;
let currentView = 'dash';
let navFunction = () => {}; // Placeholder for the navigation function to be injected later.

// This function allows main.js to provide the navigation function, breaking a circular dependency.
export function setNavFunction(nav) {
    navFunction = nav;
}

export function setCurrentView(viewId) {
    currentView = viewId;
}

export function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const restoredState = JSON.parse(JSON.stringify(historyStack[historyIndex]));
        Object.keys(state).forEach(key => delete state[key]);
        Object.assign(state, restoredState);
        persist();
        navFunction(currentView, null, false); // Re-render the current view without saving state again
    }
}

export function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        const restoredState = JSON.parse(JSON.stringify(historyStack[historyIndex]));
        Object.keys(state).forEach(key => delete state[key]);
        Object.assign(state, restoredState);
        persist();
        navFunction(currentView, null, false); // Re-render the current view without saving state again
    }
}

// Call this function *before* any state modification to enable undo.
export function saveState() {
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(JSON.parse(JSON.stringify(state)));
    if (historyStack.length > 50) { // Limit history size
        historyStack.shift();
    }
    historyIndex = historyStack.length - 1;
}

// --- Persistence ---
let applySettingsFunction = () => {}; // Placeholder for applySettings function.
export function setApplySettings(func) {
    applySettingsFunction = func;
}

// This function saves the entire state to localStorage.
export function persist() {
    localStorage.setItem(APPKEY, JSON.stringify(state));
    applySettingsFunction(); // Also apply UI settings after persisting.
}

// Save the initial loaded state as the first entry in the history.
saveState();
