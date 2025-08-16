import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/StateContext';
import { uid } from '../utils/helpers';
import { egp } from '../utils/formatters';
import { parseNumber } from '../utils/parsers';
import { custById, unitCode, today } from '../utils/data';

const Contracts = () => {
    const { appState, setAppState } = useAppContext();
    const { contracts, units, customers, unitPartners } = appState;
    const navigate = useNavigate();

    const initialFormState = {
        unitId: '', customerId: '', totalPrice: '', downPayment: '',
        brokerPercent: '', type: 'شهري', count: '12', extraAnnual: '0', start: today()
    };
    const [formState, setFormState] = useState(initialFormState);

    const handleFormChange = e => setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const createContract = () => {
        const { unitId, customerId, type, start } = formState;
        if (!unitId || !customerId) return alert('اختر الوحدة والعميل');

        const partners = unitPartners.filter(up => up.unitId === unitId);
        const totalPercent = partners.reduce((sum, p) => sum + (p.percent || 0), 0);
        if (partners.length > 0 && totalPercent !== 100) {
            if (!window.confirm(`تحذير: مجموع نسب الشركاء لهذه الوحدة هو ${totalPercent}%. هل تريد المتابعة؟`)) {
                return;
            }
        }

        const total = parseNumber(formState.totalPrice);
        const down = parseNumber(formState.downPayment);
        const brokerP = parseNumber(formState.brokerPercent);
        const count = parseInt(formState.count || '0', 10);
        const extra = parseInt(formState.extraAnnual || '0', 10);
        const startDate = new Date(start);

        if (count <= 0 && extra <=0) return alert('عدد الدفعات غير صالح');

        const brokerAmt = Math.round((total * brokerP / 100) * 100) / 100;
        const code = 'CTR-' + String(contracts.length + 1).padStart(5, '0');
        const newContract = { id: uid('CT'), code, ...formState, totalPrice: total, downPayment: down, brokerPercent: brokerP, brokerAmount: brokerAmt, count, extraAnnual: extra };

        const newInstallments = [];
        const months = { 'شهري': 1, 'ربع سنوي': 3, 'نصف سنوي': 6, 'سنوي': 12 }[type] || 1;
        const remain = Math.max(0, total - down - brokerAmt);
        const parts = count + extra;
        const base = parts > 0 ? Math.floor((remain / parts) * 100) / 100 : 0;
        let acc = 0;

        for (let i = 0; i < count; i++) {
            const d = new Date(startDate);
            d.setMonth(d.getMonth() + months * (i + 1));
            const amt = (i === count - 1 && extra === 0) ? Math.round((remain - acc) * 100) / 100 : base;
            acc += amt;
            newInstallments.push({ id: uid('I'), unitId, type, amount: amt, originalAmount: amt, dueDate: d.toISOString().slice(0, 10), paymentDate: null, status: 'غير مدفوع' });
        }
        for (let j = 0; j < extra; j++) {
            const d = new Date(startDate);
            d.setMonth(d.getMonth() + 12 * (j + 1));
            const amt = (j === extra - 1) ? Math.round((remain - acc) * 100) / 100 : base;
            acc += amt;
            newInstallments.push({ id: uid('I'), unitId, type: 'سَنوي إضافي', amount: amt, originalAmount: amt, dueDate: d.toISOString().slice(0, 10), paymentDate: null, status: 'غير مدفوع' });
        }

        setAppState(prev => ({
            ...prev,
            contracts: [...prev.contracts, newContract],
            installments: [...prev.installments, ...newInstallments],
            units: prev.units.map(u => u.id === unitId ? { ...u, status: 'مباعة' } : u)
        }));
        setFormState(initialFormState); // Reset form
    };

    const deleteContract = (contractId) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا العقد؟ سيتم حذف جميع الأقساط والمدفوعات المرتبطة به.')) return;
        const contract = contracts.find(c => c.id === contractId);
        if (!contract) return;
        setAppState(prev => ({
            ...prev,
            contracts: prev.contracts.filter(c => c.id !== contractId),
            installments: prev.installments.filter(i => i.unitId !== contract.unitId),
            payments: prev.payments.filter(p => p.unitId !== contract.unitId),
            units: prev.units.map(u => u.id === contract.unitId ? { ...u, status: 'متاحة' } : u)
        }));
    };

    // In a real app, you'd have a separate details page, but for now, this is fine.
    const viewContractDetails = (contractId) => {
        // This is where you would navigate to a details page.
        // For now, we can just log it or show an alert.
        alert(`Navigating to details for contract ${contractId}`);
    };

    return (
        <div>
            <h1>العقود</h1>
            <div className="card" style={{ marginBottom: '24px' }}>
                <h3>إضافة عقد جديد</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', alignItems: 'flex-end', marginTop: '16px' }}>
                    <select name="unitId" value={formState.unitId} onChange={handleFormChange} style={{padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '6px'}}>
                        <option value="">اختر وحدة...</option>
                        {units.filter(u => u.status !== 'مباعة').map(u => <option key={u.id} value={u.id}>{u.code}</option>)}
                    </select>
                    <select name="customerId" value={formState.customerId} onChange={handleFormChange} style={{padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '6px'}}>
                        <option value="">اختر عميل...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input name="totalPrice" placeholder="السعر الكلي" value={formState.totalPrice} onChange={handleFormChange} />
                    <input name="downPayment" placeholder="المقدم" value={formState.downPayment} onChange={handleFormChange} />
                    <input name="brokerPercent" placeholder="نسبة السمسار %" value={formState.brokerPercent} onChange={handleFormChange} />
                    <select name="type" value={formState.type} onChange={handleFormChange} style={{padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '6px'}}>
                        <option>شهري</option><option>ربع سنوي</option><option>نصف سنوي</option><option>سنوي</option>
                    </select>
                    <input name="count" placeholder="عدد الدفعات" value={formState.count} onChange={handleFormChange} />
                    <input name="extraAnnual" placeholder="دفعات سنوية إضافية" value={formState.extraAnnual} onChange={handleFormChange} />
                    <input name="start" type="date" value={formState.start} onChange={handleFormChange} />
                    <button onClick={createContract} className="btn-primary">إضافة عقد</button>
                </div>
            </div>
            <div className="card">
                <h3>قائمة العقود</h3>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>كود العقد</th><th>الوحدة</th><th>العميل</th><th>السعر</th><th>تاريخ البدء</th><th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contracts.map(c => (
                            <tr key={c.id}>
                                <td>{c.code}</td>
                                <td>{unitCode(c.unitId, units)}</td>
                                <td>{(custById(c.customerId, customers) || {}).name || '—'}</td>
                                <td>{egp(c.totalPrice)}</td>
                                <td>{c.start}</td>
                                <td>
                                    <button onClick={() => viewContractDetails(c.id)} style={{marginLeft: '8px'}}>عرض</button>
                                    <button onClick={() => deleteContract(c.id)} className="btn-danger">حذف</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Contracts;
