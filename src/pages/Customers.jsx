import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/StateContext';
import { uid } from '../utils/helpers'; // I need to create this file

const Customers = () => {
    const { appState, setAppState } = useAppContext();
    const { customers } = appState;

    // State for the form inputs
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    // State for the search query
    const [query, setQuery] = useState('');

    const addCustomer = () => {
        if (!name.trim()) {
            alert('اكتب اسم العميل');
            return;
        }
        const newCustomer = { id: uid('C'), name: name.trim(), phone: phone.trim() };
        setAppState(prevState => ({
            ...prevState,
            customers: [...prevState.customers, newCustomer]
        }));
        // Reset form
        setName('');
        setPhone('');
    };

    const deleteCustomer = (id) => {
        if (window.confirm('هل أنت متأكد من الحذف؟')) {
            setAppState(prevState => ({
                ...prevState,
                customers: prevState.customers.filter(c => c.id !== id)
            }));
        }
    };

    const updateCustomer = (id, key, value) => {
        setAppState(prevState => ({
            ...prevState,
            customers: prevState.customers.map(c =>
                c.id === id ? { ...c, [key]: value } : c
            )
        }));
    };

    const filteredCustomers = useMemo(() => {
        return customers.filter(c =>
            (c.name || '').toLowerCase().includes(query.toLowerCase()) ||
            (c.phone || '').toLowerCase().includes(query.toLowerCase())
        );
    }, [customers, query]);

    return (
        <div>
            <h1>العملاء</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
                <div className="card">
                    <h3>قائمة العملاء</h3>
                    <input
                        type="text"
                        placeholder="بحث بالاسم أو الهاتف..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{ marginBottom: '16px', width: '100%', padding: '8px' }}
                    />
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>الاسم</th>
                                <th>الهاتف</th>
                                <th>إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map(customer => (
                                <tr key={customer.id}>
                                    <td
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => updateCustomer(customer.id, 'name', e.target.innerText)}
                                    >
                                        {customer.name}
                                    </td>
                                    <td
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => updateCustomer(customer.id, 'phone', e.target.innerText)}
                                    >
                                        {customer.phone}
                                    </td>
                                    <td>
                                        <button onClick={() => deleteCustomer(customer.id)} className="btn-danger">حذف</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="card">
                    <h3>إضافة عميل جديد</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                            type="text"
                            placeholder="اسم العميل"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="رقم الهاتف"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                        <button onClick={addCustomer} className="btn-primary">إضافة</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Customers;
