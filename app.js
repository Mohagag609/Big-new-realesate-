/* ===== أساس التطبيق / إعدادات / قفل ===== */
const APPKEY='estate_pro_final_v3';
const state = load();
let historyStack = [];
let historyIndex = -1;
let currentView = 'dash'; // To track the current page for refresh on undo/redo

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const restoredState = JSON.parse(JSON.stringify(historyStack[historyIndex]));
        // Clear current state and copy properties from restored state
        Object.keys(state).forEach(key => delete state[key]);
        Object.assign(state, restoredState);
        persist();
        nav(currentView); // Re-render the current view
    }
}

function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        const restoredState = JSON.parse(JSON.stringify(historyStack[historyIndex]));
        Object.keys(state).forEach(key => delete state[key]);
        Object.assign(state, restoredState);
        persist();
        nav(currentView); // Re-render the current view
    }
}

function saveState() {
    // Clear the 'redo' history if we've undone and are now making a new change
    historyStack = historyStack.slice(0, historyIndex + 1);

    // Push a deep copy of the current state
    historyStack.push(JSON.parse(JSON.stringify(state)));

    // Limit history stack size to prevent using too much memory
    if (historyStack.length > 50) {
        historyStack.shift();
    }

    historyIndex = historyStack.length - 1;
}

function load(){
  try{
    const s = JSON.parse(localStorage.getItem(APPKEY))||{};

    // Data migration for customers
    if (s.customers && s.customers.length > 0) {
      s.customers.forEach(c => {
        c.nationalId = c.nationalId || '';
        c.address = c.address || '';
        c.status = c.status || 'نشط';
        c.notes = c.notes || '';
      });
    }

    // Data migration for units
    if (s.units && s.units.length > 0) {
      s.units.forEach(u => {
        u.area = u.area || '';
        u.notes = u.notes || '';
        u.type = u.type || 'سكني'; // Add unit type, default to residential
        // Revert from plans array to single totalPrice
        if (u.plans && u.plans.length > 0) {
            u.totalPrice = u.plans[0].price;
        } else if (!u.hasOwnProperty('totalPrice')) {
            u.totalPrice = 0;
        }
        delete u.plans;
      });
    }

    // Data migration for contracts
    if (s.contracts && s.contracts.length > 0) {
      s.contracts.forEach(c => {
        c.brokerName = c.brokerName || '';
        c.commissionSafeId = c.commissionSafeId || null;
        c.discountAmount = c.discountAmount || 0;
        delete c.planName; // Obsolete
      });
    }

    // Data migration for safes
    s.safes = s.safes || [];
    if (s.safes.length === 0) {
        s.safes.push({ id: uid('S'), name: 'الخزنة الرئيسية', balance: 0 });
    } else {
      s.safes.forEach(safe => {
        safe.balance = safe.balance || 0;
      });
    }

    s.auditLog = s.auditLog || [];
    s.vouchers = s.vouchers || [];

    // Migration from payments to vouchers (run once)
    if (s.payments && s.payments.length > 0 && s.vouchers.length === 0) {
        console.log('Migrating payments to vouchers...');
        s.payments.forEach(p => {
            const unit = s.units.find(u => u.id === p.unitId);
            const contract = s.contracts.find(c => c.unitId === p.unitId);
            const customer = contract ? s.customers.find(cust => cust.id === contract.customerId) : null;
            s.vouchers.push({
                id: uid('V'),
                type: 'receipt',
                date: p.date,
                amount: p.amount,
                safeId: p.safeId,
                description: `دفعة للوحدة ${unit ? unit.code : 'غير معروفة'}`,
                payer: customer ? customer.name : 'غير محدد',
                linked_ref: p.unitId
            });
        });

        s.contracts.forEach(c => {
            if (c.brokerAmount > 0) {
                const unit = s.units.find(u => u.id === c.unitId);
                s.vouchers.push({
                    id: uid('V'),
                    type: 'payment',
                    date: c.start,
                    amount: c.brokerAmount,
                    safeId: c.commissionSafeId,
                    description: `عمولة سمسار للوحدة ${unit ? unit.code : 'غير معروفة'}`,
                    beneficiary: c.brokerName || 'سمسار',
                    linked_ref: c.id
                });
            }
        });
    }


    s.brokerDues = s.brokerDues || [];

    return {
      customers:[],units:[],partners:[],unitPartners:[],contracts:[],installments:[],payments:[],partnerDebts:[], safes: [], transfers: [], auditLog: [], vouchers: [], brokerDues: [],
      settings:{theme:'dark',font:16},locked:false,
      ...s
    };
  }catch{
    return {customers:[],units:[],partners:[],unitPartners:[],contracts:[],installments:[],payments:[],partnerDebts:[], safes: [], transfers: [], auditLog: [], vouchers: [], brokerDues: [],
      settings:{theme:'dark',font:16},locked:false};
  }
}
function persist(){ localStorage.setItem(APPKEY, JSON.stringify(state)); applySettings(); }
function uid(p){ return p+'-'+Math.random().toString(36).slice(2,9); }
function today(){ return new Date().toISOString().slice(0,10); }
function logAction(description, details = {}) {
    state.auditLog.push({
        id: uid('LOG'),
        timestamp: new Date().toISOString(),
        description,
        details
    });
}
const fmt = new Intl.NumberFormat('ar-EG'); function egp(v){ v=Number(v||0); return isFinite(v)?fmt.format(v)+' ج.م':'' }
function applySettings(){ document.documentElement.setAttribute('data-theme', state.settings.theme||'dark'); document.documentElement.style.fontSize=(state.settings.font||16)+'px'; }
applySettings();
document.getElementById('themeSel').value=state.settings.theme||'dark';
document.getElementById('fontSel').value=String(state.settings.font||16);
document.getElementById('themeSel').onchange=(e)=>{ state.settings.theme=e.target.value; persist(); };
document.getElementById('fontSel').onchange=(e)=>{ state.settings.font=Number(e.target.value); persist(); };
document.getElementById('lockBtn').onclick=()=>{
  const pass=prompt('ضع كلمة مرور أو اتركها فارغة لإلغاء القفل','');
  state.locked=!!pass; state.settings.pass=pass||null; persist();
  alert(state.locked?'تم تفعيل القفل':'تم إلغاء القفل'); checkLock();
};
function checkLock(){
  if(state.locked){
    const p=prompt('اكتب كلمة المرور للدخول');
    if(p!==state.settings.pass){
      alert('كلمة مرور غير صحيحة'); location.reload();
    }
  }
}
checkLock();
saveState(); // Save the initial state

/* ===== تنقل ===== */
let currentParam = null;
const routes=[
  {id:'dash',title:'لوحة التحكم',render:renderDash, tab: true},
  {id:'old-dash',title:'لوحة التحكم القديمة',render:renderOldDash, tab: false}, // Hidden for now
  {id:'customers',title:'العملاء',render:renderCustomers, tab: true},
  {id:'units',title:'الوحدات',render:renderUnits, tab: true},
  {id:'contracts',title:'العقود',render:renderContracts, tab: true},
  {id:'installments',title:'الأقساط',render:renderInstallments, tab: true},
  {id:'vouchers',title:'السندات',render:renderVouchers, tab: true},
  {id:'partners',title:'الشركاء',render:renderPartners, tab: true},
  {id:'treasury',title:'الخزينة',render:renderTreasury, tab: true},
  {id:'brokerDues',title:'عمولات مستحقة',render:renderBrokerDues, tab: true},
  {id:'reports',title:'التقارير',render:renderReports, tab: true},
  {id:'partner-debts',title:'ديون الشركاء',render:renderPartnerDebts, tab: false}, // Merged into Partners screen
  {id:'audit', title: 'سجل التغييرات', render: renderAuditLog, tab: true},
  {id:'backup',title:'نسخة احتياطية',render:renderBackup, tab: true},
  {id:'unit-details', title:'تفاصيل الوحدة', render:renderUnitDetails, tab: false},
  {id: 'broker-ledger', title: 'كشف حساب سمسار', render: renderBrokerLedger, tab: false},
  {id: 'partner-details', title: 'تفاصيل الشريك', render: renderPartnerDetails, tab: false},
];
const tabs=document.getElementById('tabs'), view=document.getElementById('view');
routes.forEach(r=>{ if(r.tab){const b=document.createElement('button'); b.className='tab'; b.id='tab-'+r.id; b.textContent=r.title; b.onclick=()=>nav(r.id); tabs.appendChild(b);} });
function nav(id, param = null){
  currentView = id;
  currentParam = param;
  const route = routes.find(x=>x.id===id);
  if(!route) return;

  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  const tab = document.getElementById('tab-'+id);
  if(tab) tab.classList.add('active');

  route.render(param);
}
nav('dash');

