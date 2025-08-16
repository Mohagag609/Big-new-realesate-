import React, { createContext, useContext, useState, useEffect } from 'react';

const APPKEY = 'estate_pro_final_v3';

const loadInitialState = () => {
    try {
        const serializedState = localStorage.getItem(APPKEY);
        if (serializedState === null) {
            return {
                customers: [], units: [], partners: [], unitPartners: [],
                contracts: [], installments: [], payments: [], partnerDebts: [],
                settings: { theme: 'dark', font: 16 }, locked: false,
            };
        }
        return JSON.parse(serializedState);
    } catch (err) {
        console.error("Could not load state from localStorage", err);
        return {
            customers: [], units: [], partners: [], unitPartners: [],
            contracts: [], installments: [], payments: [], partnerDebts: [],
            settings: { theme: 'dark', font: 16 }, locked: false,
        };
    }
};

const StateContext = createContext();

export const StateProvider = ({ children }) => {
    const [appState, setAppState] = useState(loadInitialState);

    useEffect(() => {
        try {
            const serializedState = JSON.stringify(appState);
            localStorage.setItem(APPKEY, serializedState);
        } catch (err) {
            console.error("Could not save state to localStorage", err);
        }
    }, [appState]);

    const contextValue = {
        appState,
        setAppState,
    };

    return (
        <StateContext.Provider value={contextValue}>
            {children}
        </StateContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(StateContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within a StateProvider');
    }
    return context;
};
