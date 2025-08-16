import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import './App.css';

import Dashboard from './pages/Dashboard';

import Customers from './pages/Customers';

import Units from './pages/Units';

import Contracts from './pages/Contracts';

// Add other placeholders as needed for the routes to work
import Payments from './pages/Payments';

import Installments from './pages/Installments';
import Partners from './pages/Partners';
import Treasury from './pages/Treasury';
import Reports from './pages/Reports';
import PartnerDebts from './pages/PartnerDebts';
import Backup from './pages/Backup';


function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/units" element={<Units />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/installments" element={<Installments />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/treasury" element={<Treasury />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/partner-debts" element={<PartnerDebts />} />
          <Route path="/backup" element={<Backup />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