/* ===== أدوات عامة ===== */
function showModal(title, content, onSave) {
    const modal = document.createElement('div');
    modal.id = 'dynamic-modal';
    modal.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;';
    modal.innerHTML = `
        <div style="background:var(--panel);padding:20px;border-radius:12px;width:90%;max-width:500px;">
            <h3>${title}</h3>
            <div>${content}</div>
            <div class="tools" style="margin-top:20px;justify-content:flex-end;">
                <button class="btn secondary" id="modal-cancel">إلغاء</button>
                <button class="btn" id="modal-save">حفظ</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('modal-cancel').onclick = () => document.body.removeChild(modal);
    document.getElementById('modal-save').onclick = () => {
        if (onSave()) {
            document.body.removeChild(modal);
        }
    };
}
function table(headers, rows, sortKey=null, onSort=null){
  const head = headers.map((h,i)=>`<th data-idx="${i}">${h}${sortKey&&sortKey.idx===i?(sortKey.dir==='asc'?' ▲':' ▼'):''}</th>`).join('');
  const body = rows.length? rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}"><small>لا توجد بيانات</small></td></tr>`;
  const html = `<table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  const wrap=document.createElement('div'); wrap.innerHTML=html;
  if(onSort){
    wrap.querySelectorAll('th').forEach(th=> th.onclick=()=>{
      const idx=Number(th.dataset.idx); const dir = sortKey && sortKey.idx===idx && sortKey.dir==='asc' ? 'desc' : 'asc';
      onSort({idx,dir});
    });
  }
  return wrap.innerHTML;
}
function exportCSV(headers, rows, name){
  const csv=[headers.join(','), ...rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}), url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
function parseNumber(v){ v=String(v||'').replace(/[^\d.]/g,''); return Number(v||0); }
function printHTML(title, bodyHTML){
  const w=window.open('','_blank');
  if(!w) return alert('الرجاء السماح بال نوافذ المنبثقة لطباعة التقارير.');
  w.document.write(`<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
  <style>
    @page{size:A4;margin:12mm}
    body{font-family:system-ui,Segoe UI,Roboto; padding:0; margin:0; direction:rtl; color:#111}
    .wrap{padding:16px 18px}
    h1{font-size:20px;margin:0 0 12px 0}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{border:1px solid #ccc;padding:6px 8px;text-align:right;vertical-align:top}
    thead th{background:#f1f5f9}
    footer{margin-top:12px;font-size:11px;color:#555}
  </style>
  </head><body><div class="wrap">${bodyHTML}
  <footer>تمت الطباعة في ${new Date().toLocaleString('ar-EG')}</footer>
  </div></body></html>`);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 250);
}
function unitById(id){ return state.units.find(u=>u.id===id); }
function custById(id){ return state.customers.find(c=>c.id===id); }
function partnerById(id){ return state.partners.find(p=>p.id===id); }
function unitCode(id){ return (unitById(id)||{}).code||'—'; }
function getUnitDisplayName(unit) {
    if (!unit) return '—';
    const parts = [];
    if (unit.name) parts.push(unit.name);
    else parts.push(unit.code);

    const details = [];
    if (unit.building) details.push(`عمارة: ${unit.building}`);
    if (unit.floor) details.push(`دور: ${unit.floor}`);
    if (details.length > 0) parts.push(`(${details.join(' - ')})`);

    return parts.join(' ');
}


function renderPartnerDetails(partnerId) {
    const partner = partnerById(partnerId);
    if (!partner) {
        view.innerHTML = `<div class="card"><p>لم يتم العثور على الشريك.</p></div>`;
        return;
    }

    const ledger = generatePartnerLedger(partnerId);
    const ownedUnits = state.unitPartners.filter(up => up.partnerId === partnerId);

    const kpiHTML = `
        <div class="card"><h4>إجمالي الدخل</h4><div class="big" style="color:var(--ok);">${egp(ledger.totalIncome)}</div></div>
        <div class="card"><h4>إجمالي المصروفات</h4><div class="big" style="color:var(--warn);">${egp(ledger.totalExpense)}</div></div>
        <div class="card"><h4>صافي الموقف</h4><div class="big" style="color:var(--brand);">${egp(ledger.netPosition)}</div></div>
    `;

    const unitsRows = ownedUnits.map(up => [
        getUnitDisplayName(unitById(up.unitId)),
        `${up.percent} %`
    ]);

    let balance = 0;
    const ledgerRows = ledger.transactions.map(tx => {
        balance += (tx.income || 0) - (tx.expense || 0);
        return [
            tx.date,
            tx.description,
            tx.income ? `<span style="color:var(--ok)">${egp(tx.income)}</span>` : '—',
            tx.expense ? `<span style="color:var(--warn)">${egp(tx.expense)}</span>` : '—',
            `<strong style="color:var(--brand)">${egp(balance)}</strong>`
        ];
    });

    view.innerHTML = `
        <div class="card">
            <div class="header">
                <h3>تفاصيل الشريك: ${partner.name}</h3>
                <button class="btn secondary" onclick="nav('partners')">⬅️ العودة للشركاء</button>
            </div>
            <p style="color:var(--muted);">${partner.phone||''}</p>
        </div>

        <div class="grid grid-3" style="margin-top:16px;">
            ${kpiHTML}
        </div>

        <div class="grid grid-2" style="margin-top:16px; align-items: flex-start;">
            <div class="card">
                <h4>الوحدات المملوكة</h4>
                ${table(['الوحدة', 'نسبة الملكية'], unitsRows)}
            </div>
            <div class="card">
                <h4>كشف الحساب التفصيلي</h4>
                <div style="max-height: 400px; overflow-y: auto;">
                    ${table(['التاريخ', 'البيان', 'دخل', 'صرف', 'الرصيد'], ledgerRows)}
                </div>
            </div>
        </div>
    `;
}

function generatePartnerLedger(partnerId) {
    const transactions = [];
    let totalIncome = 0;
    let totalExpense = 0;

    // Process vouchers to get income and expenses
    state.vouchers.forEach(v => {
        let contract;
        // Find contract, accommodating different linked_ref types
        const directContract = state.contracts.find(c => c.id === v.linked_ref);
        if (directContract) {
            contract = directContract;
        } else {
            const installment = state.installments.find(i => i.id === v.linked_ref);
            if (installment) {
                contract = state.contracts.find(c => c.unitId === installment.unitId);
            }
        }

        if (!contract) return;

        const unitPartners = state.unitPartners.filter(up => up.unitId === contract.unitId);
        if (unitPartners.length === 0) return;

        const partnerLink = unitPartners.find(up => up.partnerId === partnerId);
        if (partnerLink) {
            const share = partnerLink.percent / 100;
            if (v.type === 'receipt') {
                const income = v.amount * share;
                transactions.push({ date: v.date, description: v.description, income: income, expense: 0 });
                totalIncome += income;
            } else if (v.description.includes('عمولة سمسار')) { // Commission expense
                const expense = v.amount * share;
                transactions.push({ date: v.date, description: v.description, income: 0, expense: expense });
                totalExpense += expense;
            }
        }
    });

    // Process inter-partner debts
    state.partnerDebts.forEach(d => {
        if (d.status !== 'مدفوع') return;
        if (d.owedPartnerId === partnerId) {
            transactions.push({ date: d.paymentDate, description: `تحصيل دين من ${partnerById(d.payingPartnerId)?.name || 'شريك'}`, income: d.amount, expense: 0 });
            totalIncome += d.amount;
        }
        if (d.payingPartnerId === partnerId) {
            transactions.push({ date: d.paymentDate, description: `سداد دين إلى ${partnerById(d.owedPartnerId)?.name || 'شريك'}`, income: 0, expense: d.amount });
            totalExpense += d.amount;
        }
    });

    transactions.sort((a,b) => (a.date||'').localeCompare(b.date||''));

    return {
        transactions,
        totalIncome,
        totalExpense,
        netPosition: totalIncome - totalExpense
    };
}

function calculateKpis(filter = {}) {
  const { from, to } = filter;
  let contracts = state.contracts;
  let payments = state.payments;

  if (from) {
    contracts = contracts.filter(c => c.start >= from);
    payments = payments.filter(p => p.date >= from);
  }
  if (to) {
    contracts = contracts.filter(c => c.start <= to);
    payments = payments.filter(p => p.date <= to);
  }

  const totalSales = contracts.reduce((sum, c) => sum + Number(c.totalPrice || 0), 0);
  const downPayments = contracts.reduce((sum, c) => sum + Number(c.downPayment || 0), 0);
  const otherPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalReceipts = downPayments + otherPayments;

  const totalDebt = state.units.reduce((sum, u) => sum + calcRemaining(u), 0);

  const collectionPercentage = totalSales > 0 ? (totalReceipts / totalSales) * 100 : 0;

  const totalExpenses = contracts.reduce((sum, c) => sum + Number(c.brokerAmount || 0), 0);

  const netProfit = totalReceipts - totalExpenses;

  const unitCounts = {
    total: state.units.length,
    available: state.units.filter(u=>u.status==='متاحة').length,
    sold: state.units.filter(u=>u.status==='مباعة').length,
    reserved: state.units.filter(u=>u.status==='محجوزة').length,
  };

  const investorCount = state.partners.length;

  return {
    totalSales, totalReceipts, totalDebt, collectionPercentage,
    totalExpenses, netProfit, unitCounts, investorCount
  };
}

/* ===== لوحة التحكم الجديدة ===== */
function exportDashboardExcel() {
    const fromDate = document.getElementById('dash-from')?.value;
    const toDate = document.getElementById('dash-to')?.value;

    const kpis = calculateKpis({ from: fromDate, to: toDate });
    const kpiData = [
        ['المؤشر', 'القيمة'],
        ['إجمالي المبيعات', kpis.totalSales],
        ['إجمالي المتحصلات', kpis.totalReceipts],
        ['إجمالي المديونية', kpis.totalDebt],
        ['إجمالي المصروفات', kpis.totalExpenses],
    ];

    let upcomingInstallments = state.installments.filter(i => i.status !== 'مدفوع').sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    if (fromDate) upcomingInstallments = upcomingInstallments.filter(i => i.dueDate >= fromDate);
    if (toDate) upcomingInstallments = upcomingInstallments.filter(i => i.dueDate <= toDate);
    const installmentData = upcomingInstallments.map(i => ({
        'الوحدة': getUnitDisplayName(unitById(i.unitId)),
        'العميل': (custById(state.contracts.find(c => c.unitId === i.unitId)?.customerId) || {}).name,
        'المبلغ': i.amount,
        'تاريخ الاستحقاق': i.dueDate
    }));

    let transactions = [];
    state.vouchers.forEach(v => {
        if ((!fromDate || v.date >= fromDate) && (!toDate || v.date <= toDate)) {
            transactions.push({
                'التاريخ': v.date,
                'النوع': v.type === 'receipt' ? 'قبض' : 'صرف',
                'المبلغ': v.amount,
                'البيان': v.description
            });
        }
    });

    const wb = XLSX.utils.book_new();
    const wsKpis = XLSX.utils.aoa_to_sheet(kpiData);
    const wsInstallments = XLSX.utils.json_to_sheet(installmentData);
    const wsTransactions = XLSX.utils.json_to_sheet(transactions.sort((a, b) => (b.Date || '').localeCompare(a.Date || '')));

    XLSX.utils.book_append_sheet(wb, wsKpis, "المؤشرات الرئيسية");
    XLSX.utils.book_append_sheet(wb, wsInstallments, "الأقساط القادمة");
    XLSX.utils.book_append_sheet(wb, wsTransactions, "أحدث الحركات");

    XLSX.writeFile(wb, `dashboard_export_${today()}.xlsx`);
}

function renderDash() {
  const fromDate = document.getElementById('dash-from')?.value;
  const toDate = document.getElementById('dash-to')?.value;

  const kpis = calculateKpis({ from: fromDate, to: toDate });
  const kpiHTML = `
    <div class="card"><h4>إجمالي المبيعات</h4><div class="big">${egp(kpis.totalSales)}</div></div>
    <div class="card"><h4>إجمالي المتحصلات</h4><div class="big">${egp(kpis.totalReceipts)}</div></div>
    <div class="card"><h4>إجمالي المديونية</h4><div class="big">${egp(kpis.totalDebt)}</div></div>
    <div class="card"><h4>إجمالي المصروفات</h4><div class="big">${egp(kpis.totalExpenses)}</div></div>
  `;

  const filterHTML = `
    <div class="panel" style="margin-bottom: 16px;">
        <div class="tools" style="justify-content: space-between; flex-wrap: wrap;">
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <label>من:</label>
                <input type="date" class="input" id="dash-from" value="${fromDate || ''}">
                <label>إلى:</label>
                <input type="date" class="input" id="dash-to" value="${toDate || ''}">
                <button class="btn" id="dash-apply-filter">تطبيق</button>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn secondary" onclick="printHTML('لوحة التحكم', document.getElementById('view').innerHTML)">طباعة PDF</button>
                <button class="btn secondary" onclick="exportDashboardExcel()">تصدير Excel</button>
            </div>
        </div>
    </div>
  `;

  view.innerHTML = filterHTML + `
    <div id="kpi-container-new" class="grid grid-4 panel">
      ${kpiHTML}
    </div>

    <div class="grid grid-3" style="margin-top:16px; gap:16px; align-items:flex-start;">
      <div class="panel" style="grid-column: span 2;">
        <h3>الأقساط القادمة والمتأخرة</h3>
        <div id="upcoming-installments-table">
          <p style="color:var(--muted); font-size:12px;">سيتم عرض الأقساط هنا...</p>
        </div>
      </div>
      <div class="panel">
        <h3>حالة الوحدات</h3>
        <div class="chart-container" style="position: relative; height:200px; width:100%">
          <canvas id="new-units-chart"></canvas>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:16px;">
      <h3>أحدث الحركات المالية</h3>
      <div id="recent-transactions-table">
        <p style="color:var(--muted); font-size:12px;">سيتم عرض أحدث الحركات هنا...</p>
      </div>
    </div>
  `;

  // Render Unit Status Chart
  try {
    new Chart(document.getElementById('new-units-chart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['متاحة', 'مباعة', 'محجوزة'],
        datasets: [{
          data: [kpis.unitCounts.available, kpis.unitCounts.sold, kpis.unitCounts.reserved],
          backgroundColor: ['#2563eb', '#16a34a', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: {font: { family: 'system-ui' }} } }
      }
    });
  } catch(e) {
    console.error("Failed to render unit status chart:", e);
    document.getElementById('new-units-chart').parentElement.innerHTML = '<p style="color:var(--warn)">فشل تحميل الرسم البياني.</p>';
  }

  document.getElementById('dash-apply-filter').onclick = () => nav('dash');

  // Render Upcoming Installments Table
  try {
    let upcomingInstallments = state.installments
      .filter(i => i.status !== 'مدفوع')
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    if (fromDate) upcomingInstallments = upcomingInstallments.filter(i => i.dueDate >= fromDate);
    if (toDate) upcomingInstallments = upcomingInstallments.filter(i => i.dueDate <= toDate);

    upcomingInstallments = upcomingInstallments.slice(0, 5);

    const headers = ['الوحدة', 'العميل', 'المبلغ', 'تاريخ الاستحقاق'];
    const rows = upcomingInstallments.map(i => {
      const contract = state.contracts.find(c => c.unitId === i.unitId);
      const customer = contract ? custById(contract.customerId) : null;
      return [
        getUnitDisplayName(unitById(i.unitId)),
        customer ? customer.name : '—',
        egp(i.amount),
        i.dueDate
      ];
    });

    document.getElementById('upcoming-installments-table').innerHTML = table(headers, rows);
  } catch(e) {
    console.error("Failed to render upcoming installments table:", e);
    document.getElementById('upcoming-installments-table').innerHTML = '<p style="color:var(--warn)">فشل تحميل جدول الأقساط.</p>';
  }

  // Render Recent Transactions Table
  try {
    let transactions = [];
    state.vouchers.forEach(v => {
        if ((!fromDate || v.date >= fromDate) && (!toDate || v.date <= toDate)) {
            transactions.push({
                date: v.date,
                type: v.type, // 'receipt' or 'payment'
                amount: v.amount,
                description: v.description
            });
        }
    });
    const recentTransactions = transactions.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);

    const headers = ['التاريخ', 'البيان', 'المبلغ'];
    const rows = recentTransactions.map(t => {
      const amountStyle = t.type === 'receipt' ? 'color:var(--ok)' : 'color:var(--warn)';
      const amountPrefix = t.type === 'receipt' ? '+' : '-';
      return [
        t.date,
        t.description,
        `<span style="${amountStyle}; font-weight:bold;">${amountPrefix} ${egp(t.amount)}</span>`
      ];
    });

    document.getElementById('recent-transactions-table').innerHTML = table(headers, rows);
  } catch(e) {
    console.error("Failed to render recent transactions table:", e);
    document.getElementById('recent-transactions-table').innerHTML = '<p style="color:var(--warn)">فشل تحميل جدول الحركات المالية.</p>';
  }
}

/* ===== لوحة التحكم القديمة ===== */
function renderOldDash(){
  const total=state.units.length, avail=state.units.filter(u=>u.status==='متاحة').length, sold=state.units.filter(u=>u.status==='مباعة').length, ret=state.units.filter(u=>u.status==='مرتجعة').length;
  const revenue=state.payments.reduce((s,p)=>s+Number(p.amount||0),0);
  const now=new Date(); const proj={};
  state.installments.filter(i=>i.status!=='مدفوع' && i.dueDate && new Date(i.dueDate)>=now).forEach(i=>{ const ym=i.dueDate.slice(0,7); proj[ym]=(proj[ym]||0)+Number(i.amount||0); });
  const projRows=Object.keys(proj).sort().slice(0,6).map(k=>[k, proj[k]]);

  view.innerHTML=`
    <div class="grid grid-3">
        <div class="card">
            <h3>نظرة عامة على الوحدات</h3>
            <div class="chart-container" style="position: relative; height:160px; width:100%">
              <canvas id="unitsChart"></canvas>
            </div>
        </div>
        <div class="card"><h3>إجمالي الوحدات</h3><div class="big">${total}</div></div>
        <div class="card"><h3>إجمالي المتحصلات</h3><div class="big">${egp(revenue)}</div></div>
    </div>
    <div class="card" style="margin-top:10px">
      <h3>التدفقات النقدية المتوقعة (6 أشهر)</h3>
       <div class="chart-container" style="position: relative; height:160px; width:100%">
          <canvas id="cashflowChart"></canvas>
      </div>
      <div class="tools"><button class="btn" onclick="printProjection()">طباعة PDF</button></div>
    </div>`;

  // Units Doughnut Chart
  new Chart(document.getElementById('unitsChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['متاحة', 'مباعة', 'مرتجعة'],
      datasets: [{
        data: [avail, sold, ret],
        backgroundColor: ['#2563eb', '#16a34a', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: {font: { family: 'system-ui' }} } }
    }
  });

  // Cashflow Bar Chart
  new Chart(document.getElementById('cashflowChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: projRows.map(r => r[0]),
      datasets: [{
        label: 'التدفق المتوقع',
        data: projRows.map(r => r[1]),
        backgroundColor: '#2563eb',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: value => egp(value).replace('ج.م', '') } },
        x: { ticks: {font: { family: 'system-ui' }} }
      }
    }
  });
}
window.printProjection=()=>{
  const now=new Date(); const proj={};
  state.installments.filter(i=>i.status!=='مدفوع' && i.dueDate && new Date(i.dueDate)>=now).forEach(i=>{ const ym=i.dueDate.slice(0,7); proj[ym]=(proj[ym]||0)+Number(i.amount||0); });
  const rows=Object.keys(proj).sort().slice(0,12).map(k=>`<tr><td>${k}</td><td>${egp(proj[k])}</td></tr>`).join('');
  printHTML('تدفقات نقدية (12 شهر)', `<h1>تدفقات نقدية (12 شهر)</h1><table><thead><tr><th>الشهر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>`);
};

/* ===== العملاء ===== */
function renderCustomers(){
  let sort={idx:0,dir:'asc'};
  function draw(){
    const q=(document.getElementById('c-q')?.value || '').trim().toLowerCase();
    let list=state.customers.slice();
    if(q) {
      list=list.filter(c=> {
        const searchable = `${c.name||''} ${c.phone||''} ${c.nationalId||''} ${c.address||''} ${c.status||''}`.toLowerCase();
        return searchable.includes(q);
      });
    }
    list.sort((a,b)=>{
      const colsA=[a.name||'', a.phone||'', a.nationalId||'', a.address||'', a.status||''];
      const colsB=[b.name||'', b.phone||'', b.nationalId||'', b.address||'', b.status||''];
      return (colsA[sort.idx]+'').localeCompare(colsB[sort.idx]+'')*(sort.dir==='asc'?1:-1);
    });
    const rows=list.map(c=>[
      `<span contenteditable="true" onblur="inlineUpd('customers','${c.id}','name',this.textContent)">${c.name||''}</span>`,
      `<span contenteditable="true" onblur="inlineUpd('customers','${c.id}','phone',this.textContent)">${c.phone||''}</span>`,
      `<span contenteditable="true" onblur="inlineUpd('customers','${c.id}','nationalId',this.textContent)">${c.nationalId||''}</span>`,
      `<span contenteditable="true" onblur="inlineUpd('customers','${c.id}','address',this.textContent)">${c.address||''}</span>`,
      `<span contenteditable="true" onblur="inlineUpd('customers','${c.id}','status',this.textContent)">${c.status||'نشط'}</span>`,
      `<span contenteditable="true" onblur="inlineUpd('customers','${c.id}','notes',this.textContent)">${c.notes||''}</span>`,
      `<button class="btn secondary" onclick="delRow('customers','${c.id}')">حذف</button>`
    ]);
    document.getElementById('c-list').innerHTML=table(['الاسم','الهاتف','الرقم القومي','العنوان','الحالة','ملاحظات',''], rows, sort, ns=>{sort=ns;draw();});
  }

  view.innerHTML=`
  <div class="grid grid-2">
    <div class="card">
      <h3>إضافة عميل</h3>
      <div class="grid grid-2" style="gap: 10px;">
        <input class="input" id="c-name" placeholder="اسم العميل">
        <input class="input" id="c-phone" placeholder="الهاتف">
        <input class="input" id="c-nationalId" placeholder="الرقم القومي">
        <input class="input" id="c-address" placeholder="العنوان">
      </div>
      <select class="select" id="c-status" style="margin-top:10px;"><option value="نشط">نشط</option><option value="موقوف">موقوف</option></select>
      <textarea class="input" id="c-notes" placeholder="ملاحظات" style="margin-top:10px;" rows="2"></textarea>
      <button class="btn" style="margin-top:10px;" onclick="addCustomer()">حفظ</button>
    </div>
    <div class="card">
      <h3>العملاء</h3>
      <div class="tools">
        <input class="input" id="c-q" placeholder="بحث..." oninput="draw()">
        <button class="btn secondary" onclick="expCustomers()">CSV</button>
        <label class="btn secondary"><input type="file" id="c-imp" accept=".csv" style="display:none">استيراد CSV</label>
        <button class="btn" onclick="printCustomers()">طباعة PDF</button>
      </div>
      <div id="c-list"></div>
    </div>
  </div>`;

  window.addCustomer=()=>{
    const name = document.getElementById('c-name').value.trim();
    const phone = document.getElementById('c-phone').value.trim();
    const nationalId = document.getElementById('c-nationalId').value.trim();
    const address = document.getElementById('c-address').value.trim();
    const status = document.getElementById('c-status').value;
    const notes = document.getElementById('c-notes').value.trim();

    if(!name || !phone) return alert('الرجاء إدخال الاسم ورقم الهاتف على الأقل.');
    if(state.customers.some(c => c.name.toLowerCase() === name.toLowerCase() && c.phone === phone)) {
      return alert('هذا العميل (نفس الاسم ورقم الهاتف) موجود بالفعل.');
    }

    saveState();
    const newCustomer = { id: uid('C'), name, phone, nationalId, address, status, notes };
    logAction('إضافة عميل جديد', { id: newCustomer.id, name: newCustomer.name });
    state.customers.push(newCustomer);
    persist();

    // Reset form
    document.getElementById('c-name').value = '';
    document.getElementById('c-phone').value = '';
    document.getElementById('c-nationalId').value = '';
    document.getElementById('c-address').value = '';
    document.getElementById('c-notes').value = '';

    draw();
  };

  window.expCustomers=()=>{
    const headers = ['الاسم','الهاتف','الرقم القومي','العنوان','الحالة','ملاحظات'];
    const rows = state.customers.map(c=>[c.name||'', c.phone||'', c.nationalId||'', c.address||'', c.status||'', c.notes||'']);
    exportCSV(headers, rows, 'customers.csv');
  };

  document.getElementById('c-imp').onchange=(e)=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      saveState();
      const lines=String(r.result).split(/\r?\n/).slice(1);
      lines.forEach(line=>{
        const [name,phone,nationalId,address,status,notes]=line.split(',').map(x=>x?.replace(/^"|"$/g,'')||'');
        if(name) state.customers.push({id:uid('C'),name,phone,nationalId,address,status,notes});
      });
      persist(); draw();
    };
    r.readAsText(f,'utf-8');
  };

  window.printCustomers=()=>{
    const headers = ['الاسم','الهاتف','الرقم القومي','العنوان','الحالة'];
    const rows=state.customers.map(c=>`<tr><td>${c.name||''}</td><td>${c.phone||''}</td><td>${c.nationalId||''}</td><td>${c.address||''}</td><td>${c.status||''}</td></tr>`).join('');
    printHTML('تقرير العملاء', `<h1>تقرير العملاء</h1><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`);
  };

  draw();
}
window.inlineUpd=(coll,id,key,val)=>{
  saveState();
  const o=state[coll].find(x=>x.id===id);
  if(o){
    const oldValue = o[key];
    o[key]=val;
    logAction(`تعديل مباشر في ${coll}`, { collection: coll, id, key, oldValue, newValue: val });
    persist();
  }
};
window.delRow=(coll,id)=>{
  const nameMap = {
    customers: 'العميل',
    units: 'الوحدة',
    partners: 'الشريك',
    unitPartners: 'ربط شريك بوحدة',
    contracts: 'العقد',
    installments: 'القسط',
    safes: 'الخزنة'
  };
  const collName = nameMap[coll] || coll;
  const itemToDelete = state[coll] ? state[coll].find(x=>x.id===id) : undefined;
  const itemName = itemToDelete?.name || itemToDelete?.code || id;

  if(confirm(`هل أنت متأكد من حذف ${collName} "${itemName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)){
    saveState();
    logAction(`حذف ${collName}`, { collection: coll, id, deletedItem: JSON.stringify(itemToDelete) });
    state[coll]=state[coll].filter(x=>x.id!==id);
    persist();
    if (coll === 'unitPartners') {
      renderUnitDetails(itemToDelete.unitId);
    } else {
      nav(coll);
    }
  }
};

function deleteUnit(unitId) {
  const isLinked = state.contracts.some(c => c.unitId === unitId);
  if (isLinked) {
    alert('لا يمكن حذف هذه الوحدة لأنها مرتبطة بعقد قائم. يجب حذف العقد أولاً.');
    return;
  }
  delRow('units', unitId);
}

/* ===== الوحدات ===== */
function calcRemaining(u){
  const ct = state.contracts.find(c => c.unitId === u.id);
  if (!ct) {
    return 0; // No contract, so nothing is remaining
  }

  const totalPrice = Number(ct.totalPrice || 0);
  const discount = Number(ct.discountAmount || 0);
  const maintenance = Number(ct.maintenanceAmount || 0);

  const totalOwed = (totalPrice - discount) + maintenance;

  // The down payment is made at contract signing and is not part of the payments array.
  // All other payments are in the payments array.
  const downPayment = Number(ct.downPayment || 0);
  const otherPayments = state.payments
      .filter(p => p.unitId === u.id)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalPaid = downPayment + otherPayments;

  const remaining = totalOwed - totalPaid;

  return Math.max(0, remaining);
}
function renderUnits(){
  let sort={idx:0,dir:'asc'};
  function draw(){
    const q=(document.getElementById('u-q')?.value || '').trim().toLowerCase();
    let list=state.units.slice();
    if(q) {
      list=list.filter(u=> {
        const searchable = `${u.code||''} ${u.name||''} ${u.floor||''} ${u.building||''} ${u.status||''} ${u.area||''} ${u.type||''}`.toLowerCase();
        return searchable.includes(q);
      });
    }
    list.sort((a,b)=>{
      const colsA=[a.code||'', a.name||'', String(a.totalPrice || 0), a.area||'', a.floor||'', a.building||'', a.status||'', a.type||''];
      const colsB=[b.code||'', b.name||'', String(b.totalPrice || 0), b.area||'', b.floor||'', b.building||'', b.status||'', b.type||''];
      return (colsA[sort.idx]+'').localeCompare(colsB[sort.idx]+'')*(sort.dir==='asc'?1:-1);
    });
    const rows=list.map(u=> {
      let actions = `<button class="btn" onclick="nav('unit-details', '${u.id}')">إدارة</button>`;
      if (u.status === 'مباعة') {
        actions += ` <button class="btn gold" style="margin-right: 5px;" onclick="startReturnProcess('${u.id}')">إرجاع وشراء</button>`;
      }
      return [
        `<span contenteditable="true" onblur="inlineUpd('units','${u.id}','code',this.textContent)">${u.code||''}</span>`,
        `<span contenteditable="true" onblur="inlineUpd('units','${u.id}','name',this.textContent)">${u.name||''}</span>`,
        `<span contenteditable="true" onblur="numEdit('units','${u.id}','totalPrice', this)">${egp(u.totalPrice)}</span>`,
        `<span contenteditable="true" onblur="inlineUpd('units','${u.id}','type',this.textContent)">${u.type||'سكني'}</span>`,
        `<span contenteditable="true" onblur="inlineUpd('units','${u.id}','area',this.textContent)">${u.area||''}</span>`,
        `<span contenteditable="true" onblur="inlineUpd('units','${u.id}','floor',this.textContent)">${u.floor||''}</span>`,
        `<span contenteditable="true" onblur="inlineUpd('units','${u.id}','building',this.textContent)">${u.building||''}</span>`,
        `<span>${egp(calcRemaining(u))}</span>`,
        `<span contenteditable="true" onblur="inlineUpd('units','${u.id}','status',this.textContent)">${u.status||'متاحة'}</span>`,
        `<span contenteditable="true" onblur="inlineUpd('units','${u.id}','notes',this.textContent)">${u.notes||''}</span>`,
        `<div class="tools" style="gap:5px; flex-wrap:nowrap;">${actions}</div>`,
        `<button class="btn secondary" onclick="deleteUnit('${u.id}')">حذف</button>`
      ];
    });
    document.getElementById('u-list').innerHTML=
      table(['الكود','اسم الوحدة','السعر','النوع','المساحة','الدور','البرج','المتبقي','الحالة','ملاحظات','إجراءات',''], rows, sort, ns=>{sort=ns;draw();});
  }

  view.innerHTML=`
  <div class="grid">
    <div class="card">
      <h3>إضافة وحدة</h3>
      <div class="grid grid-4">
        <input class="input" id="u-code" placeholder="كود/اسم مختصر">
        <input class="input" id="u-name" placeholder="اسم الوحدة">
        <input class="input" id="u-total-price" placeholder="السعر الكلي" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
        <select class="select" id="u-type"><option value="سكني">سكني</option><option value="تجاري">تجاري</option></select>
        <input class="input" id="u-area" placeholder="المساحة (م²)">
        <input class="input" id="u-floor" placeholder="رقم الدور">
        <input class="input" id="u-building" placeholder="البرج/العمارة">
        <select class="select" id="u-status"><option value="متاحة">متاحة</option><option value="محجوزة">محجوزة</option><option value="مباعة">مباعة</option><option value="مرتجعة">مرتجعة</option></select>
      </div>
      <textarea class="input" id="u-notes" placeholder="ملاحظات" style="margin-top:10px;" rows="2"></textarea>
      <button class="btn" style="margin-top:10px;" onclick="addUnit()">حفظ</button>
    </div>
    <div class="card">
      <h3>قائمة الوحدات</h3>
      <div class="tools">
        <input class="input" id="u-q" placeholder="بحث..." oninput="draw()">
        <button class="btn secondary" onclick="expUnits()">CSV</button>
        <label class="btn secondary"><input type="file" id="u-imp" style="display:none" accept=".csv">استيراد CSV</label>
        <button class="btn" onclick="printUnits()">طباعة PDF</button>
      </div>
      <div id="u-list"></div>
    </div>
  </div>`;

  window.addUnit=()=>{
    let code=document.getElementById('u-code').value.trim();
    const name=document.getElementById('u-name').value.trim();
    const status=document.getElementById('u-status').value;
    const type=document.getElementById('u-type').value;
    const area=document.getElementById('u-area').value.trim();
    const floor=document.getElementById('u-floor').value.trim();
    const building=document.getElementById('u-building').value.trim();
    const notes=document.getElementById('u-notes').value.trim();
    const totalPrice = parseNumber(document.getElementById('u-total-price').value);

    if (!code) {
        if (!building || !floor || !name) {
            return alert('لإنشاء كود تلقائي، الرجاء إدخال اسم الوحدة ورقم الدور والبرج.');
        }
        const san_b = building.replace(/\s/g, '');
        const san_f = floor.replace(/\s/g, '');
        const san_n = name.replace(/\s/g, '');
        code = `${san_b}-${san_f}-${san_n}`;
    }

    if(!totalPrice) return alert('الرجاء إدخال سعر الوحدة.');

    if (state.units.some(u => u.code.toLowerCase() === code.toLowerCase())) {
        return alert('هذا الكود مستخدم بالفعل. الرجاء إدخال كود فريد.');
    }
    saveState();
    const newUnit = {
      id:uid('U'), code, name, status, type, area, floor, building, notes, totalPrice
    };
    logAction('إضافة وحدة جديدة', { id: newUnit.id, code: newUnit.code });
    state.units.push(newUnit);
    persist();
    draw();
  };

  window.expUnits=()=>{
    const headers=['الكود','اسم الوحدة','السعر','النوع','المساحة','الدور','البرج','الحالة','المتبقي','ملاحظات'];
    const rows=state.units.map(u=> {
      return [u.code,u.name||'',u.totalPrice,u.type||'سكني',u.area||'',u.floor||'',u.building||'',u.status,calcRemaining(u),u.notes||''];
    });
    exportCSV(headers, rows, 'units.csv');
  };

  document.getElementById('u-imp').onchange=(e)=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      saveState();
      const lines=String(r.result).split(/\r?\n/).slice(1);
      lines.forEach(line=>{
        const [code,name,total,type,area,floor,building,status,notes]=line.split(',').map(x=>x?.replace(/^"|"$/g,'')||'');
        if(code) state.units.push({id:uid('U'),code,name,totalPrice:parseNumber(total),type:type||'سكني',status:status||'متاحة',area,floor,building,notes});
      });
      persist(); draw();
    };
    r.readAsText(f,'utf-8');
  };

  window.printUnits=()=>{
    const headers=['الكود','اسم الوحدة','السعر','النوع','المساحة','الدور','البرج','الحالة','المتبقي'];
    const rows=state.units.map(u=>`<tr><td>${u.code}</td><td>${u.name||''}</td><td>${egp(u.totalPrice)}</td><td>${u.type||'سكني'}</td><td>${u.area||''}</td><td>${u.floor||''}</td><td>${u.building||''}</td><td>${u.status}</td><td>${egp(calcRemaining(u))}</td></tr>`).join('');
    printHTML('تقرير الوحدات', `<h1>تقرير الوحدات</h1><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`);
  };
  draw();
}

/* ===== إدارة الخزن ===== */
function renderSafes(){
  function draw(){
    const rows = state.safes.map(s => [
      `<span contenteditable="true" onblur="inlineUpd('safes','${s.id}','name',this.textContent)">${s.name || ''}</span>`,
      `<span>${egp(s.balance || 0)}</span>`,
      `<button class="btn secondary" onclick="delRow('safes','${s.id}')">حذف</button>`
    ]);
    document.getElementById('s-list').innerHTML = table(['اسم الخزنة', 'الرصيد الحالي', ''], rows);
  }

  view.innerHTML = `
  <div class="grid grid-2">
      <div class="card">
          <h3>إضافة خزنة جديدة</h3>
          <input class="input" id="s-name" placeholder="اسم الخزنة (مثلاً: الخزنة الرئيسية، حساب البنك)">
          <input class="input" id="s-balance" placeholder="الرصيد الافتتاحي" type="number" value="0" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
          <button class="btn" style="margin-top:10px;" onclick="addSafe()">إضافة</button>
      </div>
      <div class="card">
          <h3>قائمة الخزن</h3>
          <div id="s-list"></div>
      </div>
  </div>
  `;

  window.addSafe = () => {
      const name = document.getElementById('s-name').value.trim();
      const balance = parseNumber(document.getElementById('s-balance').value);
      if (!name) return alert('الرجاء إدخال اسم الخزنة.');

      if (state.safes.some(s => s.name.toLowerCase() === name.toLowerCase())) {
          return alert('خزنة بنفس الاسم موجودة بالفعل.');
      }

      saveState();
      const newSafe = { id: uid('S'), name, balance };
      logAction('إضافة خزنة جديدة', { safeId: newSafe.id, name, initialBalance: balance });
      state.safes.push(newSafe);
      persist();

      document.getElementById('s-name').value = '';
      document.getElementById('s-balance').value = '0';
      draw();
  };

  draw();
}

window.executeReturn = (unitId, buyingPartnerId) => {
    saveState();
    const u = unitById(unitId);
    const ct = state.contracts.find(c => c.unitId === unitId);
    if (!u || !ct) {
        return alert('خطأ: لم يتم العثور على الوحدة أو العقد.');
    }

    const originalPartners = state.unitPartners.filter(up => up.unitId === unitId);
    const originalInstallments = state.installments.filter(i => i.unitId === unitId);

    // Change unit status
    u.status = 'متاحة';

    // Delete contract and unpaid installments
    state.contracts = state.contracts.filter(c => c.id !== ct.id);
    state.installments = state.installments.filter(i => i.unitId !== unitId || i.status === 'مدفوع');

    const sellingPartners = originalPartners.filter(p => p.partnerId !== buyingPartnerId);
    const scheduleBasis = originalInstallments.sort((a,b) => (a.dueDate||'').localeCompare(b.dueDate||''));
    const numInstallments = scheduleBasis.length;

    if (numInstallments > 0) {
        for (const seller of sellingPartners) {
            const debtOwed = (ct.totalPrice * seller.percent / 100);
            const installmentAmount = Math.round((debtOwed / numInstallments) * 100) / 100;
            let accumulatedAmount = 0;

            for (let i = 0; i < scheduleBasis.length; i++) {
                const inst = scheduleBasis[i];
                let amount = installmentAmount;
                if (i === numInstallments - 1) {
                    amount = Math.round((debtOwed - accumulatedAmount) * 100) / 100;
                }

                const newDebt = {
                    id: uid('PD'),
                    unitId: unitId,
                    payingPartnerId: buyingPartnerId,
                    owedPartnerId: seller.partnerId,
                    amount: amount,
                    dueDate: inst.dueDate,
                    status: 'غير مدفوع'
                };
                state.partnerDebts.push(newDebt);
                accumulatedAmount += amount;
            }
        }
    }

    // Update ownership
    state.unitPartners = state.unitPartners.filter(up => up.unitId !== unitId);
    state.unitPartners.push({ id: uid('UP'), unitId, partnerId: buyingPartnerId, percent: 100 });

    persist();
    alert('تمت عملية الإرجاع وشراء الشريك بنجاح.');
    nav('units');
    return true; // for modal
};

window.startReturnProcess = (unitId) => {
    const u = unitById(unitId);
    const originalPartners = state.unitPartners.filter(up => up.unitId === unitId);

    if (!u || u.status !== 'مباعة') {
        return alert('يمكن تنفيذ هذه العملية على الوحدات المباعة فقط.');
    }
    if (originalPartners.length === 0) {
        return alert('لا يوجد شركاء مرتبطون بهذه الوحدة. لا يمكن إتمام العملية.');
    }

    const partnerOptions = originalPartners.map(up => {
        const p = partnerById(up.partnerId);
        return `<option value="${p.id}">${p.name} (${up.percent}%)</option>`;
    }).join('');

    const content = `
        <p>الرجاء تحديد الشريك الذي سيقوم بشراء الوحدة. سيتم تحويل ملكية الوحدة بالكامل إليه وإنشاء مديونية عليه لصالح الشركاء الآخرين.</p>
        <select class="select" id="buying-partner-select">${partnerOptions}</select>
    `;

    showModal('إرجاع وشراء شريك', content, () => {
        const buyingPartnerId = document.getElementById('buying-partner-select').value;
        if (!buyingPartnerId) {
            alert('الرجاء اختيار شريك.');
            return false;
        }
        return executeReturn(unitId, buyingPartnerId);
    });
};

window.numEdit=(coll,id,key,el)=>{ el.textContent = parseNumber(el.textContent||''); inlineUpd(coll,id,key,Number(el.textContent||0)); };

/* ===== تفاصيل الوحدة وإدارة الشركاء وخطط الأسعار ===== */
function renderUnitDetails(unitId){
  const u = unitById(unitId);
  if(!u) return nav('units');

  function drawPartners(){
    const links = state.unitPartners.filter(up => up.unitId === u.id);
    const rows = links.map(link => {
      const partner = partnerById(link.partnerId);
      return [
        partner ? partner.name : 'شريك محذوف',
        link.percent + ' %',
        `<button class="btn secondary" onclick="removePartnerFromUnit('${link.id}')">حذف</button>`
      ];
    });
    document.getElementById('ud-partners-list').innerHTML = table(['الشريك', 'النسبة', ''], rows);
    const sum = links.reduce((s, p) => s + Number(p.percent || 0), 0);
    const sumEl = document.getElementById('ud-partners-sum');
    sumEl.textContent = sum + ' %';
    sumEl.className = 'badge ' + (sum > 100 ? 'warn' : (sum === 100 ? 'ok' : 'info'));
  }

  view.innerHTML = `
    <div class="card">
        <div class="header" style="justify-content: space-between;">
            <h1>إدارة الوحدة — ${u.code}</h1>
            <button class="btn secondary" onclick="nav('units')">⬅️ العودة للوحدات</button>
        </div>
        <p><b>اسم الوحدة:</b> ${u.name||'—'} | <b>البرج:</b> ${u.building||'—'} | <b>الدور:</b> ${u.floor||'—'}</p>
        <p><b>السعر:</b> ${egp(u.totalPrice)}</p>

        <div class="card" style="margin-top:16px;">
            <h3>الشركاء في هذه الوحدة</h3>
            <div id="ud-partners-list"></div>
            <hr>
            <h4>إضافة شريك جديد</h4>
            <div class="tools">
                <select class="select" id="ud-pr-select" style="flex:1;"><option value="">اختر شريك...</option>${state.partners.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select>
                <input class="input" id="ud-pr-percent" type="number" min="0.1" max="100" step="0.1" placeholder="النسبة %" style="flex:0.5;">
                <button class="btn" onclick="addPartnerToUnit('${u.id}')">إضافة</button>
                <span class="badge" id="ud-partners-sum">0 %</span>
            </div>
        </div>
    </div>
  `;

  window.addPartnerToUnit = (unitId) => {
    const partnerId = document.getElementById('ud-pr-select').value;
    const percent = parseNumber(document.getElementById('ud-pr-percent').value);
    if(!partnerId || !(percent > 0)) return alert('الرجاء اختيار شريك وإدخال نسبة صحيحة.');
    if(state.unitPartners.some(up => up.unitId === unitId && up.partnerId === partnerId)) return alert('هذا الشريك تم إضافته بالفعل لهذه الوحدة.');
    saveState();
    const link = {id: uid('UP'), unitId, partnerId, percent};
    logAction('ربط شريك بوحدة', { unitId, partnerId, percent });
    state.unitPartners.push(link);
    persist();
    drawPartners();
  };

  window.removePartnerFromUnit = (linkId) => {
    delRow('unitPartners', linkId);
  };

  drawPartners();
}

function deleteContract(contractId) {
    const contract = state.contracts.find(c => c.id === contractId);
    if (!contract) {
      alert('لم يتم العثور على العقد.');
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف العقد ${contract.code}؟ سيتم حذف جميع الأقساط والمدفوعات المرتبطة به.`)) return;

    const unitId = contract.unitId;
    saveState();
    logAction('حذف عقد وكل ما يتعلق به', { contractId, unitId, deletedContract: JSON.stringify(contract) });

    // 1. Delete all payments for the unit
    state.payments = state.payments.filter(p => p.unitId !== unitId);

    // 2. Delete all installments for the unit
    state.installments = state.installments.filter(i => i.unitId !== unitId);

    // 3. Delete the contract itself
    state.contracts = state.contracts.filter(c => c.id !== contractId);

    // 4. Update the unit's status
    const unit = unitById(unitId);
    if (unit) {
        unit.status = 'متاحة';
    }

    persist();
    nav('contracts');
}

/* ===== العقود + توليد أقساط ===== */
function editContract(contractId) {
    const contract = state.contracts.find(c => c.id === contractId);
    if (!contract) {
        return alert('لم يتم العثور على العقد.');
    }

    const hasPayments = state.payments.some(p => p.unitId === contract.unitId);
    if (hasPayments) {
        alert('لا يمكن تعديل هذا العقد لأنه توجد مدفوعات مسجلة عليه.');
        return;
    }

    // For now, as a placeholder, we'll just use the delete function's logic
    // A full modal would be more complex. A simple "delete and re-add" flow is safer.
    if (confirm('هل أنت متأكد أنك تريد "تعديل" هذا العقد؟ سيتم حذف العقد الحالي وجميع أقساطه، ويجب عليك إنشاء عقد جديد.')) {
        deleteContract(contractId);
    }
}

function renderContracts(){
  function draw(){
    const q = (document.getElementById('ct-q')?.value || '').trim().toLowerCase();
    let list = state.contracts.slice();
    if (q) {
        list = list.filter(c => {
            const customerName = (custById(c.customerId) || {}).name || '';
            const unitName = getUnitDisplayName(unitById(c.unitId));
            const searchable = `${c.code || ''} ${unitName} ${customerName} ${c.brokerName || ''}`.toLowerCase();
            return searchable.includes(q);
        });
    }

    const rows=list.map(c=>[
        c.code,
        getUnitDisplayName(unitById(c.unitId)),
        (custById(c.customerId)||{}).name||'—',
        c.brokerName ? `<a href="#" onclick="nav('broker-ledger', '${c.brokerName}'); return false;">${c.brokerName}</a>` : '—',
        egp(c.totalPrice),
        c.start,
        `<button class="btn" onclick="openContractDetails('${c.id}')">عرض</button> <button class="btn gold" onclick="editContract('${c.id}')">تعديل</button>`,
        `<button class="btn secondary" onclick="deleteContract('${c.id}')">حذف</button>`
    ]);
    document.getElementById('ct-list').innerHTML=table(['كود العقد','الوحدة','العميل','السمسار','السعر','تاريخ البدء','إجراءات',''], rows);
  }
  view.innerHTML=`
  <div class="grid">
    <div class="card">
      <h3>إضافة عقد</h3>
      <div class="grid grid-4">
        <select class="select" id="ct-unit"><option value="">اختر الوحدة...</option>${state.units.filter(u=>u.status==='متاحة' || u.status ==='محجوزة').map(u=>`<option value="${u.id}">${getUnitDisplayName(u)}</option>`).join('')}</select>
        <select class="select" id="ct-cust"><option value="">اختر العميل...</option>${state.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
        <input class="input" id="ct-total" placeholder="السعر الكلي" readonly style="background:var(--bg);">
        <select class="select" id="ct-payment-type">
            <option value="installment">تقسيط</option>
            <option value="cash">كاش</option>
        </select>
        <div id="ct-down-wrapper">
            <input class="input" id="ct-down" placeholder="المقدم" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
        </div>
        <select class="select" id="ct-main-safe"><option value="">اختر خزنة العقد...</option>${state.safes.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
        <input class="input" id="ct-discount" placeholder="مبلغ الخصم" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
        <input class="input" id="ct-broker-name" placeholder="اسم السمسار">
        <input class="input" id="ct-brokerp" placeholder="نسبة العمولة %" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
        <input class="input" id="ct-start" type="date" value="${today()}">
      </div>
      <div id="installment-options-wrapper">
        <div class="grid grid-4" style="margin-top:10px;">
            <select class="select" id="ct-type" style="grid-column: span 2;"><option>شهري</option><option>ربع سنوي</option><option>نصف سنوي</option><option>سنوي</option></select>
            <input class="input" id="ct-count" placeholder="عدد الدفعات" oninput="this.value=this.value.replace(/[^\\d]/g,'')">
            <input class="input" id="ct-annual-bonus" placeholder="دفعات سنوية إضافية (0-3)" oninput="this.value=this.value.replace(/[^\\d]/g,'')">
        </div>
        <div style="color:var(--muted); font-size:12px; margin-top:4px; padding-right: 5px;">
            إجمالي عدد الأقساط: <span id="ct-total-installments" style="font-weight:bold;">0</span>
        </div>
      </div>
      <div class="tools">
        <button class="btn" onclick="createContract()">حفظ + توليد أقساط</button>
      </div>
    </div>
    <div class="card">
      <h3>العقود</h3>
      <div class="tools">
        <input class="input" id="ct-q" placeholder="بحث بالكود, الوحدة, العميل..." oninput="draw()">
        <button class="btn secondary" onclick="expContracts()">تصدير CSV</button>
        <button class="btn secondary" onclick="printContracts()">طباعة PDF</button>
      </div>
      <div id="ct-list"></div>
    </div>
  </div>`;

  window.createContract=()=>{
    const paymentType = document.getElementById('ct-payment-type').value;
    const total = parseNumber(document.getElementById('ct-total').value);
    let down = (paymentType === 'cash') ? total : parseNumber(document.getElementById('ct-down').value);
    const discount = parseNumber(document.getElementById('ct-discount').value);
    const brokerName = document.getElementById('ct-broker-name').value.trim();
    const brokerP = parseNumber(document.getElementById('ct-brokerp').value);
    const brokerAmt = Math.round((total * brokerP / 100) * 100) / 100;
    const mainSafeId = document.getElementById('ct-main-safe').value;
    const downPaymentSafeId = mainSafeId;

    if (down > 0 && !mainSafeId) return alert('الرجاء تحديد خزنة العقد لدفع المقدم.');

    saveState();
    const unitId=document.getElementById('ct-unit').value, customerId=document.getElementById('ct-cust').value;
    if(!unitId||!customerId) return alert('الرجاء اختيار الوحدة والعميل.');

    const unitPartners = state.unitPartners.filter(up => up.unitId === unitId);
    const totalPercent = unitPartners.reduce((sum, p) => sum + Number(p.percent), 0);

    if (unitPartners.length === 0) return alert('لا يمكن إنشاء عقد. يجب تحديد شركاء لهذه الوحدة أولاً.');
    if (totalPercent !== 100) return alert(`لا يمكن إنشاء عقد. مجموع نسب الشركاء هو ${totalPercent}% ويجب أن يكون 100% بالضبط.`);

    const type=document.getElementById('ct-type').value, count=parseInt(document.getElementById('ct-count').value||'0',10);
    const extra=parseInt(document.getElementById('ct-annual-bonus').value||'0',10);
    const startStr=document.getElementById('ct-start').value||today(); const start=new Date(startStr);

    if(paymentType === 'installment' && count <= 0) return alert('عدد الدفعات غير صالح');

    // Create contract object first
    const code='CTR-'+String(state.contracts.length+1).padStart(5,'0');
    const ct={id:uid('CT'), code, unitId, customerId, totalPrice:total, downPayment:down, discountAmount: discount, brokerName, brokerPercent:brokerP, brokerAmount:brokerAmt, commissionSafeId, type, count, extraAnnual:Math.min(Math.max(extra,0),3), start:startStr};
    state.contracts.push(ct);
    logAction('إنشاء عقد جديد', { contractId: ct.id, unitId, customerId, price: total });

    // Handle financials and vouchers
    const customer = custById(customerId);
    if (down > 0) {
        const downPaymentSafe = state.safes.find(s => s.id === downPaymentSafeId);
        downPaymentSafe.balance += down;
        state.vouchers.push({id:uid('V'), type:'receipt', date:startStr, amount:down, safeId:downPaymentSafeId, description:`مقدم عقد للوحدة ${getUnitDisplayName(unitById(unitId))}`, payer:customer?.name, linked_ref:ct.id});
        logAction('إنشاء سند قبض للمقدم', { contractId: ct.id, amount: down, safeId: downPaymentSafeId });
    }
    if (brokerAmt > 0) {
        const newBrokerDue = {
            id: uid('BD'),
            contractId: ct.id,
            brokerName: brokerName || 'سمسار غير محدد',
            amount: brokerAmt,
            dueDate: startStr,
            status: 'due',
            paymentDate: null,
            paidFromSafeId: null
        };
        state.brokerDues.push(newBrokerDue);
        logAction('إنشاء عمولة مستحقة للسمسار', { brokerDueId: newBrokerDue.id, contractId: ct.id, amount: brokerAmt });
    }

    // Generate installments
    if (paymentType === 'installment') {
        const months={'شهري':1,'ربع سنوي':3,'نصف سنوي':6,'سنوي':12}[type]||1;
        const remain=Math.max(0, (total - discount - down));
        const parts=count + ct.extraAnnual;
        const base=Math.floor((remain/parts)*100)/100; let acc=0;
        for(let i=0;i<count;i++){
          const d=new Date(start); d.setMonth(d.getMonth()+months*(i+1));
          const amt=(i===count-1 && ct.extraAnnual===0)? Math.round((remain-acc)*100)/100 : base; acc+=amt;
          state.installments.push({id:uid('I'),unitId,type,amount:amt,originalAmount:amt,dueDate:d.toISOString().slice(0,10),paymentDate:null,status:'غير مدفوع'});
        }
        for(let j=0;j<ct.extraAnnual;j++){
          const d=new Date(start); d.setMonth(d.getMonth()+12*(j+1));
          const amt=(j===ct.extraAnnual-1)? Math.round((remain-acc)*100)/100 : base; acc+=amt;
          state.installments.push({id:uid('I'),unitId,type:'سَنوي إضافي',amount:amt,originalAmount:amt,dueDate:d.toISOString().slice(0,10),paymentDate:null,status:'غير مدفوع'});
        }
    }

    const u=unitById(unitId); if(u) u.status='مباعة';
    persist();
    draw();
    printContract(ct);
  };

  window.expContracts = () => {
    const headers = ['كود العقد','الوحدة','العميل','السعر','المقدم','الخصم','اسم السمسار','نسبة العمولة','مبلغ العمولة'];
    const rows = state.contracts.map(c => [
        c.code,
        getUnitDisplayName(unitById(c.unitId)),
        (custById(c.customerId) || {}).name || '',
        c.totalPrice,
        c.downPayment,
        c.discountAmount || 0,
        c.brokerName || '',
        c.brokerPercent || 0,
        c.brokerAmount || 0
    ]);
    exportCSV(headers, rows, 'contracts.csv');
  };

  window.printContracts=()=>{
    const headers = ['الكود','الوحدة','العميل','السعر','المقدم','عمولة','نوع','عدد','بداية'];
    const rows=state.contracts.map(c=>`<tr><td>${c.code||''}</td><td>${getUnitDisplayName(unitById(c.unitId))}</td><td>${(custById(c.customerId)||{}).name||'—'}</td><td>${egp(c.totalPrice)}</td><td>${egp(c.downPayment)}</td><td>${egp(c.brokerAmount||0)} (${c.brokerPercent||0}%)</td><td>${c.type}</td><td>${c.count}</td><td>${c.start}</td></tr>`).join('');
    printHTML('تقرير العقود', `<h1>تقرير العقود</h1><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`);
  };

  window.printContract=(ct)=>{
    const brokerInfo = ct.brokerAmount > 0 ? `<tr><th>عمولة السمسار</th><td>${egp(ct.brokerAmount)} (${ct.brokerPercent}%) - ${ct.brokerName||'غير محدد'}</td></tr>` : '';
    const html=`<h1>عقد بيع — ${ct.code}</h1>
      <p>الوحدة: ${getUnitDisplayName(unitById(ct.unitId))} — العميل: ${(custById(ct.customerId)||{}).name||'—'}</p>
      <table>
        <tr><th>السعر الكلي</th><td>${egp(ct.totalPrice)}</td></tr>
        <tr><th>الخصم</th><td style="color:var(--ok);">${egp(ct.discountAmount||0)}</td></tr>
        <tr><th>المقدم</th><td>${egp(ct.downPayment)}</td></tr>
        ${brokerInfo}
        <tr><th>نظام الأقساط</th><td>${ct.type} × ${ct.count} + سنوية إضافية: ${ct.extraAnnual}</td></tr>
        <tr><th>بداية العقد</th><td>${ct.start}</td></tr>
      </table>`;
    printHTML('عقد بيع', html);
  };

  const unitSelect = document.getElementById('ct-unit');
  const totalInput = document.getElementById('ct-total');
  const paymentTypeSelect = document.getElementById('ct-payment-type');
  const downPaymentWrapper = document.getElementById('ct-down-wrapper');
  const installmentOptionsWrapper = document.getElementById('installment-options-wrapper');

  function updateFormForPaymentType() {
      const paymentType = paymentTypeSelect.value;
      if (paymentType === 'cash') {
          installmentOptionsWrapper.style.display = 'none';
          downPaymentWrapper.style.display = 'none';
      } else { // 'installment'
          installmentOptionsWrapper.style.display = 'block';
          downPaymentWrapper.style.display = 'block';
      }
      updateTotalInstallments();
  }

  function updateFormForUnit() {
      const unitId = unitSelect.value;
      const unit = unitById(unitId);
      totalInput.value = unit ? unit.totalPrice : '';
      updateFormForPaymentType();
  }

  function updateTotalInstallments() {
    const countInput = document.getElementById('ct-count');
    const extraInput = document.getElementById('ct-annual-bonus');
    const totalDisplay = document.getElementById('ct-total-installments');
    if (!countInput || !extraInput || !totalDisplay) return;

    const count = parseInt(countInput.value || '0', 10);
    const extra = parseInt(extraInput.value || '0', 10);
    totalDisplay.textContent = count + extra;
  }

  unitSelect.onchange = updateFormForUnit;
  paymentTypeSelect.onchange = updateFormForPaymentType;
  document.getElementById('ct-count').oninput = updateTotalInstallments;
  document.getElementById('ct-annual-bonus').oninput = updateTotalInstallments;

  draw();
  updateFormForUnit();
  updateTotalInstallments();
  updateFormForPaymentType();
}

function renderBrokerLedger(brokerName) {
    if (!brokerName) {
        return nav('contracts');
    }

    const brokerContracts = state.contracts.filter(c => c.brokerName === brokerName && c.brokerAmount > 0);

    const rows = brokerContracts.map(c => [
        c.start,
        c.code,
        getUnitDisplayName(unitById(c.unitId)),
        egp(c.brokerAmount)
    ]);

    const totalCommission = brokerContracts.reduce((sum, c) => sum + c.brokerAmount, 0);

    view.innerHTML = `
        <div class="card">
            <div class="header">
                <h3>كشف حساب السمسار: ${brokerName}</h3>
                <button class="btn secondary" onclick="nav('contracts')">⬅️ العودة للعقود</button>
            </div>
            <div class="card" style="margin-top: 16px;">
                <h4>إجمالي العمولات: <span class="ok" style="color:var(--ok);">${egp(totalCommission)}</span></h4>
            </div>
            <div id="broker-ledger-list" style="margin-top: 16px;">
                ${table(['تاريخ العقد', 'كود العقد', 'كود الوحدة', 'مبلغ العمولة'], rows)}
            </div>
        </div>
    `;
}

/* ===== الأقساط — إضافة عمود المسدد + منع التكرار في المدفوعات ===== */

function renderBrokerDues() {
    let currentList = [];

    function draw() {
        const q = (document.getElementById('bd-q')?.value || '').trim().toLowerCase();
        let list = state.brokerDues.slice();
        if (q) {
            list = list.filter(d =>
                (d.brokerName || '').toLowerCase().includes(q) ||
                (d.status || '').toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        currentList = list;

        const headers = ['السمسار', 'المبلغ', 'الوحدة', 'العقد', 'تاريخ الاستحقاق', 'الحالة', ''];
        const rows = currentList.map(d => {
            const contract = state.contracts.find(c => c.id === d.contractId);
            const unit = contract ? unitById(contract.unitId) : null;
            const payButton = d.status !== 'paid' ? `<button class="btn ok" onclick="payBrokerDue('${d.id}')">دفع</button>` : 'مدفوعة';
            return [
                d.brokerName,
                egp(d.amount),
                unit ? getUnitDisplayName(unit) : '—',
                contract ? contract.code : '—',
                d.dueDate,
                d.status === 'paid' ? `<span class="ok">مدفوعة</span>` : `<span class="warn">مستحقة</span>`,
                payButton
            ];
        });

        document.getElementById('bd-list').innerHTML = table(headers, rows);
    }

    view.innerHTML = `
    <div class="card">
      <h3>العمولات المستحقة للدفع</h3>
      <div class="tools">
        <input class="input" id="bd-q" placeholder="بحث بالسمسار أو الحالة..." oninput="draw()" style="flex:1;">
        <button class="btn secondary" onclick="expBrokerDues()">تصدير CSV</button>
      </div>
      <div id="bd-list" style="margin-top:12px;"></div>
    </div>
  `;

    window.expBrokerDues = () => {
        const headers = ['السمسار', 'المبلغ', 'الوحدة', 'العقد', 'تاريخ الاستحقاق', 'الحالة', 'تاريخ الدفع'];
        const rows = currentList.map(d => {
            const contract = state.contracts.find(c => c.id === d.contractId);
            const unit = contract ? unitById(contract.unitId) : null;
            return [
                d.brokerName,
                d.amount,
                unit ? getUnitDisplayName(unit) : '',
                contract ? contract.code : '',
                d.dueDate,
                d.status,
                d.paymentDate || ''
            ];
        });
        exportCSV(headers, rows, 'broker_dues.csv');
    };

    draw();
}

function renderInstallments(){
  let sort = { idx: 5, dir: 'asc' };
  let currentList = [];

  view.innerHTML = `
    <div class="card">
      <h3>الأقساط</h3>
      <div class="tools">
        <input class="input" id="i-q" placeholder="بحث بالوحدة/العميل/الحالة..." style="flex:1">
        <input type="date" class="input" id="i-from">
        <input type="date" class="input" id="i-to">
        <button class="btn" onclick="__inst_draw()">فلترة</button>
        <button class="btn secondary" id="i-reset-filter">إعادة تعيين</button>
        <button class="btn secondary" onclick="expInst()">CSV</button>
        <button class="btn" onclick="printInst()">طباعة PDF</button>
      </div>
      <div id="i-list" style="margin-top:12px;"></div>
    </div>
  `;
  window.__inst_draw = function draw(){
    const q = (document.getElementById('i-q')?.value || '').trim().toLowerCase();
    const from = document.getElementById('i-from')?.value;
    const to = document.getElementById('i-to')?.value;

    let list = state.installments.slice();
    if(q){
      list = list.filter(i => {
        const customerName = (custById(state.contracts.find(c => c.unitId === i.unitId)?.customerId) || {}).name || '';
        const searchable = `${getUnitDisplayName(unitById(i.unitId))} ${customerName} ${i.status||''} ${i.dueDate||''}`.toLowerCase();
        return searchable.includes(q);
      });
    }
    if (from) list = list.filter(i => i.dueDate >= from);
    if (to) list = list.filter(i => i.dueDate <= to);

    list.sort((a,b)=>{
      const originalA = a.originalAmount ?? a.amount;
      const originalB = b.originalAmount ?? b.amount;
      const paidA = originalA - a.amount;
      const paidB = originalB - b.amount;
      const customerA = (custById(state.contracts.find(c => c.unitId === a.unitId)?.customerId) || {}).name || '';
      const customerB = (custById(state.contracts.find(c => c.unitId === b.unitId)?.customerId) || {}).name || '';
      const partnersA = state.unitPartners.filter(up => up.unitId === a.unitId).map(up => (partnerById(up.partnerId) || {}).name).join(', ');
      const partnersB = state.unitPartners.filter(up => up.unitId === b.unitId).map(up => (partnerById(up.partnerId) || {}).name).join(', ');

      const A = [getUnitDisplayName(unitById(a.unitId)), customerA, partnersA, a.type || '', String(originalA), String(paidA), String(a.amount), a.dueDate || '', a.paymentDate || '', a.status || ''];
      const B = [getUnitDisplayName(unitById(b.unitId)), customerB, partnersB, b.type || '', String(originalB), String(paidB), String(b.amount), b.dueDate || '', b.paymentDate || '', b.status || ''];
      return (A[sort.idx] + '').localeCompare(B[sort.idx] + '') * (sort.dir === 'asc' ? 1 : -1);
    });

    currentList = list;

    const headers = ['الوحدة','العميل','المستثمرون','النوع','المبلغ الأصلي','المسدد','المتبقي','الاستحقاق','تاريخ السداد','الحالة',''];
    const headHtml = headers.map((h,i)=>
      `<th data-idx="${i}" style="cursor:pointer;white-space:nowrap">${h}${sort.idx===i?(sort.dir==='asc'?' ▲':' ▼'):''}</th>`
    ).join('');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rowsHtml = list.map(i=>{
      let rowClass = '';
      if (i.status === 'مدفوع') rowClass = 'paid';
      else if (i.dueDate && new Date(i.dueDate) < today) rowClass = 'overdue';

      const isPaid = i.status === 'مدفوع';
      const originalAmount = i.originalAmount ?? i.amount;
      const paidAmount = originalAmount - i.amount;
      const customerName = (custById(state.contracts.find(c => c.unitId === i.unitId)?.customerId) || {}).name || '—';
      const partners = state.unitPartners.filter(up => up.unitId === i.unitId).map(up => `${(partnerById(up.partnerId) || {}).name} (${up.percent}%)`).join(', ');

      return `<tr class="${rowClass}">
        <td>${getUnitDisplayName(unitById(i.unitId))}</td>
        <td>${customerName}</td>
        <td>${partners || '—'}</td>
        <td>${i.type || ''}</td>
        <td>${egp(originalAmount)}</td>
        <td>${egp(paidAmount)}</td>
        <td><strong>${egp(i.amount)}</strong></td>
        <td><span contenteditable="${!isPaid}" onblur="inlineUpd('installments','${i.id}','dueDate',this.textContent)">${i.dueDate || ''}</span></td>
        <td>${i.paymentDate || '—'}</td>
        <td><span contenteditable="${!isPaid}" onblur="inlineUpd('installments','${i.id}','status',this.textContent)">${i.status || 'غير مدفوع'}</span></td>
        <td>
          <button class="btn ok" onclick="payInstallment('${i.id}')" ${isPaid ? 'disabled' : ''}>دفع</button>
          <button class="btn" onclick="reschedule('${i.id}')" ${isPaid ? 'disabled' : ''}>إعادة جدولة</button>
          <button class="btn secondary" onclick="delRow('installments','${i.id}')" ${isPaid ? 'disabled' : ''}>حذف</button>
        </td>
      </tr>`;
    }).join('');
    document.getElementById('i-list').innerHTML =
      `<table class="table"><thead><tr>${headHtml}</tr></thead><tbody>${
        rowsHtml || `<tr><td colspan="${headers.length}"><small>لا توجد بيانات</small></td></tr>`
      }</tbody></table>`;
    document.querySelectorAll('#i-list thead th').forEach(th=>{
      th.onclick = function(){
        const idx = Number(this.getAttribute('data-idx'));
        const dir = (sort.idx === idx && sort.dir === 'asc') ? 'desc' : 'asc';
        sort = { idx, dir };
        __inst_draw();
      };
    });
    document.getElementById('i-reset-filter').onclick = () => {
        document.getElementById('i-q').value = '';
        document.getElementById('i-from').value = '';
        document.getElementById('i-to').value = '';
        __inst_draw();
    };
  };
  window.expInst = function(){
    const headers=['الوحدة','النوع','المبلغ الأصلي','المسدد','المتبقي','الاستحقاق','تاريخ السداد','الحالة'];
    const rows=currentList.map(i=> {
        const originalAmount = i.originalAmount ?? i.amount;
        const paidAmount = originalAmount - i.amount;
        return [getUnitDisplayName(unitById(i.unitId)), i.type, originalAmount, paidAmount, i.amount, i.dueDate||'', i.paymentDate||'', i.status||''];
    });
    exportCSV(headers, rows, 'installments.csv');
  };
  window.printInst = function(){
    const rows=currentList.map(i=> {
      const originalAmount = i.originalAmount ?? i.amount;
      const paidAmount = originalAmount - i.amount;
      return `
      <tr>
        <td>${getUnitDisplayName(unitById(i.unitId))}</td>
        <td>${i.type || ''}</td>
        <td>${egp(originalAmount)}</td>
        <td>${egp(paidAmount)}</td>
        <td>${egp(i.amount)}</td>
        <td>${i.dueDate || ''}</td>
        <td>${i.paymentDate || ''}</td>
        <td>${i.status || ''}</td>
      </tr>`}).join('');
    printHTML('تقرير الأقساط',
      `<h1>تقرير الأقساط</h1>
       <table>
         <thead><tr>
           <th>الوحدة</th><th>النوع</th><th>المبلغ الأصلي</th><th>المسدد</th><th>المتبقي</th><th>الاستحقاق</th><th>تاريخ السداد</th><th>الحالة</th>
         </tr></thead>
         <tbody>${rows}</tbody>
       </table>`);
  };
  window.payInstallment = function(id){
      const i = state.installments.find(x=>x.id===id);
      if(!i || i.status==='مدفوع' || i.amount<=0) return alert('هذا القسط غير صالح للدفع.');

      const safeOptions = state.safes.map(s => `<option value="${s.id}">${s.name} (${egp(s.balance)})</option>`).join('');
      const content = `
          <p>المبلغ المتبقي على القسط: <strong>${egp(i.amount)}</strong></p>
          <input class="input" id="inst-pay-amount" type="number" placeholder="المبلغ المدفوع" value="${i.amount}">
          <select class="select" id="inst-pay-safe" style="margin-top: 10px;">
              <option value="">اختر الخزنة...</option>
              ${safeOptions}
          </select>
      `;
      showModal('تسجيل دفعة قسط', content, () => {
          const paid = parseNumber(document.getElementById('inst-pay-amount').value);
          const safeId = document.getElementById('inst-pay-safe').value;
          if(!(paid > 0) || !safeId) {
              alert('الرجاء إدخال مبلغ صحيح واختيار خزنة.');
              return false;
          }
          saveState();
          if (processPayment(i.unitId, paid, 'قسط', today(), safeId, i.id)) {
            persist();
            __inst_draw();
          } else {
            undo();
          }
          return true;
      });
  };
  window.reschedule = function(id){
    const i = state.installments.find(x=>x.id===id); if(!i) return;
    const oldDetails = { amount: i.amount, dueDate: i.dueDate };

    const newAmt = Number(prompt('قيمة القسط الجديدة', i.amount) || i.amount);
    const newDate = prompt('تاريخ الاستحقاق الجديد (YYYY-MM-DD)', i.dueDate || '') || i.dueDate;

    if (newAmt === oldDetails.amount && newDate === oldDetails.dueDate) return; // No change

    saveState();
    const unitId = i.unitId;
    const remainList = state.installments
      .filter(x=>x.unitId===unitId && x.status!=='مدفوع')
      .sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||''));
    const idx = remainList.findIndex(x=>x.id===id);
    const diff = Math.round((i.amount - newAmt) * 100) / 100;
    if (typeof i.originalAmount !== 'number') i.originalAmount = i.amount;
    i.amount = newAmt; i.dueDate = newDate;
    const others = remainList.slice(idx+1);
    const share = others.length ? Math.round((diff / others.length) * 100) / 100 : 0;
    others.forEach(x=>{
      if (typeof x.originalAmount !== 'number') x.originalAmount = x.amount;
      x.amount = Math.round((x.amount + share) * 100) / 100;
    });

    logAction('إعادة جدولة قسط', { installmentId: id, oldDetails, newAmount: newAmt, newDueDate: newDate, distributedDiff: diff });
    persist();
    __inst_draw();
    alert('تمت إعادة الجدولة وتوزيع الفرق على الأقساط التالية.');
  };
  window.simpleEditInstallment = function(id) {
    const i = state.installments.find(x => x.id === id);
    if (!i) return alert('لم يتم العثور على القسط.');

    const oldDetails = { amount: i.amount, dueDate: i.dueDate };
    const newAmtStr = prompt('أدخل المبلغ الجديد للقسط:', i.amount);
    if (newAmtStr === null) return;
    const newAmt = parseNumber(newAmtStr);
    if (isNaN(newAmt) || newAmt <= 0) return alert('الرجاء إدخال مبلغ صحيح.');

    const newDateStr = prompt('أدخل تاريخ الاستحقاق الجديد (YYYY-MM-DD):', i.dueDate);
    if (newDateStr === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) return alert('صيغة التاريخ غير صحيحة. الرجاء استخدام YYYY-MM-DD.');

    if (newAmt === oldDetails.amount && newDateStr === oldDetails.dueDate) return; // No change

    saveState();
    logAction('تعديل بسيط لقسط', { installmentId: id, oldAmount: oldDetails.amount, newAmount: newAmt, oldDueDate: oldDetails.dueDate, newDueDate: newDateStr });
    i.amount = newAmt;
    i.dueDate = newDateStr;
    if (typeof i.originalAmount === 'number') {
        i.originalAmount = newAmt;
    }
    persist();
    __inst_draw();
    alert('تم تعديل القسط بنجاح.');
  }
  __inst_draw();
}

function processPayment(unitId, amount, method, date, safeId, installmentId = null) {
    if (!unitId || !amount || !date || !safeId) {
        alert('بيانات الدفع غير مكتملة.');
        return false;
    }

    const safe = state.safes.find(s => s.id === safeId);
    if (!safe) {
        alert('لم يتم العثور على الخزنة المحددة.');
        return false;
    }

    let remainingAmountToProcess = amount;

    // Create a receipt voucher for the payment
    const customer = custById(state.contracts.find(c => c.unitId === unitId)?.customerId);
    const voucher = {
        id: uid('V'),
        type: 'receipt',
        date: date,
        amount: amount,
        safeId: safeId,
        description: `سداد دفعة للوحدة ${getUnitDisplayName(unitById(unitId))}`,
        payer: customer ? customer.name : 'غير محدد',
        linked_ref: installmentId || unitId
    };
    state.vouchers.push(voucher);
    logAction('تسجيل سند قبض', { voucherId: voucher.id, unitId, amount, safeId });

    // Add money to the safe
    safe.balance = (safe.balance || 0) + amount;

    // If this payment is for an installment, apply it to the installments
    const installmentsToPay = state.installments
        .filter(i => i.unitId === unitId && i.status !== 'مدفوع')
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    if (installmentsToPay.length === 0 && installmentId) {
        console.warn(`Payment made for installment ${installmentId}, but no payable installments found for unit ${unitId}.`);
        return true;
    }

    for (const inst of installmentsToPay) {
        if (remainingAmountToProcess <= 0) break;

        const amountToPayOnThisInstallment = Math.min(remainingAmountToProcess, inst.amount);

        if (typeof inst.originalAmount !== 'number') {
            inst.originalAmount = inst.amount;
        }

        inst.amount -= amountToPayOnThisInstallment;
        remainingAmountToProcess -= amountToPayOnThisInstallment;

        if (inst.amount <= 0.005) { // Use a small epsilon for float comparison
            inst.amount = 0;
            inst.status = 'مدفوع';
            inst.paymentDate = date;
        } else {
            inst.status = 'مدفوع جزئياً';
        }
        logAction('تطبيق دفعة على قسط', { installmentId: inst.id, paidAmount: amountToPayOnThisInstallment, remainingAmount: inst.amount });
    }

    if (remainingAmountToProcess > 0.005) {
        console.log(`Overpayment of ${egp(remainingAmountToProcess)} for unit ${unitId}.`);
    }

    return true; // Success
}

window.payBrokerDue = function(dueId) {
    const due = state.brokerDues.find(d => d.id === dueId);
    if (!due || due.status === 'paid') {
        return alert('هذه العمولة غير صالحة للدفع.');
    }

    const safeOptions = state.safes.map(s => `<option value="${s.id}">${s.name} (${egp(s.balance)})</option>`).join('');
    const content = `
        <p>سيتم دفع مبلغ <strong>${egp(due.amount)}</strong> للسمسار <strong>${due.brokerName}</strong>.</p>
        <p>الرجاء اختيار الخزنة التي سيتم الدفع منها:</p>
        <select class="select" id="due-pay-safe" style="margin-top: 10px;">
            <option value="">اختر الخزنة...</option>
            ${safeOptions}
        </select>
    `;

    showModal('دفع عمولة سمسار', content, () => {
        const safeId = document.getElementById('due-pay-safe').value;
        if (!safeId) {
            alert('الرجاء اختيار خزنة.');
            return false;
        }

        const safe = state.safes.find(s => s.id === safeId);
        if (!safe || safe.balance < due.amount) {
            alert(`رصيد الخزنة "${safe.name}" غير كافٍ.`);
            return false;
        }

        saveState();

        // 1. Update safe balance
        safe.balance -= due.amount;

        // 2. Update due status
        due.status = 'paid';
        due.paymentDate = today();
        due.paidFromSafeId = safeId;

        // 3. Create payment voucher
        const contract = state.contracts.find(c => c.id === due.contractId);
        const unit = contract ? unitById(contract.unitId) : null;
        const newVoucher = {
            id: uid('V'),
            type: 'payment',
            date: today(),
            amount: due.amount,
            safeId: safeId,
            description: `صرف عمولة سمسار للوحدة ${unit ? getUnitDisplayName(unit) : ''}`,
            beneficiary: due.brokerName,
            linked_ref: due.id
        };
        state.vouchers.push(newVoucher);

        logAction('دفع عمولة سمسar مستحقة', { brokerDueId: due.id, safeId: safeId, amount: due.amount });

        persist();
        nav('brokerDues'); // Refresh the view
        return true;
    });
};

/* ===== الشركاء + ربطهم بالوحدات ===== */
function showAddExpenseModal() {
    const safeOptions = state.safes.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const content = `
        <div class="grid grid-2" style="gap: 10px;">
            <input class="input" id="exp-desc" placeholder="بيان المصروف">
            <input class="input" id="exp-beneficiary" placeholder="المستفيد">
            <input class="input" id="exp-amount" type="number" placeholder="المبلغ">
            <input class="input" id="exp-date" type="date" value="${today()}">
        </div>
        <select class="select" id="exp-safe" style="margin-top: 10px;">
            <option value="">اختر الخزنة...</option>
            ${safeOptions}
        </select>
    `;

    showModal('إضافة سند صرف جديد', content, () => {
        const description = document.getElementById('exp-desc').value.trim();
        const beneficiary = document.getElementById('exp-beneficiary').value.trim();
        const amount = parseNumber(document.getElementById('exp-amount').value);
        const date = document.getElementById('exp-date').value;
        const safeId = document.getElementById('exp-safe').value;

        if (!description || !amount || !date || !safeId) {
            alert('الرجاء ملء جميع الحقول.');
            return false;
        }

        const safe = state.safes.find(s => s.id === safeId);
        if (safe.balance < amount) {
            alert(`رصيد الخزنة "${safe.name}" غير كافٍ.`);
            return false;
        }

        saveState();

        safe.balance -= amount;

        const newVoucher = {
            id: uid('V'),
            type: 'payment',
            date,
            amount,
            safeId,
            description,
            beneficiary,
            linked_ref: 'general_expense'
        };
        state.vouchers.push(newVoucher);
        logAction('إضافة سند صرف يدوي', newVoucher);

        persist();
        nav('vouchers');
        return true;
    });
}

function renderVouchers() {
  let activeTab = 'all';
  const safeFilterId = currentParam?.safeId;
  const safeFilterName = safeFilterId ? (state.safes.find(s => s.id === safeFilterId) || {}).name : null;
  const title = safeFilterName ? `سجل حركات خزنة: ${safeFilterName}` : 'سجل السندات';

  view.innerHTML = `
    <div class="card">
      <div class="header">
        <h3>${title}</h3>
        <div class="tools">
            ${safeFilterId ? `<button class="btn secondary" onclick="nav('treasury')">⬅️ العودة للخزينة</button>` : `<button class="btn" id="add-expense-btn">إضافة سند صرف</button>`}
        </div>
      </div>
      <div class="tabs" style="margin: 12px 0;">
          <button class="tab-btn active" data-tab="all">الكل</button>
          <button class="tab-btn" data-tab="receipt">سندات قبض</button>
          <button class="tab-btn" data-tab="payment">سندات صرف</button>
      </div>
      <div class="tools" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
        <input class="input" id="v-q" placeholder="بحث بالبيان أو الطرف الآخر..." style="flex: 1;">
        <input type="date" class="input" id="v-from">
        <input type="date" class="input" id="v-to">
        <button class="btn" id="v-apply-filter">فلترة</button>
        <button class="btn secondary" onclick="expVouchers()">تصدير CSV</button>
        <button class="btn secondary" onclick="printVouchers()">طباعة</button>
      </div>
      <div id="vouchers-list" style="margin-top: 12px;"></div>
    </div>
  `;

  let currentList = [];

  function draw() {
    const q = (document.getElementById('v-q')?.value || '').trim().toLowerCase();
    const from = document.getElementById('v-from')?.value;
    const to = document.getElementById('v-to')?.value;

    let list = state.vouchers.slice();

    if (safeFilterId) {
        list = list.filter(v => v.safeId === safeFilterId);
    }
    if (activeTab !== 'all') {
      list = list.filter(v => v.type === activeTab);
    }
    if (q) {
        list = list.filter(v =>
            (v.description || '').toLowerCase().includes(q) ||
            (v.payer || '').toLowerCase().includes(q) ||
            (v.beneficiary || '').toLowerCase().includes(q)
        );
    }
    if (from) list = list.filter(v => v.date >= from);
    if (to) list = list.filter(v => v.date <= to);

    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    currentList = list; // Save for export

    const safeName = (id) => (state.safes.find(s => s.id === id) || {}).name || '—';

    const rows = list.map(v => {
        const typeText = v.type === 'receipt' ? 'قبض' : 'صرف';
        const typeClass = v.type === 'receipt' ? 'ok' : 'warn';
        const party = v.type === 'receipt' ? `من: ${v.payer || 'غير محدد'}` : `إلى: ${v.beneficiary || 'غير محدد'}`;

        return [
            v.date,
            `<span class="badge ${typeClass}">${typeText}</span>`,
            `<span style="font-weight:bold; color:var(--${typeClass})">${egp(v.amount)}</span>`,
            v.description,
            safeName(v.safeId),
            party
        ];
    });

    const headers = ['التاريخ', 'النوع', 'المبلغ', 'البيان', 'الخزنة', 'الطرف الآخر'];
    document.getElementById('vouchers-list').innerHTML = table(headers, rows);
  }

  window.expVouchers = () => {
      const headers = ['التاريخ', 'النوع', 'المبلغ', 'البيان', 'الخزنة', 'الدافع', 'المستفيد'];
      const rows = currentList.map(v => [
          v.date,
          v.type === 'receipt' ? 'قبض' : 'صرف',
          v.amount,
          v.description,
          (state.safes.find(s => s.id === v.safeId) || {}).name || '—',
          v.payer || '',
          v.beneficiary || ''
      ]);
      exportCSV(headers, rows, 'vouchers.csv');
  };

  window.printVouchers = () => {
      const headers = ['التاريخ', 'النوع', 'المبلغ', 'البيان', 'الخزنة', 'الطرف الآخر'];
      const rows = currentList.map(v => {
          const typeText = v.type === 'receipt' ? 'قبض' : 'صرف';
          const party = v.type === 'receipt' ? `من: ${v.payer || 'غير محدد'}` : `إلى: ${v.beneficiary || 'غير محدد'}`;
          return `<tr><td>${v.date}</td><td>${typeText}</td><td>${egp(v.amount)}</td><td>${v.description}</td><td>${(state.safes.find(s=>s.id===v.safeId)||{}).name||'—'}</td><td>${party}</td></tr>`;
      }).join('');
      printHTML('تقرير السندات', `<h1>تقرير السندات</h1><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`);
  };

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        draw();
    };
  });

  document.getElementById('add-expense-btn').onclick = showAddExpenseModal;
  document.getElementById('v-apply-filter').onclick = draw;

  draw();
}

function renderPartners(){
  let activeTab = 'partners';
  let partnersList = [];
  let debtsList = [];

  view.innerHTML = `
    <div class="card">
      <div class="tabs">
        <button class="tab-btn active" data-tab="partners">الشركاء</button>
        <button class="tab-btn" data-tab="debts">ديون الشركاء</button>
      </div>
      <div id="partners-content" style="padding-top: 16px;"></div>
    </div>
  `;

  function drawPartnersTab() {
    const q = (document.getElementById('pr-q')?.value || '').trim().toLowerCase();
    partnersList = state.partners.slice();
    if (q) {
        partnersList = partnersList.filter(p => (p.name.toLowerCase().includes(q) || (p.phone||'').includes(q)));
    }

    document.getElementById('partners-content').innerHTML = `
      <div class="grid grid-2">
        <div>
          <h3>إضافة شريك</h3>
          <input class="input" id="pr-name" placeholder="اسم الشريك">
          <input class="input" id="pr-phone" placeholder="الهاتف" style="margin-top:8px;">
          <button class="btn" onclick="addPartner()" style="margin-top:8px;">حفظ</button>
        </div>
        <div>
          <h3>قائمة الشركاء</h3>
          <div class="tools">
             <input class="input" id="pr-q" placeholder="بحث بالاسم أو الهاتف..." oninput="drawPartnersTab()" value="${q}">
             <button class="btn secondary" onclick="expPartners()">تصدير CSV</button>
          </div>
          <div id="pr-list"></div>
        </div>
      </div>
    `;
    const prRows = partnersList.map(p => [
        `<a href="#" onclick="nav('partner-details', '${p.id}'); return false;">${p.name}</a>`,
        p.phone,
        `<button class="btn secondary" onclick="delRow('partners','${p.id}')">حذف</button>`
    ]);
    document.getElementById('pr-list').innerHTML = table(['الاسم', 'الهاتف', ''], prRows);
  }

  function drawDebtsTab() {
    const q = (document.getElementById('pd-q')?.value || '').trim().toLowerCase();
    debtsList = state.partnerDebts.slice();
    if(q) {
      debtsList = debtsList.filter(d => {
        const paying = partnerById(d.payingPartnerId)?.name || '';
        const owed = partnerById(d.owedPartnerId)?.name || '';
        const unit = getUnitDisplayName(unitById(d.unitId)) || '';
        const searchable = `${paying} ${owed} ${unit} ${d.status}`.toLowerCase();
        return searchable.includes(q);
      });
    }

    document.getElementById('partners-content').innerHTML = `
        <h3>ديون الشركاء</h3>
        <div class="tools">
            <input class="input" id="pd-q" placeholder="بحث..." oninput="drawDebtsTab()" value="${q}">
            <button class="btn secondary" onclick="expPartnerDebts()">تصدير CSV</button>
        </div>
        <div id="pd-list"></div>
    `;
    let sort = { idx: 3, dir: 'asc' };
    debtsList.sort((a,b) => (a.dueDate||'').localeCompare(b.dueDate||''));
    const rows = debtsList.map(d => {
      const paying = partnerById(d.payingPartnerId)?.name || 'محذوف';
      const owed = partnerById(d.owedPartnerId)?.name || 'محذوف';
      const unit = getUnitDisplayName(unitById(d.unitId));
      const payButton = d.status !== 'مدفوع' ? `<button class="btn ok" onclick="payPartnerDebt('${d.id}')">تسجيل السداد</button>` : 'تم السداد';
      return [paying, owed, unit, d.dueDate, egp(d.amount), d.status, payButton];
    });
    const headers = ['الشريك الدافع', 'الشريك المستحق', 'الوحدة', 'تاريخ الاستحقاق', 'المبلغ', 'الحالة', ''];
    document.getElementById('pd-list').innerHTML = table(headers, rows, sort, (ns) => { sort = ns; drawDebtsTab(); });
  }

  window.addPartner=()=>{
    const name=document.getElementById('pr-name').value.trim(); if(!name) return;
    const phone = document.getElementById('pr-phone').value;
    saveState();
    const newPartner = {id:uid('PR'),name,phone};
    logAction('إضافة شريك جديد', { partnerId: newPartner.id, name });
    state.partners.push(newPartner);
    persist();
    nav('partners');
  };

  window.payPartnerDebt = (debtId) => {
    const debt = state.partnerDebts.find(d => d.id === debtId);
    if(!debt) return alert('لم يتم العثور على الدين.');
    if(confirm(`هل تؤكد سداد هذا الدين بمبلغ ${egp(debt.amount)}؟`)){
        saveState();
        debt.status = 'مدفوع';
        debt.paymentDate = today();
        persist();
        drawDebtsTab();
    }
  };

  window.expPartners = () => {
      exportCSV(['الاسم', 'الهاتف'], partnersList.map(p => [p.name, p.phone]), 'partners.csv');
  };

  window.expPartnerDebts = () => {
      const headers = ['الدافع', 'المستحق', 'الوحدة', 'تاريخ الاستحقاق', 'المبلغ', 'الحالة'];
      const rows = debtsList.map(d => [
          partnerById(d.payingPartnerId)?.name || 'محذوف',
          partnerById(d.owedPartnerId)?.name || 'محذوف',
          getUnitDisplayName(unitById(d.unitId)),
          d.dueDate,
          d.amount,
          d.status
      ]);
      exportCSV(headers, rows, 'partner_debts.csv');
  };

  function setActiveTab() {
    if (activeTab === 'partners') {
      drawPartnersTab();
    } else {
      drawDebtsTab();
    }
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        setActiveTab();
    };
  });

  setActiveTab();
}

let lastReportData = null;

/* ===== الخزينة الموحدة ===== */
function renderTreasury() {
    let safesList = [];
    view.innerHTML = `
        <div class="card">
            <div class="header">
                <h3>إدارة الخزينة</h3>
                <div class="tools">
                    <button class="btn" onclick="showAddSafeModal()">إضافة خزنة جديدة</button>
                    <button class="btn secondary" onclick="showAddTransferModal()">تسجيل تحويل</button>
                </div>
            </div>
            <div class="tools" style="margin-top:12px;">
                <input class="input" id="t-q" placeholder="بحث باسم الخزنة..." oninput="draw()">
                <button class="btn secondary" onclick="expTreasury()">تصدير CSV</button>
            </div>
            <div id="safes-list" style="margin-top: 16px;"></div>
        </div>
    `;

    function draw() {
        const q = (document.getElementById('t-q')?.value || '').trim().toLowerCase();
        safesList = state.safes.slice();
        if (q) {
            safesList = safesList.filter(s => s.name.toLowerCase().includes(q));
        }

        const rows = safesList.map(s => [
            `<a href="#" onclick="nav('vouchers', { safeId: '${s.id}' }); return false;">${s.name || ''}</a>`,
            `<span>${egp(s.balance || 0)}</span>`,
        ]);
        document.getElementById('safes-list').innerHTML = table(['اسم الخزنة', 'الرصيد الحالي'], rows);
    }

    window.expTreasury = () => {
        exportCSV(['اسم الخزنة', 'الرصيد'], safesList.map(s => [s.name, s.balance]), 'safes.csv');
    };

    draw();
}

function showAddSafeModal() {
    const content = `
        <input class="input" id="s-name" placeholder="اسم الخزنة (مثلاً: الخزنة الرئيسية، حساب البنك)">
        <input class="input" id="s-balance" placeholder="الرصيد الافتتاحي" type="number" value="0" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
    `;
    showModal('إضافة خزنة جديدة', content, () => {
        const name = document.getElementById('s-name').value.trim();
        const balance = parseNumber(document.getElementById('s-balance').value);
        if (!name) { alert('الرجاء إدخال اسم الخزنة.'); return false; }
        if (state.safes.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            alert('خزنة بنفس الاسم موجودة بالفعل.'); return false;
        }
        saveState();
        const newSafe = { id: uid('S'), name, balance };
        state.safes.push(newSafe);
        logAction('إضافة خزنة جديدة', { safeId: newSafe.id, name, initialBalance: balance });
        persist();
        nav('treasury');
        return true;
    });
}

function showAddTransferModal() {
    const safeOptions = state.safes.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    const content = `
      <div class="grid grid-2" style="gap:10px;">
        <select class="select" id="t-from"><option value="">من خزنة...</option>${safeOptions}</select>
        <select class="select" id="t-to"><option value="">إلى خزنة...</option>${safeOptions}</select>
      </div>
      <input class="input" id="t-amount" type="number" placeholder="المبلغ" style="margin-top:10px;">
      <input class="input" id="t-date" type="date" value="${today()}" style="margin-top:10px;">
      <textarea class="input" id="t-notes" placeholder="ملاحظات" style="margin-top:10px;" rows="2"></textarea>
    `;
    showModal('تسجيل تحويل بين الخزن', content, () => {
        const fromSafeId = document.getElementById('t-from').value;
        const toSafeId = document.getElementById('t-to').value;
        const amount = parseNumber(document.getElementById('t-amount').value);
        const date = document.getElementById('t-date').value;
        const notes = document.getElementById('t-notes').value.trim();

        if (!fromSafeId || !toSafeId || !amount) { alert('الرجاء ملء جميع الحقول.'); return false; }
        if (fromSafeId === toSafeId) { alert('لا يمكن التحويل إلى نفس الخزنة.'); return false; }

        const fromSafe = state.safes.find(s => s.id === fromSafeId);
        const toSafe = state.safes.find(s => s.id === toSafeId);
        if (fromSafe.balance < amount) { alert(`رصيد الخزنة "${fromSafe.name}" غير كافٍ.`); return false; }

        saveState();
        fromSafe.balance -= amount;
        toSafe.balance += amount;

        const newTransfer = { id: uid('T'), fromSafeId, toSafeId, amount, date, notes };
        state.transfers.push(newTransfer);
        logAction('تنفيذ تحويل بين الخزن', newTransfer);

        persist();
        nav('treasury');
        return true;
    });
}

const REPORT_DEFINITIONS = {
  'المالية': [
    {
      id: 'payments_monthly',
      title: 'مدفوعات شهرية',
      description: 'عرض إجمالي المدفوعات مجمعة حسب الشهر.',
      icon: '📅'
    },
    {
      id: 'cashflow',
      title: 'التدفقات النقدية العامة',
      description: 'كشف حساب يوضح كل الحركات المالية الداخلة والخارجة.',
      icon: '💰'
    }
  ],
  'الشركاء': [
    {
      id: 'partner_summary',
      title: 'ملخص أرباح الشركاء',
      description: 'عرض ملخص دخل ومصروفات وصافي ربح كل شريك.',
      icon: '👥'
    },
    {
      id: 'partner_profits',
      title: 'تفاصيل أرباح الشركاء',
      description: 'عرض تفصيلي لكل دفعة وكيف تم توزيعها كأرباح على الشركاء.',
      icon: '📊'
    },
    {
      id: 'partner_cashflow',
      title: 'ملخص تدفقات الشركاء',
      description: 'عرض شهري لحصة الأرباح الخاصة بشريك معين.',
      icon: '📈'
    }
  ],
  'المتابعة': [
    {
      id: 'inst_due',
      title: 'كل الأقساط المستحقة',
      description: 'قائمة بكل الأقساط القادمة التي لم يتم سدادها بعد.',
      icon: '🔔'
    },
    {
      id: 'inst_overdue',
      title: 'الأقساط المتأخرة فقط',
      description: 'عرض الأقساط التي تجاوزت تاريخ استحقاقها ولم تسدد.',
      icon: '⚠️'
    },
    {
      id: 'cust_activity',
      title: 'نشاط العملاء',
      description: 'تقرير يوضح عدد الوحدات وإجمالي المدفوعات لكل عميل.',
      icon: '🧍'
    },
    {
      id: 'units_status',
      title: 'حالة الوحدات',
      description: 'ملخص لعدد الوحدات المتاحة، المباعة، والمحجوزة.',
      icon: '🏠'
    }
  ]
};

/* ===== التقارير ===== */
function renderReports() {
  const categories = Object.keys(REPORT_DEFINITIONS);
  let activeCategory = categories[0];

  view.innerHTML = `
    <div class="reports-layout">
      <div class="report-cards-grid">
        <!-- Report cards will be rendered here -->
      </div>
      <div class="report-categories">
        <h3>الفئات</h3>
        <ul id="report-category-list"></ul>
      </div>
    </div>
  `;

  const categoryListEl = document.getElementById('report-category-list');

  function selectCategory(category) {
    activeCategory = category;
    // Update active class on list items
    document.querySelectorAll('#report-category-list li').forEach(li => {
      if (li.dataset.category === category) {
        li.classList.add('active');
      } else {
        li.classList.remove('active');
      }
    });
    // Render the cards for the selected category
    renderReportCards(category);
  }

  // Render category list
  categories.forEach(category => {
    const li = document.createElement('li');
    li.textContent = category;
    li.dataset.category = category;
    li.onclick = () => selectCategory(category);
    categoryListEl.appendChild(li);
  });

  // Initial render
  if (categoryListEl.firstChild) {
    selectCategory(activeCategory);
  }
}

function renderReportCards(category) {
    const reports = REPORT_DEFINITIONS[category];
    const gridEl = document.querySelector('.report-cards-grid');
    if (!gridEl) return;

    gridEl.innerHTML = reports.map(report => `
        <div class="report-card" data-report-id="${report.id}">
            <div class="report-card-icon">${report.icon}</div>
            <div class="report-card-body">
                <h4>${report.title}</h4>
                <p>${report.description}</p>
            </div>
        </div>
    `).join('');

    // Add click handlers for the new cards
    document.querySelectorAll('.report-card').forEach(card => {
        card.onclick = () => {
            const reportId = card.dataset.reportId;
            renderReportFilterScreen(reportId);
        };
    });
}

function renderReportFilterScreen(reportId) {
  // Find the report definition
  let report = null;
  for (const category in REPORT_DEFINITIONS) {
    const found = REPORT_DEFINITIONS[category].find(r => r.id === reportId);
    if (found) {
      report = found;
      break;
    }
  }

  if (!report) {
    view.innerHTML = `
        <div class="card">
            <h2>خطأ</h2>
            <p>لم يتم العثور على التقرير المطلوب.</p>
            <button class="btn" onclick="nav('reports')">العودة إلى التقارير</button>
        </div>
    `;
    return;
  }

  view.innerHTML = `
    <div class="card">
        <div class="header">
            <h3>فلترة تقرير: ${report.title}</h3>
            <button class="btn secondary" onclick="nav('reports')">⬅️ العودة</button>
        </div>
        <div id="rep-filters-container" class="grid grid-4" style="gap:8px; align-items: end; margin: 16px 0;">
            <!-- Filters will be dynamically inserted here -->
        </div>
        <div class="tools">
            <button class="btn" id="generate-report-btn" style="flex:1; padding: 12px; font-size: 16px;">إنشاء التقرير</button>
        </div>
        <hr>
        <div id="rep-out"></div>
    </div>
  `;

  const filtersContainer = document.getElementById('rep-filters-container');

  // Logic to add filters based on reportId
  const needsDates = ['payments_monthly', 'cashflow', 'partner_profits', 'inst_due', 'inst_overdue', 'cust_activity', 'partner_cashflow', 'partner_summary'];
  const needsPartner = ['partner_profits', 'partner_cashflow', 'partner_summary'];

  if (needsDates.includes(reportId)) {
    filtersContainer.innerHTML += `
        <input type="date" class="input" id="rep-from" placeholder="من تاريخ">
        <input type="date" class="input" id="rep-to" placeholder="إلى تاريخ">
    `;
  }
  if (needsPartner.includes(reportId) && reportId !== 'partner_summary') {
    filtersContainer.innerHTML += `
      <select id="rep-partner-sel" class="select">
          <option value="">اختر شريك...</option>
          ${state.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
    `;
  }

  // Attach listener to the generate button
  document.getElementById('generate-report-btn').onclick = () => {
    runReport(reportId);
  };
}

/* ===== ديون الشركاء ===== */
function renderPartnerDebts(){
  let sort = { idx: 3, dir: 'asc' }; // Default sort by due date
  function draw(){
    const q = (document.getElementById('pd-q')?.value || '').trim().toLowerCase();
    let list = state.partnerDebts.slice();
    if(q) {
      list = list.filter(d => {
        const paying = partnerById(d.payingPartnerId)?.name || '';
        const owed = partnerById(d.owedPartnerId)?.name || '';
        const unit = getUnitDisplayName(unitById(d.unitId)) || '';
        const searchable = `${paying} ${owed} ${unit} ${d.status}`.toLowerCase();
        return searchable.includes(q);
      });
    }

    list.sort((a,b)=>{
      const pA = partnerById(a.payingPartnerId)?.name || '';
      const oA = partnerById(a.owedPartnerId)?.name || '';
      const uA = getUnitDisplayName(unitById(a.unitId));
      const colsA = [pA, oA, uA, a.dueDate, a.amount, a.status];

      const pB = partnerById(b.payingPartnerId)?.name || '';
      const oB = partnerById(b.owedPartnerId)?.name || '';
      const uB = getUnitDisplayName(unitById(b.unitId));
      const colsB = [pB, oB, uB, b.dueDate, b.amount, b.status];

      const valA = colsA[sort.idx];
      const valB = colsB[sort.idx];

      if (typeof valA === 'number') {
        return (valA - valB) * (sort.dir === 'asc' ? 1 : -1);
      }
      return (valA+'').localeCompare(valB+'') * (sort.dir === 'asc' ? 1 : -1);
    });

    const rows = list.map(d => {
      const paying = partnerById(d.payingPartnerId)?.name || 'محذوف';
      const owed = partnerById(d.owedPartnerId)?.name || 'محذوف';
      const unit = getUnitDisplayName(unitById(d.unitId));
      const payButton = d.status !== 'مدفوع' ? `<button class="btn ok" onclick="payPartnerDebt('${d.id}')">تسجيل السداد</button>` : 'تم السداد';
      return [paying, owed, unit, d.dueDate, egp(d.amount), d.status, payButton];
    });
    const headers = ['الشريك الدافع', 'الشريك المستحق', 'الوحدة', 'تاريخ الاستحقاق', 'المبلغ', 'الحالة', ''];
    document.getElementById('pd-list').innerHTML = table(headers, rows, sort, (ns) => { sort = ns; draw(); });
  }

  view.innerHTML = `
    <div class="card">
        <h3>ديون الشركاء</h3>
        <p style="font-size:13px; color:var(--muted);">هذه هي الديون التي نشأت بين الشركاء نتيجة عمليات إرجاع الوحدات.</p>
        <div class="tools">
            <input class="input" id="pd-q" placeholder="بحث باسم الشريك أو الوحدة..." oninput="draw()">
        </div>
        <div id="pd-list"></div>
    </div>
  `;

  window.payPartnerDebt = (debtId) => {
    const debt = state.partnerDebts.find(d => d.id === debtId);
    if(!debt) return alert('لم يتم العثور على الدين.');
    if(confirm(`هل تؤكد سداد هذا الدين بمبلغ ${egp(debt.amount)}؟`)){
        saveState();
        debt.status = 'مدفوع';
        debt.paymentDate = today();
        persist();
        draw();
    }
  };

  draw();
}

window.runReport=(type)=>{
  const from=document.getElementById('rep-from')?.value;
  const to=document.getElementById('rep-to')?.value;
  let title='', headers=[], rows=[];
  const out=document.getElementById('rep-out'); out.innerHTML='';

  // Helper function to find a contract from various references
  const getContractFromRef = (refId) => {
    if (!refId) return null;
    let contract = state.contracts.find(c => c.id === refId);
    if (contract) return contract;

    const installment = state.installments.find(i => i.id === refId);
    if (installment) {
        return state.contracts.find(c => c.unitId === installment.unitId);
    }

    // Fallback for direct unitId, not ideal but might be used
    const contractsForUnit = state.contracts.filter(c => c.unitId === refId);
    if (contractsForUnit.length > 0) {
      return contractsForUnit.sort((a,b) => (b.start||'').localeCompare(a.start||''))[0];
    }
    return null;
  };


  switch(type){
    case 'units_status':
      title='تقرير حالة الوحدات'; headers=['الحالة','العدد','إجمالي السعر'];
      const stats={}; state.units.forEach(u=>{ stats[u.status]=(stats[u.status]||{c:0,p:0}); stats[u.status].c++; stats[u.status].p+=Number(u.totalPrice||0); });
      rows=Object.keys(stats).map(k=>[k,stats[k].c,egp(stats[k].p)]);
      break;
    case 'cust_activity':
      title='تقرير نشاط العملاء'; headers=['العميل','عدد الوحدات','إجمالي المدفوعات'];
      const custs={};
      state.customers.forEach(c => {
        custs[c.id] = { name: c.name, u: new Set(), p: 0 };
      });

      let filteredVouchers = state.vouchers.filter(v => v.type === 'receipt');
      if(from) filteredVouchers = filteredVouchers.filter(v => v.date >= from);
      if(to) filteredVouchers = filteredVouchers.filter(v => v.date <= to);

      filteredVouchers.forEach(v => {
        const contract = getContractFromRef(v.linked_ref);
        if (contract && custs[contract.customerId]) {
          custs[contract.customerId].p += v.amount;
          custs[contract.customerId].u.add(contract.unitId);
        }
      });
      rows = Object.values(custs).map(c => [c.name, c.u.size, egp(c.p)]);
      break;
    case 'inst_due':
      title='تقرير الأقساط المستحقة'; headers=['الوحدة','العميل','المبلغ','تاريخ الاستحقاق'];
      let inst=state.installments.filter(i=>i.status!=='مدفوع');
      if(from) inst=inst.filter(i=>i.dueDate>=from); if(to) inst=inst.filter(i=>i.dueDate<=to);
      rows=inst.map(i=>[getUnitDisplayName(unitById(i.unitId)),(custById(state.contracts.find(c=>c.unitId===i.unitId)?.customerId)||{}).name,egp(i.amount),i.dueDate]);
      break;
    case 'inst_overdue':
      title='تقرير الأقساط المتأخرة فقط';
      headers=['الوحدة', 'العميل', 'المبلغ', 'تاريخ الاستحقاق', 'أيام التأخير'];
      const todayDate = new Date();
      todayDate.setHours(0,0,0,0);
      let overdueInst = state.installments.filter(i => {
          return i.status !== 'مدفوع' && i.dueDate && new Date(i.dueDate) < todayDate;
      });
      if (from) overdueInst = overdueInst.filter(i => i.dueDate >= from);
      if (to) overdueInst = overdueInst.filter(i => i.dueDate <= to);
      rows = overdueInst.map(i => {
        const delay = Math.floor((todayDate - new Date(i.dueDate)) / (1000 * 60 * 60 * 24));
        return [
          getUnitDisplayName(unitById(i.unitId)),
          (custById(state.contracts.find(c=>c.unitId===i.unitId)?.customerId)||{}).name,
          egp(i.amount),
          i.dueDate,
          `${delay} يوم`
        ]
      });
      break;
    case 'payments_monthly':
      title='تقرير المدفوعات الشهرية'; headers=['الشهر','إجمالي المدفوعات'];
      let receiptVouchers = state.vouchers.filter(v => v.type === 'receipt');
      if(from) receiptVouchers = receiptVouchers.filter(v => v.date >= from);
      if(to) receiptVouchers = receiptVouchers.filter(v => v.date <= to);

      const months={};
      receiptVouchers.forEach(v => {
        const ym = v.date.slice(0,7);
        months[ym] = (months[ym] || 0) + Number(v.amount || 0);
      });
      const reportData = Object.keys(months).sort().map(k => ({month: k, total: months[k]}));
      rows = reportData.map(r => [r.month, egp(r.total)]);

      lastReportData = { title, headers, rows: reportData.map(r=>[r.month, r.total]) }; // Store raw data for charting
      const bodyHTML=`<canvas id="reportChart" height="150"></canvas><hr><h1>${title}</h1>`+table(headers,rows);
      out.innerHTML=bodyHTML + `<div class="tools"><button class="btn" onclick="printLastReport()">طباعة PDF</button></div>`;

      // Render chart
      new Chart(document.getElementById('reportChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: reportData.map(r => r.month),
          datasets: [{
            label: 'إجمالي المدفوعات',
            data: reportData.map(r => r.total),
            backgroundColor: '#16a34a',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: value => egp(value).replace('ج.م', '') } } }
        }
      });
      return; // Exit here as we manually set innerHTML
    case 'partner_summary':
      title = 'ملخص أرباح الشركاء';
      headers = ['الشريك', 'إجمالي الدخل', 'إجمالي المصروفات', 'صافي الربح'];
      let summary = {};
      state.partners.forEach(p => {
        summary[p.id] = { name: p.name, income: 0, expense: 0 };
      });

      let vouchersForSummary = state.vouchers.slice();
      if(from) vouchersForSummary = vouchersForSummary.filter(v => v.date >= from);
      if(to) vouchersForSummary = vouchersForSummary.filter(v => v.date <= to);

      vouchersForSummary.forEach(v => {
        const contract = getContractFromRef(v.linked_ref);
        if (!contract) return;

        const unitPartners = state.unitPartners.filter(up => up.unitId === contract.unitId);
        if (unitPartners.length === 0) return;

        unitPartners.forEach(link => {
          if (summary[link.partnerId]) {
            const share = link.percent / 100;
            if (v.type === 'receipt') {
              summary[link.partnerId].income += v.amount * share;
            } else if (v.type === 'payment') {
              // We only count expenses that are linked to units, like commissions.
              if (v.description.includes('عمولة') || v.description.includes('صيانة')) {
                 summary[link.partnerId].expense += v.amount * share;
              }
            }
          }
        });
      });

      rows = Object.values(summary).map(s => [
        s.name,
        egp(s.income),
        egp(s.expense),
        egp(s.income - s.expense)
      ]);
      break;
    case 'partner_profits':
      title='تقرير أرباح الشركاء'; headers=['الشريك','الوحدة','إجمالي الدفعة','نسبة الشريك','ربح الشريك'];
      let receiptVouchersForProfit = state.vouchers.filter(v => v.type === 'receipt');
      if(from) receiptVouchersForProfit = receiptVouchersForProfit.filter(v => v.date >= from);
      if(to) receiptVouchersForProfit = receiptVouchersForProfit.filter(v => v.date <= to);

      const partnerIdForProfit = document.getElementById('rep-partner-sel')?.value;

      receiptVouchersForProfit.forEach(v => {
        const contract = getContractFromRef(v.linked_ref);
        if (!contract) return;

        const links = state.unitPartners.filter(up => up.unitId === contract.unitId && (!partnerIdForProfit || up.partnerId === partnerIdForProfit));
        links.forEach(l => {
          const profit = Math.round((v.amount * l.percent / 100) * 100) / 100;
          rows.push([(partnerById(l.partnerId)||{}).name||'—', getUnitDisplayName(unitById(contract.unitId)), egp(v.amount), l.percent+'%', egp(profit)]);
        });
      });
      break;
    case 'partner_cashflow':
      title = 'تقرير ملخص تدفقات الشريك';
      headers = ['الشهر', 'إجمالي حصة الأرباح'];
      const partnerId = document.getElementById('rep-partner-sel')?.value;
      if (!partnerId) {
          out.innerHTML = '<p style=\"color:var(--warn)\">الرجاء اختيار شريك لعرض هذا التقرير.</p>';
          return;
      }
      const partner = partnerById(partnerId);
      title += ` - ${partner.name}`;

      let paysForPartner = state.vouchers.filter(v => v.type === 'receipt');
      if (from) paysForPartner = paysForPartner.filter(p => p.date >= from);
      if (to) paysForPartner = paysForPartner.filter(p => p.date <= to);

      const monthlyProfits = {};
      paysForPartner.forEach(p => {
          const contract = getContractFromRef(p.linked_ref);
          if (!contract) return;
          const link = state.unitPartners.find(up => up.unitId === contract.unitId && up.partnerId === partnerId);
          if (link) {
              const profit = (p.amount * link.percent / 100);
              const month = p.date.slice(0, 7);
              monthlyProfits[month] = (monthlyProfits[month] || 0) + profit;
          }
      });

      rows = Object.keys(monthlyProfits).sort().map(month => [
          month,
          egp(monthlyProfits[month])
      ]);
      break;
    case 'cashflow':
      title='تقرير التدفقات النقدية العامة'; headers=['التاريخ','البيان','مدين','دائن','الرصيد'];
      let trans = state.vouchers.slice();
      if(from) trans = trans.filter(v => v.date >= from);
      if(to) trans = trans.filter(v => v.date <= to);

      trans.sort((a,b) => (a.date||'').localeCompare(b.date||''));
      let bal=0;
      rows=trans.map(t=>{
        const income = t.type === 'receipt' ? t.amount : 0;
        const outcome = t.type === 'payment' ? t.amount : 0;
        bal += Number(income) - Number(outcome);
        return [t.date, t.description, egp(income), egp(outcome), egp(bal)];
      });
      break;
  }
  lastReportData = { title, headers, rows };
  const bodyHTML=`<h1>${title}</h1>`+table(headers,rows);
  out.innerHTML=bodyHTML + `<div class="tools"><button class="btn" onclick="printLastReport()">طباعة PDF</button></div>`;
};
function printLastReport() {
    if (lastReportData) {
        const {title, headers, rows} = lastReportData;
        const head = `<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;
        const body = `<tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
        printHTML(title, `<h1>${title}</h1><table><thead>${head}</thead>${body}</table>`);
    } else {
        alert('لا توجد بيانات تقرير للطباعة. يرجى إنشاء تقرير أولاً.');
    }
}

/* ===== التحويلات بين الخزن ===== */
function renderTransfers(){
  const safeById = (id) => state.safes.find(s => s.id === id);
  const safeName = (id) => (safeById(id) || {}).name || '—';

  function draw(){
    const rows = state.transfers.map(t => [
      safeName(t.fromSafeId),
      safeName(t.toSafeId),
      egp(t.amount),
      t.date,
      t.notes || '—'
    ]).reverse();
    document.getElementById('t-list').innerHTML = table(['من خزنة', 'إلى خزنة', 'المبلغ', 'التاريخ', 'ملاحظات'], rows);
  }

  const safeOptions = state.safes.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');

  view.innerHTML = `
  <div class="grid grid-2">
    <div class="card">
      <h3>تسجيل تحويل</h3>
      <div class="grid grid-2" style="gap:10px;">
        <select class="select" id="t-from"><option value="">من خزنة...</option>${safeOptions}</select>
        <select class="select" id="t-to"><option value="">إلى خزنة...</option>${safeOptions}</select>
      </div>
      <input class="input" id="t-amount" type="number" placeholder="المبلغ" style="margin-top:10px;">
      <input class="input" id="t-date" type="date" value="${today()}" style="margin-top:10px;">
      <textarea class="input" id="t-notes" placeholder="ملاحظات" style="margin-top:10px;" rows="2"></textarea>
      <button class="btn" style="margin-top:10px;" onclick="addTransfer()">تنفيذ التحويل</button>
    </div>
    <div class="card">
      <h3>سجل التحويلات</h3>
      <div id="t-list"></div>
    </div>
  </div>
  `;

  window.addTransfer = () => {
    const fromSafeId = document.getElementById('t-from').value;
    const toSafeId = document.getElementById('t-to').value;
    const amount = parseNumber(document.getElementById('t-amount').value);
    const date = document.getElementById('t-date').value;
    const notes = document.getElementById('t-notes').value.trim();

    if (!fromSafeId || !toSafeId || !amount) {
      return alert('الرجاء ملء جميع الحقول: من خزنة، إلى خزنة، والمبلغ.');
    }
    if (fromSafeId === toSafeId) {
      return alert('لا يمكن التحويل إلى نفس الخزنة.');
    }
    if (amount <= 0) {
      return alert('الرجاء إدخال مبلغ صحيح للتحويل.');
    }

    const fromSafe = safeById(fromSafeId);
    const toSafe = safeById(toSafeId);

    if (!fromSafe || !toSafe) {
      return alert('لم يتم العثور على الخزن المحددة.');
    }
    if (fromSafe.balance < amount) {
      return alert(`رصيد الخزنة "${fromSafe.name}" غير كافٍ. الرصيد الحالي: ${egp(fromSafe.balance)}`);
    }

    saveState();

    // Perform the transfer
    fromSafe.balance -= amount;
    toSafe.balance += amount;

    // Record the transaction
    const newTransfer = {
      id: uid('T'),
      fromSafeId,
      toSafeId,
      amount,
      date,
      notes
    };
    logAction('تنفيذ تحويل بين الخزن', newTransfer);
    state.transfers.push(newTransfer);

    persist();
    alert('تم تنفيذ التحويل بنجاح!');
    nav('transfers'); // Refresh the view
  };

  draw();
}

/* ===== سجل التغييرات ===== */
function renderAuditLog(){
  let currentLogs = [];
  view.innerHTML = `
    <div class="card">
      <h3>سجل تتبع التغييرات</h3>
      <p>يعرض هذا السجل آخر 500 إجراء تم في النظام.</p>
      <div class="tools">
        <input class="input" id="al-q" placeholder="بحث بالوصف..." oninput="draw()" style="flex:1;">
        <input type="date" class="input" id="al-from" oninput="draw()">
        <input type="date" class="input" id="al-to" oninput="draw()">
        <button class="btn secondary" onclick="expAuditLog()">تصدير CSV</button>
      </div>
      <div id="audit-list" style="margin-top:12px;"></div>
    </div>
  `;

  function draw() {
    const q = (document.getElementById('al-q')?.value || '').trim().toLowerCase();
    const from = document.getElementById('al-from')?.value;
    const to = document.getElementById('al-to')?.value;

    let logs = state.auditLog.slice(-500).reverse();

    if (q) {
      logs = logs.filter(log => (log.description || '').toLowerCase().includes(q));
    }
    if (from) {
      logs = logs.filter(log => log.timestamp.slice(0, 10) >= from);
    }
    if (to) {
      logs = logs.filter(log => log.timestamp.slice(0, 10) <= to);
    }

    currentLogs = logs;

    const rows = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleString('ar-EG');
      return [
        time,
        log.description,
        `<pre style="white-space:pre-wrap;font-size:11px;max-width:400px;word-break:break-all;">${JSON.stringify(log.details, null, 2)}</pre>`
      ];
    });

    document.getElementById('audit-list').innerHTML = table(['الوقت والتاريخ', 'الإجراء', 'التفاصيل'], rows);
  }

  window.expAuditLog = () => {
      const headers = ['Timestamp', 'Action', 'Details'];
      const rows = currentLogs.map(log => [log.timestamp, log.description, JSON.stringify(log.details)]);
      exportCSV(headers, rows, 'audit_log.csv');
  };

  draw();
}

/* ===== نسخة احتياطية ===== */
function renderBackup(){
  view.innerHTML=`
    <div class="card">
      <h3>نسخة احتياطية</h3>
      <p>يتم حفظ بياناتك في متصفحك. قم بتنزيل نسخة احتياطية بشكل دوري.</p>
      <div class="tools">
        <button class="btn" onclick="doBackup()">تنزيل نسخة JSON</button>
        <label class="btn secondary">
          <input type="file" id="restore-file" accept=".json" style="display:none">
          استعادة نسخة JSON
        </label>
        <button class="btn ok" onclick="doExcelBackup()">تنزيل نسخة Excel</button>
        <label class="btn ok secondary">
          <input type="file" id="restore-excel-file" accept=".xlsx, .xls" style="display:none">
          استعادة نسخة Excel
        </label>
        <button class="btn warn" onclick="doReset()">مسح كل البيانات</button>
      </div>
    </div>`;
  window.doBackup=()=>{
    const data=JSON.stringify(state);
    const blob=new Blob([data],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`estate-backup-${today()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  document.getElementById('restore-file').onchange=(e)=>{
    const f=e.target.files[0]; if(!f) return;
    if(!confirm('سيتم استبدال كل البيانات الحالية. هل أنت متأكد؟')) return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        saveState();
        const restored=JSON.parse(String(r.result));
        Object.assign(state,restored);
        persist();
        alert('تمت الاستعادة بنجاح');
        nav('dash');
      }catch(err){ alert('ملف غير صالح'); }
    };
    r.readAsText(f);
  };
  window.doExcelBackup = function() {
    try {
        const wb = XLSX.utils.book_new();
        const dataMap = {
            'العملاء': state.customers,
            'الوحدات': state.units,
            'الشركاء': state.partners,
            'شركاءالوحدات': state.unitPartners,
            'العقود': state.contracts,
            'الأقساط': state.installments,
            'المدفوعات': state.payments,
            'الإعدادات': [state.settings]
        };

        for (const sheetName in dataMap) {
            if (dataMap[sheetName] && dataMap[sheetName].length > 0) {
                const ws = XLSX.utils.json_to_sheet(dataMap[sheetName]);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            }
        }

        XLSX.writeFile(wb, `estate-backup-${today()}.xlsx`);
    } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء إنشاء ملف Excel.');
    }
  }
  window.doExcelRestore = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('سيتم استبدال كل البيانات الحالية ببيانات ملف Excel. هل أنت متأكد؟')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = event.target.result;
            const workbook = XLSX.read(data, { type: 'array' });

            saveState(); // Save current state for undo

            const newState = {
                customers: [], units: [], partners: [], unitPartners: [],
                contracts: [], installments: [], payments: [],
                settings: state.settings, // Keep existing settings
                locked: state.locked
            };

            workbook.SheetNames.forEach(sheetName => {
                const ws = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(ws);
                switch(sheetName) {
                    case 'العملاء': newState.customers = jsonData; break;
                    case 'الوحدات': newState.units = jsonData; break;
                    case 'الشركاء': newState.partners = jsonData; break;
                    case 'شركاءالوحدات': newState.unitPartners = jsonData; break;
                    case 'العقود': newState.contracts = jsonData; break;
                    case 'الأقساط': newState.installments = jsonData; break;
                    case 'المدفوعات': newState.payments = jsonData; break;
                    case 'الإعدادات': if (jsonData[0]) Object.assign(newState.settings, jsonData[0]); break;
                }
            });

            Object.keys(state).forEach(key => delete state[key]);
            Object.assign(state, newState);
            persist();
            alert('تمت استعادة البيانات من ملف Excel بنجاح.');
            nav('dash');

        } catch (err) {
            console.error(err);
            alert('ملف Excel غير صالح أو حدث خطأ أثناء القراءة.');
        }
    };
    reader.readAsArrayBuffer(file);
  }
  document.getElementById('restore-excel-file').onchange = window.doExcelRestore;
  window.doReset=()=>{
    if(prompt('اكتب "مسح" لتأكيد حذف كل البيانات')==='مسح'){
      saveState();
      localStorage.removeItem(APPKEY);
      location.reload();
    }
  };
}

