import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import './App.css';

// A simple welcome component for the root path
const Welcome = () => (
  <div className="card">
    <h1>أهلاً بك في مدير الاستثمار العقاري</h1>
    <p>استخدم القائمة على اليمين للتنقل بين الشاشات المختلفة.</p>
    <p>لقد تم بناء هذا الهيكل الأساسي للتطبيق. الخطوة التالية هي إضافة الوظائف لكل شاشة.</p>
  </div>
);

// A simple 404 component
const NotFound = () => (
    <div className="card">
        <h1>404 - الصفحة غير موجودة</h1>
        <p>عفواً، لم نتمكن من العثور على الصفحة التي تبحث عنها.</p>
    </div>
);


function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Welcome />} />
          {/* The other routes will be added here in the next steps */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
