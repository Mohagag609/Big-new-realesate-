import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/StateContext';
import { egp } from '../utils/formatters';
import { unitCode } from '../utils/data';

const Installments = () => {
    const { appState, setAppState } = useAppContext();
    const { installments, units, payments } = appState;

    const [query, setQuery] = useState('');
    const [sort, setSort] = useState({ key: 'dueDate', dir: 'asc' });

    const getInstallmentPaidAmount = (instId) => {
        return payments
            .filter(p => p.installmentId === instId)
            .reduce((sum, p) => sum + p.amount, 0);
    };

    const filteredInstallments = useMemo(() => {
        let list = installments.slice();
        if (query) {
            const lowerQuery = query.toLowerCase();
            list = list.filter(i => {
                const searchable = `${unitCode(i.unitId, units)} ${i.status || ''} ${i.dueDate || ''}`.toLowerCase();
                return searchable.includes(lowerQuery);
            });
        }

        return list.sort((a, b) => {
            const valA = a[sort.key] || '';
            const valB = b[sort.key] || '';
            if (valA < valB) return sort.dir === 'asc' ? -1 : 1;
            if (valA > valB) return sort.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [installments, units, query, sort]);

    const handleSort = (key) => {
        setSort(prevSort => ({
            key,
            dir: prevSort.key === key && prevSort.dir === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Placeholder for action functions
    const handleEdit = (id) => alert(`Editing installment ${id}`);
    const handlePay = (id) => alert(`Paying installment ${id}`);

    return (
        <div>
            <h1>الأقساط</h1>
            <div className="card">
                <h3>قائمة جميع الأقساط</h3>
                <input type="text" placeholder="بحث..." value={query} onChange={e => setQuery(e.target.value)} style={{ marginBottom: '16px', width: '100%' }} />
                <table className="data-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('unitId')}>الوحدة</th>
                            <th onClick={() => handleSort('type')}>النوع</th>
                            <th onClick={() => handleSort('originalAmount')}>المبلغ الأصلي</th>
                            <th onClick={() => handleSort('amount')}>المتبقي</th>
                            <th>المسدد</th>
                            <th onClick={() => handleSort('dueDate')}>الاستحقاق</th>
                            <th onClick={() => handleSort('status')}>الحالة</th>
                            <th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInstallments.map(inst => {
                            const paidAmount = getInstallmentPaidAmount(inst.id);
                            return (
                                <tr key={inst.id}>
                                    <td>{unitCode(inst.unitId, units)}</td>
                                    <td>{inst.type}</td>
                                    <td>{egp(inst.originalAmount)}</td>
                                    <td>{egp(inst.amount)}</td>
                                    <td>{egp(paidAmount)}</td>
                                    <td>{inst.dueDate}</td>
                                    <td>{inst.status}</td>
                                    <td>
                                        <button onClick={() => handlePay(inst.id)} disabled={inst.status === 'مدفوع'}>دفع</button>
                                        <button onClick={() => handleEdit(inst.id)} style={{marginRight: '8px'}} disabled={inst.status === 'مدفوع'}>تعديل</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Installments;