/* ===== عرض تفاصيل العقد ===== */
window.openContractDetails = function(id) {
    const ct = state.contracts.find(c => c.id === id);
    if (!ct) {
        alert('لم يتم العثور على العقد');
        return nav('contracts');
    }

    const unit = unitById(ct.unitId);
    const customer = custById(ct.customerId);

    const insts = state.installments.filter(i => i.unitId === ct.unitId).sort((a,b) => (a.dueDate||'').localeCompare(b.dueDate||''));
    const instRows = insts.map(i => {
      const paidSoFar = state.payments.filter(p => p.installmentId === i.id).reduce((sum, p) => sum + (p.amount || 0), 0);
      return `<tr>
        <td>${i.type || ''}</td>
        <td>${egp(i.originalAmount ?? i.amount)}</td>
        <td>${egp(i.amount)}</td>
        <td>${egp(paidSoFar)}</td>
        <td>${i.dueDate || ''}</td>
        <td>${i.paymentDate || ''}</td>
        <td>${i.status || ''}</td>
      </tr>`;
    }).join('');

    const pays = state.payments.filter(p => p.unitId === ct.unitId).sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const payRows = pays.map(p => `<tr>
        <td>${egp(p.amount)}</td>
        <td>${p.method||'—'}</td>
        <td>${p.date||'—'}</td>
        <td>${p.installmentId ? 'قسط' : 'يدوي'}</td>
      </tr>`).join('');

    const html = `
        <div class="card">
            <div class="header">
                <h1>تفاصيل العقد — ${ct.code}</h1>
                <button class="btn secondary" onclick="nav('contracts')">⬅️ العودة إلى العقود</button>
            </div>
            <div class="grid grid-2" style="margin-top:12px; align-items: flex-start;">
                <div class="card">
                    <h3>بيانات العقد</h3>
                    <table>
                        <tr><th>العميل</th><td>${customer?.name || '—'} (${customer?.phone || '—'})</td></tr>
                        <tr><th>الوحدة</th><td>${unit?.code || '—'} (${unit?.name || '—'})</td></tr>
                        <tr><th>السعر الكلي</th><td>${egp(ct.totalPrice)}</td></tr>
                        <tr><th>الخصم</th><td style="color:var(--ok);">${egp(ct.discountAmount || 0)}</td></tr>
                        <tr><th>رسوم الصيانة</th><td>${egp(ct.maintenanceAmount || 0)}</td></tr>
                        <tr><th>المبلغ بعد التعديل</th><td style="font-weight:bold">${egp((ct.totalPrice - (ct.discountAmount||0)) + (ct.maintenanceAmount||0))}</td></tr>
                        <tr><th>المقدم</th><td>${egp(ct.downPayment)}</td></tr>
                        <tr><th>عمولة السمسار</th><td>${egp(ct.brokerAmount || 0)} (${ct.brokerPercent || 0}%)</td></tr>
                        <tr><th>نظام الأقساط</th><td>${ct.type} × ${ct.count} + ${ct.extraAnnual} سنوية</td></tr>
                        <tr><th>تاريخ البدء</th><td>${ct.start}</td></tr>
                    </table>
                </div>
                <div class="card">
                    <h3>ملخص مالي للوحدة</h3>
                    <table>
                      <tr><th>إجمالي المتبقي من سعر الوحدة</th><td style="font-weight:bold">${egp(calcRemaining(unit))}</td></tr>
                      <tr><th>إجمالي الأقساط المتبقية</th><td>${egp(insts.reduce((s,i)=>s+(i.amount||0),0))}</td></tr>
                      <tr><th>إجمالي المدفوعات المسجلة</th><td>${egp(pays.reduce((s,p)=>s+(p.amount||0),0))}</td></tr>
                    </table>
                </div>
            </div>

            <h3 style="margin-top:16px;">جدول الأقساط</h3>
            <div style="max-height: 300px; overflow-y: auto;">
              <table class="table">
                <thead><tr><th>النوع</th><th>المبلغ الأصلي</th><th>المتبقي</th><th>المسدد</th><th>الاستحقاق</th><th>تاريخ السداد</th><th>الحالة</th></tr></thead>
                <tbody>${instRows.length ? instRows : '<tr><td colspan="7">لا توجد أقساط</td></tr>'}</tbody>
              </table>
            </div>

            <h3 style="margin-top:16px;">سجل المدفوعات</h3>
            <div style="max-height: 300px; overflow-y: auto;">
              <table class="table">
                <thead><tr><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th><th>المصدر</th></tr></thead>
                <tbody>${payRows.length ? payRows : '<tr><td colspan="4">لا توجد مدفوعات</td></tr>'}</tbody>
              </table>
            </div>
        </div>
    `;

    view.innerHTML = html;
};


/* ===== Undo/Redo Keyboard Shortcuts ===== */
document.addEventListener('keydown', (e) => {
    // Do not interfere with text input fields' native undo/redo
    const targetNode = e.target.nodeName.toLowerCase();
    if (targetNode === 'input' || targetNode === 'textarea' || e.target.isContentEditable) {
      return;
    }

    if (e.ctrlKey) {
        if (e.key === 'z') {
            e.preventDefault();
            undo();
        } else if (e.key === 'y') {
            e.preventDefault();
            redo();
        }
    }
});
