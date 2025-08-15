import { state, persist, saveState, setNavFunction, setApplySettings, setCurrentView, undo, redo } from './state.js';
import { applySettings } from './utils.js';

// Import all view renderers
import { renderDashboard } from './views/dashboard.js';
import { renderCustomers } from './views/customers.js';
import { renderUnits } from './views/units.js';
import { renderContracts } from './views/contracts.js';
import { renderInstallments } from './views/installments.js';
import { renderPayments } from './views/payments.js';
import { renderPartners } from './views/partners.js';
import { renderTreasury } from './views/treasury.js';
import { renderReports } from './views/reports.js';
import { renderPartnerDebts } from './views/partner-debts.js';
import { renderBackup } from './views/backup.js';
import { renderUnitDetails } from './views/unit-details.js';
import { renderContractDetails } from './views/contract-details.js';


const view = document.getElementById('view');
const tabsContainer = document.getElementById('tabs');

const routes = [
    { id: 'dash', title: 'لوحة التحكم', render: renderDashboard, tab: true },
    { id: 'customers', title: 'العملاء', render: renderCustomers, tab: true },
    { id: 'units', title: 'الوحدات', render: renderUnits, tab: true },
    { id: 'contracts', title: 'العقود', render: renderContracts, tab: true },
    { id: 'installments', title: 'الأقساط', render: renderInstallments, tab: true },
    { id: 'payments', title: 'المدفوعات', render: renderPayments, tab: true },
    { id: 'partners', title: 'الشركاء', render: renderPartners, tab: true },
    { id: 'treasury', title: 'الخزينة', render: renderTreasury, tab: true },
    { id: 'reports', title: 'التقارير', render: renderReports, tab: true },
    { id: 'partner-debts', title: 'ديون الشركاء', render: renderPartnerDebts, tab: true },
    { id: 'backup', title: 'نسخة احتياطية', render: renderBackup, tab: true },
    { id: 'unit-details', title: 'تفاصيل الوحدة', render: renderUnitDetails, tab: false },
    { id: 'contract-details', title: 'تفاصيل العقد', render: renderContractDetails, tab: false },
];

function nav(id, param = null, doSaveState = true) {
    const route = routes.find(x => x.id === id);
    if (!route) return;

    if (doSaveState) {
        saveState();
    }
    setCurrentView(id);

    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById('tab-' + id);
    if (tab) tab.classList.add('active');

    // Render the view
    route.render(view, nav, param);
}

// --- Initial Setup ---

// Inject dependencies to break circular references
setNavFunction(nav);
setApplySettings(applySettings);

// Create tabs
routes.forEach(r => {
    if (r.tab) {
        const b = document.createElement('button');
        b.className = 'tab';
        b.id = 'tab-' + r.id;
        b.textContent = r.title;
        b.onclick = () => nav(r.id);
        tabsContainer.appendChild(b);
    }
});

// Setup header controls
document.getElementById('themeSel').value = state.settings.theme || 'dark';
document.getElementById('fontSel').value = String(state.settings.font || 16);
document.getElementById('themeSel').onchange = (e) => { state.settings.theme = e.target.value; persist(); };
document.getElementById('fontSel').onchange = (e) => { state.settings.font = Number(e.target.value); persist(); };
document.getElementById('lockBtn').onclick = () => {
    const pass = prompt('ضع كلمة مرور أو اتركها فارغة لإلغاء القفل', '');
    state.locked = !!pass;
    state.settings.pass = pass || null;
    persist();
    alert(state.locked ? 'تم تفعيل القفل' : 'تم إلغاء القفل');
    checkLock();
};

function checkLock() {
    if (state.locked) {
        const p = prompt('اكتب كلمة المرور للدخول');
        if (p !== state.settings.pass) {
            alert('كلمة مرور غير صحيحة');
            location.reload();
        }
    }
}

// Setup keyboard shortcuts for undo/redo
document.addEventListener('keydown', (e) => {
    const targetNode = e.target.nodeName.toLowerCase();
    if (targetNode === 'input' || targetNode === 'textarea' || e.target.isContentEditable) {
        return;
    }
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo(); }
        else if (e.key === 'y') { e.preventDefault(); redo(); }
    }
});

// Initial load
applySettings();
checkLock();
nav('dash');
