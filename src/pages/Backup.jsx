import React from 'react';
import { useAppContext } from '../context/StateContext';
import { today } from '../utils/data';
import * as XLSX from 'xlsx';

const Backup = () => {
    const { appState, setAppState } = useAppContext();

    const doJsonBackup = () => {
        const data = JSON.stringify(appState);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `estate-backup-${today()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const doExcelBackup = () => {
        const wb = XLSX.utils.book_new();
        Object.keys(appState).forEach(key => {
            if (Array.isArray(appState[key]) && appState[key].length > 0) {
                const ws = XLSX.utils.json_to_sheet(appState[key]);
                XLSX.utils.book_append_sheet(wb, ws, key);
            }
        });
        XLSX.writeFile(wb, `estate-backup-${today()}.xlsx`);
    };

    // Restore functions would need more UI and are complex.
    // For now, focusing on the backup functionality.

    return (
        <div>
            <h1>نسخة احتياطية</h1>
            <div className="card">
                <h3>تنزيل نسخة احتياطية</h3>
                <p>قم بتنزيل نسخة من بياناتك بشكل دوري للحفاظ عليها.</p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
                    <button onClick={doJsonBackup} className="btn-primary">تنزيل نسخة JSON</button>
                    <button onClick={doExcelBackup}>تنزيل نسخة Excel</button>
                </div>
            </div>
        </div>
    );
};

export default Backup;
