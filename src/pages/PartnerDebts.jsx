import React from 'react';
import { useAppContext } from '../context/StateContext';
import { egp } from '../utils/formatters';
import { partnerById, unitCode } from '../utils/data';

const PartnerDebts = () => {
    const { appState } = useAppContext();
    const { partnerDebts, partners, units } = appState;

    return (
        <div>
            <h1>ديون الشركاء</h1>
            <div className="card">
                <h3>قائمة ديون الشركاء</h3>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>الشريك الدافع</th>
                            <th>الشريك المستحق</th>
                            <th>الوحدة</th>
                            <th>تاريخ الاستحقاق</th>
                            <th>المبلغ</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {partnerDebts.map(debt => (
                            <tr key={debt.id}>
                                <td>{partnerById(debt.payingPartnerId, partners)?.name || 'محذوف'}</td>
                                <td>{partnerById(debt.owedPartnerId, partners)?.name || 'محذوف'}</td>
                                <td>{unitCode(debt.unitId, units)}</td>
                                <td>{debt.dueDate}</td>
                                <td>{egp(debt.amount)}</td>
                                <td>{debt.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PartnerDebts;
