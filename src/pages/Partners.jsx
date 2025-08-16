import React, { useState } from 'react';
import { useAppContext } from '../context/StateContext';
import { uid } from '../utils/helpers';

const Partners = () => {
    const { appState, setAppState } = useAppContext();
    const { partners } = appState;

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const addPartner = () => {
        if (!name.trim()) return alert('Please enter a name');
        setAppState(prev => ({
            ...prev,
            partners: [...prev.partners, { id: uid('PR'), name, phone }]
        }));
        setName('');
        setPhone('');
    };

    return (
        <div>
            <h1>الشركاء</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
                <div className="card">
                    <h3>قائمة الشركاء</h3>
                    <table className="data-table">
                        <thead>
                            <tr><th>الاسم</th><th>الهاتف</th></tr>
                        </thead>
                        <tbody>
                            {partners.map(p => (
                                <tr key={p.id}>
                                    <td>{p.name}</td>
                                    <td>{p.phone}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="card">
                    <h3>إضافة شريك</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input type="text" placeholder="اسم الشريك" value={name} onChange={e => setName(e.target.value)} />
                        <input type="text" placeholder="رقم الهاتف" value={phone} onChange={e => setPhone(e.target.value)} />
                        <button onClick={addPartner} className="btn-primary">إضافة</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Partners;
