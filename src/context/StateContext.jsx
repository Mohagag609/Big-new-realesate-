import React, { createContext, useContext, useState, useEffect } from 'react';

const APPKEY = 'estate_pro_final_v3'; // Use the same key to load original data

// Function to load the initial state from localStorage or provide a default
const loadInitialState = () => {
    try {
        const serializedState = localStorage.getItem(APPKEY);
        if (serializedState === null) {
            // If no data exists, return a default structure
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
            };
        }
        // If data exists, parse and return it
        return JSON.parse(serializedState);
    } catch (err) {
        console.error("Could not load state from localStorage", err);
        // Return default state in case of any parsing error
        return { customers: [], units: [], partners: [], unitPartners: [], contracts: [], installments: [], payments: [], partnerDebts: [], settings: { theme: 'dark', font: 16 }, locked: false };
    }
};

// 1. Create the Context
const StateContext = createContext();

// 2. Create the Provider Component
export const StateProvider = ({ children }) => {
    // Initialize state by calling our loader function once
    const [appState, setAppState] = useState(loadInitialState);

    // This effect runs whenever `appState` changes, saving it to localStorage
    useEffect(() => {
        try {
            const serializedState = JSON.stringify(appState);
            localStorage.setItem(APPKEY, serializedState);
        } catch (err) {
            console.error("Could not save state to localStorage", err);
        }
    }, [appState]);

    // The value that will be provided to all consuming components
    const contextValue = {
        appState,
        setAppState,
        // We can add more specific updater functions here later
        // e.g., addCustomer: (customer) => setAppState(prev => ({...})),
    };

    return (
        <StateContext.Provider value={contextValue}>
            {children}
        </StateContext.Provider>
    );
};

// 3. Create a custom hook for easy access to the context
export const useAppContext = () => {
    const context = useContext(StateContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within a StateProvider');
    }
    return context;
};
