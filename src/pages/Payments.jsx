import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/StateContext';
import { uid } from '../utils/helpers';
import { egp } from '../utils/formatters';
import { parseNumber } from '../utils/parsers';
import { unitCode } from '../utils/data';
import { today } from '../utils/helpers';

const Payments = () => {
    const { appState, setAppState } = useAppContext();
    const { payments, units, installments } = appState;

    const initialFormState = { unitId: '', amount: '', method: 'نقدي', date: today(), installmentId: '' };
    const [formState, setFormState] = useState(initialFormState);
    const [query, setQuery] = useState('');

    const handleFormChange = e => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const addPayment = () => {
        const { unitId, amount, method, date, installmentId } = formState;
        const parsedAmount = parseNumber(amount);
        if (!unitId || !parsedAmount > 0) return alert('اختر وحدة واكتب مبلغ صحيح');

        const newPayment = { id: uid('P'), unitId, amount: parsedAmount, method, date, installmentId: null };

        setAppState(prev => {
            const newPayments = [...prev.payments, newPayment];
            let newInstallments = prev.installments;

            if (method === 'قسط' || method === 'جزئي') {
                const inst = newInstallments.find(i => i.id === installmentId);
                if (inst) {
                    newPayment.installmentId = installmentId;
                    const remaining = inst.amount - parsedAmount;
                    const updatedInst = { ...inst, amount: remaining };
                    if (remaining <= 0) {
                        updatedInst.status = 'مدفوع';
                        updatedInst.paymentDate = date;
                    }
                    newInstallments = newInstallments.map(i => i.id === installmentId ? updatedInst : i);
                }
            }
            return { ...prev, payments: newPayments, installments: newInstallments };
        });

        setFormState(initialFormState);
    };

    const filteredPayments = useMemo(() => {
        return payments
            .filter(p => unitCode(p.unitId, units).toLowerCase().includes(query.toLowerCase()))
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [payments, units, query]);

    const availableInstallments = useMemo(() => {
        if (!formState.unitId) return [];
        return installments.filter(i => i.unitId === formState.unitId && i.status !== 'مدفوع');
    }, [installments, formState.unitId]);

    return (
        <div>
            <h1>المدفوعات</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
                <div className="card">
                    <h3>سجل المدفوعات</h3>
                    <input type="text" placeholder="بحث بكود الوحدة..." value={query} onChange={e => setQuery(e.target.value)} style={{ marginBottom: '16px', width: '100%' }} />
                    <table className="data-table">
                        <thead>
                            <tr><th>الوحدة</th><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th><th>المصدر</th></tr>
                        </thead>
                        <tbody>
                            {filteredPayments.map(p => (
                                <tr key={p.id}>
                                    <td>{unitCode(p.unitId, units)}</td>
                                    <td>{egp(p.amount)}</td>
                                    <td>{p.method}</td>
                                    <td>{p.date}</td>
                                    <td>{p.installmentId ? 'قسط' : 'يدوي'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="card">
                    <h3>إضافة دفعة</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <select name="unitId" value={formState.unitId} onChange={handleFormChange}>
                            <option value="">اختر وحدة...</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.code}</option>)}
                        </select>
                        <input name="amount" placeholder="المبلغ" value={formState.amount} onChange={handleFormChange} />
                        <select name="method" value={formState.method} onChange={handleFormChange}>
                            <option>نقدي</option><option>تحويل</option><option>قسط</option><option>جزئي</option>
                        </select>
                        {(formState.method === 'قسط' || formState.method === 'جزئي') && (
                            <select name="installmentId" value={formState.installmentId} onChange={handleFormChange}>
                                <option value="">اختر القسط...</option>
                                {availableInstallments.map(i => <option key={i.id} value={i.id}>{`قسط ${egp(i.amount)} - ${i.dueDate}`}</option>)}
                            </select>
                        )}
                        <input name="date" type="date" value={formState.date} onChange={handleFormChange} />
                        <button onClick={addPayment} className="btn-primary">إضافة</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Payments;
