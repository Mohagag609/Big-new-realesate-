import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/StateContext';
import { uid } from '../utils/helpers';
import { egp } from '../utils/formatters';
import { parseNumber } from '../utils/parsers';

const Units = () => {
    const { appState, setAppState } = useAppContext();
    const { units, contracts, payments } = appState;

    const [formState, setFormState] = useState({
        code: '', name: '', totalPrice: '', status: 'متاحة', floor: '', building: ''
    });
    const [query, setQuery] = useState('');

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const calcRemaining = useMemo(() => {
        const remainingCache = {};
        return (unit) => {
            if (remainingCache[unit.id]) return remainingCache[unit.id];

            const ct = contracts.find(c => c.unitId === unit.id);
            if (!ct) return Number(unit.totalPrice || 0);

            const totalPrice = Number(ct.totalPrice || unit.totalPrice || 0);
            const installmentPayments = payments
                .filter(p => p.unitId === unit.id && p.installmentId)
                .reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const downPayment = Number(ct.downPayment || 0);
            const totalPaid = downPayment + installmentPayments;
            const result = Math.max(0, totalPrice - totalPaid);
            remainingCache[unit.id] = result;
            return result;
        };
    }, [contracts, payments]);

    const addUnit = () => {
        let { code, name, totalPrice, status, floor, building } = formState;
        totalPrice = parseNumber(totalPrice);

        if (!code.trim()) {
            if (!building.trim() || !floor.trim() || !name.trim()) {
                return alert('لإنشاء كود تلقائي، الرجاء إدخال اسم الوحدة ورقم الدور والعمارة.');
            }
            code = `${building.trim()} - ${floor.trim()} - (${name.trim()})`;
        }
        if (!totalPrice) return alert('أدخل السعر الكلي للوحدة');
        if (units.some(u => u.code.toLowerCase() === code.toLowerCase())) {
            return alert('هذا الكود مستخدم بالفعل. الرجاء إدخال كود فريد.');
        }

        const newUnit = { id: uid('U'), code, name, totalPrice, status, floor, building };
        setAppState(prev => ({ ...prev, units: [...prev.units, newUnit] }));
        setFormState({ code: '', name: '', totalPrice: '', status: 'متاحة', floor: '', building: '' }); // Reset form
    };

    const deleteUnit = (id) => {
        if (contracts.some(c => c.unitId === id)) {
            return alert('لا يمكن حذف هذه الوحدة لأنها مرتبطة بعقد قائم. يجب حذف العقد أولاً.');
        }
        if (window.confirm('هل أنت متأكد من الحذف؟')) {
            setAppState(prev => ({ ...prev, units: prev.units.filter(u => u.id !== id) }));
        }
    };

    const updateUnit = (id, key, value) => {
        setAppState(prevState => ({
            ...prevState,
            units: prevState.units.map(u =>
                u.id === id ? { ...u, [key]: key === 'totalPrice' ? parseNumber(value) : value } : u
            )
        }));
    };

    const filteredUnits = useMemo(() => {
        return units.filter(u => {
            const searchable = `${u.code || ''} ${u.name || ''} ${u.floor || ''} ${u.building || ''} ${u.status || ''}`.toLowerCase();
            return searchable.includes(query.toLowerCase());
        });
    }, [units, query]);

    return (
        <div>
            <h1>الوحدات</h1>
            <div className="card" style={{ marginBottom: '24px' }}>
                <h3>إضافة وحدة جديدة</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                    <input name="code" placeholder="كود/اسم مختصر" value={formState.code} onChange={handleFormChange} />
                    <input name="name" placeholder="اسم الوحدة" value={formState.name} onChange={handleFormChange} />
                    <input name="totalPrice" placeholder="السعر الكلي" value={formState.totalPrice} onChange={handleFormChange} />
                    <select name="status" value={formState.status} onChange={handleFormChange} style={{padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '6px'}}>
                        <option>متاحة</option><option>مباعة</option><option>مرتجعة</option>
                    </select>
                    <input name="floor" placeholder="رقم الدور" value={formState.floor} onChange={handleFormChange} />
                    <input name="building" placeholder="رقم العمارة" value={formState.building} onChange={handleFormChange} />
                    <button onClick={addUnit} className="btn-primary">إضافة وحدة</button>
                </div>
            </div>

            <div className="card">
                <h3>قائمة الوحدات</h3>
                <input type="text" placeholder="بحث..." value={query} onChange={e => setQuery(e.target.value)} style={{ marginBottom: '16px', width: '100%', padding: '8px' }} />
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>الكود</th><th>اسم الوحدة</th><th>السعر</th><th>الدور</th><th>العمارة</th><th>المتبقي</th><th>الحالة</th><th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUnits.map(unit => (
                            <tr key={unit.id}>
                                <td contentEditable suppressContentEditableWarning onBlur={e => updateUnit(unit.id, 'code', e.target.innerText)}>{unit.code}</td>
                                <td contentEditable suppressContentEditableWarning onBlur={e => updateUnit(unit.id, 'name', e.target.innerText)}>{unit.name}</td>
                                <td contentEditable suppressContentEditableWarning onBlur={e => updateUnit(unit.id, 'totalPrice', e.target.innerText)}>{unit.totalPrice}</td>
                                <td contentEditable suppressContentEditableWarning onBlur={e => updateUnit(unit.id, 'floor', e.target.innerText)}>{unit.floor}</td>
                                <td contentEditable suppressContentEditableWarning onBlur={e => updateUnit(unit.id, 'building', e.target.innerText)}>{unit.building}</td>
                                <td>{egp(calcRemaining(unit))}</td>
                                <td contentEditable suppressContentEditableWarning onBlur={e => updateUnit(unit.id, 'status', e.target.innerText)}>{unit.status}</td>
                                <td>
                                    {/* Placeholder for future actions like 'details' or 'return' */}
                                    <button onClick={() => deleteUnit(unit.id)} className="btn-danger">حذف</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Units;
