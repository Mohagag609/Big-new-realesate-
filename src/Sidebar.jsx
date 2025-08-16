import React from 'react';
import { NavLink } from 'react-router-dom';

const routes = [
    { path: '/', title: 'لوحة التحكم' },
    { path: '/customers', title: 'العملاء' },
    { path: '/units', title: 'الوحدات' },
    { path: '/contracts', title: 'العقود' },
    { path: '/installments', title: 'الأقساط' },
    { path: '/payments', title: 'المدفوعات' },
    { path: '/partners', title: 'الشركاء' },
    { path: '/treasury', title: 'الخزينة' },
    { path: '/reports', title: 'التقارير' },
    { path: '/partner-debts', title: 'ديون الشركاء' },
    { path: '/backup', title: 'نسخة احتياطية' },
];

function Sidebar() {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                🏛️ مدير الاستثمار
            </div>
            <nav>
                <ul>
                    {routes.map(route => (
                        <li key={route.path}>
                            <NavLink to={route.path} end>
                                {route.title}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
}

export default Sidebar;
