import React from 'react';
import { useAppContext } from '../context/StateContext';
import { egp } from '../utils/formatters'; // I will create this file later

// Note: I will move charting functions to a utils file or their own components later.
// For now, keeping them here for simplicity.
const createDonutChart = (items) => {
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0) return <div style={{ textAlign: 'center', padding: '20px', opacity: 0.6 }}>لا توجد بيانات</div>;

    const gradientParts = [];
    let currentDeg = 0;
    items.forEach(item => {
        const percent = item.value / total * 100;
        if (percent > 0) {
            gradientParts.push(`${item.color} ${currentDeg}deg ${currentDeg + percent * 3.6}deg`);
        }
        currentDeg += percent * 3.6;
    });

    const legend = items.map(i => (
        <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: i.color, borderRadius: '3px' }} />
            <div>{i.label}: <strong>{i.value}</strong></div>
        </div>
    ));

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '10px' }}>
            <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: `conic-gradient(${gradientParts.join(',')})` }} />
            <div style={{ fontSize: '14px' }}>{legend}</div>
        </div>
    );
};

const Dashboard = () => {
    const { appState } = useAppContext();
    const { units, payments, installments } = appState;

    const totalUnits = units.length;
    const availUnits = units.filter(u => u.status === 'متاحة').length;
    const soldUnits = units.filter(u => u.status === 'مباعة').length;
    const returnedUnits = units.filter(u => u.status === 'مرتجعة').length;

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const unitChartData = [
        { value: availUnits, color: '#2563eb', label: 'متاحة' },
        { value: soldUnits, color: '#16a34a', label: 'مباعة' },
        { value: returnedUnits, color: '#ef4444', label: 'مرتجعة' }
    ];

    return (
        <div>
            <h1>لوحة التحكم</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div className="card">
                    <h3>إجمالي الوحدات</h3>
                    <div className="big-number">{totalUnits}</div>
                </div>
                <div className="card">
                    <h3>إجمالي المتحصلات</h3>
                    <div className="big-number">{egp(totalRevenue)}</div>
                </div>
            </div>
            <div className="card" style={{ marginTop: '20px' }}>
                <h3>نظرة عامة على الوحدات</h3>
                {createDonutChart(unitChartData)}
            </div>
        </div>
    );
};

// Simple Card component for styling consistency
const Card = ({ children, style }) => (
    <div style={{
        backgroundColor: '#fff',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        ...style
    }}>
        {children}
    </div>
);

// CSS classes to be added to a global CSS file
/*
.card {
    background-color: #fff;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.card h3 {
    margin-top: 0;
    margin-bottom: 16px;
    border-bottom: 1px solid #eee;
    padding-bottom: 8px;
}
.big-number {
    font-size: 36px;
    font-weight: bold;
    color: #001529;
}
*/

export default Dashboard;
