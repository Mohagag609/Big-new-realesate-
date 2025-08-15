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
        if (u.totalPrice && !u.plans) {
          u.plans = [{ id: uid('PL'), name: 'السعر الافتراضي', price: u.totalPrice }];
        }
        if (u.hasOwnProperty('totalPrice')) {
          delete u.totalPrice;
        }
        u.plans = u.plans || [];
      });
    }

    // Data migration for contracts
    if (s.contracts && s.contracts.length > 0) {
      s.contracts.forEach(c => {
        c.maintenancePercent = c.maintenancePercent || 0;
        c.maintenanceAmount = c.maintenanceAmount || 0;
        c.commissionSafeId = c.commissionSafeId || null;
        c.discountAmount = c.discountAmount || 0;
        c.planName = c.planName || 'السعر الافتراضي';
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

    return {
      customers:[],units:[],partners:[],unitPartners:[],contracts:[],installments:[],payments:[],partnerDebts:[], safes: [], transfers: [], auditLog: [],
      settings:{theme:'dark',font:16},locked:false,
      ...s
    };
  }catch{
    return {customers:[],units:[],partners:[],unitPartners:[],contracts:[],installments:[],payments:[],partnerDebts:[],
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
  {id:'customers',title:'العملاء',render:renderCustomers, tab: true},
  {id:'units',title:'الوحدات',render:renderUnits, tab: true},
  {id:'contracts',title:'العقود',render:renderContracts, tab: true},
  {id:'installments',title:'الأقساط',render:renderInstallments, tab: true},
  {id:'payments',title:'المدفوعات',render:renderPayments, tab: true},
  {id:'partners',title:'الشركاء',render:renderPartners, tab: true},
  {id:'treasury',title:'الخزينة',render:renderTreasury, tab: true},
  {id:'reports',title:'التقارير',render:renderReports, tab: true},
  {id:'partner-debts',title:'ديون الشركاء',render:renderPartnerDebts, tab: true},
  {id:'safes', title:'إدارة الخزن', render:renderSafes, tab: true},
  {id:'transfers', title: 'التحويلات', render: renderTransfers, tab: true},
  {id:'audit', title: 'سجل التغييرات', render: renderAuditLog, tab: true},
  {id:'backup',title:'نسخة احتياطية',render:renderBackup, tab: true},
  {id:'unit-details', title:'تفاصيل الوحدة', render:renderUnitDetails, tab: false},
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


function generatePartnerLedger(partnerId) {
    const transactions = [];

    // 1. Income from customer payments
    state.payments.forEach(p => {
        const unitPartners = state.unitPartners.filter(up => up.unitId === p.unitId);
        if (unitPartners.length === 0) return;

        const partnerLink = unitPartners.find(up => up.partnerId === partnerId);
        if (partnerLink) {
            const income = p.amount * (partnerLink.percent / 100);
            transactions.push({
                date: p.date,
                description: `حصيلة دفعة للوحدة ${unitCode(p.unitId)}`,
                income: income,
                expense: 0
            });
        }
    });

    // 2. Income from down payments and expenses from contracts
    state.contracts.forEach(c => {
        const unitPartners = state.unitPartners.filter(up => up.unitId === c.unitId);
        if (unitPartners.length === 0) return;

        const partnerLink = unitPartners.find(up => up.partnerId === partnerId);
        if (partnerLink) {
            if (c.downPayment > 0) {
                const income = c.downPayment * (partnerLink.percent / 100);
                transactions.push({
                    date: c.start,
                    description: `حصيلة مقدم العقد للوحدة ${unitCode(c.unitId)}`,
                    income: income,
                    expense: 0
                });
            }
            if (c.brokerAmount > 0) {
                const expense = c.brokerAmount * (partnerLink.percent / 100);
                transactions.push({
                    date: c.start,
                    description: `عمولة سمسار للوحدة ${unitCode(c.unitId)}`,
                    income: 0,
                    expense: expense
                });
            }
        }
    });

    // 3. Income/Expense from inter-partner debts
    state.partnerDebts.forEach(d => {
        if (d.status !== 'مدفوع') return;

        if (d.owedPartnerId === partnerId) { // This partner received money
            transactions.push({
                date: d.paymentDate,
                description: `تحصيل دين من ${partnerById(d.payingPartnerId)?.name || 'شريك'}`,
                income: d.amount,
                expense: 0
            });
        }
        if (d.payingPartnerId === partnerId) { // This partner paid money
            transactions.push({
                date: d.paymentDate,
                description: `سداد دين إلى ${partnerById(d.owedPartnerId)?.name || 'شريك'}`,
                income: 0,
                expense: d.amount
            });
        }
    });

    // 4. Sort transactions by date
    return transactions.sort((a,b) => (a.date||'').localeCompare(b.date||''));
}

/* ===== لوحة التحكم ===== */
function renderDash(){
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
        const searchable = `${u.code||''} ${u.name||''} ${u.floor||''} ${u.building||''} ${u.status||''} ${u.area||''}`.toLowerCase();
        return searchable.includes(q);
      });
    }
    list.sort((a,b)=>{
      const priceA = (a.plans && a.plans[0]) ? a.plans[0].price : 0;
      const priceB = (b.plans && b.plans[0]) ? b.plans[0].price : 0;
      const colsA=[a.code||'', a.name||'', String(priceA), a.area||'', a.floor||'', a.building||'', a.status||''];
      const colsB=[b.code||'', b.name||'', String(priceB), b.area||'', b.floor||'', b.building||'', b.status||''];
      return (colsA[sort.idx]+'').localeCompare(colsB[sort.idx]+'')*(sort.dir==='asc'?1:-1);
    });
    const rows=list.map(u=> {
      let actions = `<button class="btn" onclick="nav('unit-details', '${u.id}')">إدارة</button>`;
      if (u.status === 'مباعة') {
        actions += ` <button class="btn gold" style="margin-right: 5px;" onclick="startReturnProcess('${u.id}')">إرجاع وشراء</button>`;
      }
      const defaultPrice = (u.plans && u.plans[0]) ? u.plans[0].price : 0;
      return [
        `<span contenteditable="true" onblur="inlineUpd('units','${u.id}','code',this.textContent)">${u.code||''}</span>`,
        `<span contenteditable="true" onblur="inlineUpd('units','${u.id}','name',this.textContent)">${u.name||''}</span>`,
        `<span>${egp(defaultPrice)}</span>`, // Not editable from this main view
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
      table(['الكود','اسم الوحدة','السعر المبدئي','المساحة','الدور','البرج','المتبقي','الحالة','ملاحظات','إجراءات',''], rows, sort, ns=>{sort=ns;draw();});
  }

  view.innerHTML=`
  <div class="grid">
    <div class="card">
      <h3>إضافة وحدة</h3>
      <div class="grid grid-4">
        <input class="input" id="u-code" placeholder="كود/اسم مختصر">
        <input class="input" id="u-name" placeholder="اسم الوحدة">
        <input class="input" id="u-area" placeholder="المساحة (م²)">
        <input class="input" id="u-floor" placeholder="رقم الدور">
        <input class="input" id="u-building" placeholder="البرج/العمارة">
        <select class="select" id="u-status"><option value="متاحة">متاحة</option><option value="محجوزة">محجوزة</option><option value="مباعة">مباعة</option><option value="مرتجعة">مرتجعة</option></select>
      </div>
       <div class="card" style="margin-top:10px;">
         <h4>خطة السعر الافتراضية</h4>
         <div class="grid grid-2">
            <input class="input" id="u-plan-name" placeholder="اسم الخطة (eg. كاش)" value="السعر الافتراضي">
            <input class="input" id="u-plan-price" placeholder="السعر" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
         </div>
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
    const area=document.getElementById('u-area').value.trim();
    const floor=document.getElementById('u-floor').value.trim();
    const building=document.getElementById('u-building').value.trim();
    const notes=document.getElementById('u-notes').value.trim();

    const planName = document.getElementById('u-plan-name').value.trim();
    const planPrice = parseNumber(document.getElementById('u-plan-price').value);

    if (!code) {
        if (!building || !floor || !name) {
            return alert('لإنشاء كود تلقائي، الرجاء إدخال اسم الوحدة ورقم الدور والبرج.');
        }
        const san_b = building.replace(/\s/g, '');
        const san_f = floor.replace(/\s/g, '');
        const san_n = name.replace(/\s/g, '');
        code = `${san_b}-${san_f}-${san_n}`;
    }

    if(!planPrice || !planName) return alert('الرجاء إدخال تفاصيل خطة السعر الافتراضية.');

    if (state.units.some(u => u.code.toLowerCase() === code.toLowerCase())) {
        return alert('هذا الكود مستخدم بالفعل. الرجاء إدخال كود فريد.');
    }
    saveState();
    const newUnit = {
      id:uid('U'), code, name, status, area, floor, building, notes,
      plans: [{ id: uid('PL'), name: planName, price: planPrice }]
    };
    logAction('إضافة وحدة جديدة', { id: newUnit.id, code: newUnit.code });
    state.units.push(newUnit);
    persist();
    draw();
  };

  window.expUnits=()=>{
    const headers=['الكود','اسم الوحدة','السعر المبدئي','المساحة','الدور','البرج','الحالة','المتبقي','ملاحظات'];
    const rows=state.units.map(u=> {
      const defaultPrice = (u.plans && u.plans[0]) ? u.plans[0].price : 0;
      return [u.code,u.name||'',defaultPrice,u.area||'',u.floor||'',u.building||'',u.status,calcRemaining(u),u.notes||''];
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
        const [code,name,total,area,floor,building,status,notes]=line.split(',').map(x=>x?.replace(/^"|"$/g,'')||'');
        if(code) state.units.push({id:uid('U'),code,name,totalPrice:parseNumber(total),status:status||'متاحة',area,floor,building,notes});
      });
      persist(); draw();
    };
    r.readAsText(f,'utf-8');
  };

  window.printUnits=()=>{
    const headers=['الكود','اسم الوحدة','السعر','المساحة','الدور','البرج','الحالة','المتبقي'];
    const rows=state.units.map(u=>`<tr><td>${u.code}</td><td>${u.name||''}</td><td>${egp(u.totalPrice)}</td><td>${u.area||''}</td><td>${u.floor||''}</td><td>${u.building||''}</td><td>${u.status}</td><td>${egp(calcRemaining(u))}</td></tr>`).join('');
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

  function drawPlans(){
    const rows = u.plans.map(p => [
        `<span contenteditable="true" onblur="editPlanProp('${p.id}', 'name', this.textContent)">${p.name}</span>`,
        `<span contenteditable="true" onblur="editPlanProp('${p.id}', 'price', this.textContent, true)">${egp(p.price)}</span>`,
        `<button class="btn secondary" onclick="removePlanFromUnit('${p.id}')">حذف</button>`
    ]);
    document.getElementById('ud-plans-list').innerHTML = table(['اسم الخطة', 'السعر', ''], rows);
  }

  view.innerHTML = `
    <div class="card">
        <div class="header" style="justify-content: space-between;">
            <h1>إدارة الوحدة — ${u.code}</h1>
            <button class="btn secondary" onclick="nav('units')">⬅️ العودة للوحدات</button>
        </div>
        <p><b>اسم الوحدة:</b> ${u.name||'—'} | <b>البرج:</b> ${u.building||'—'} | <b>الدور:</b> ${u.floor||'—'}</p>

        <div class="grid grid-2" style="gap:16px; margin-top:16px; align-items:flex-start;">
            <div class="card">
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

            <div class="card">
                <h3>خطط الأسعار لهذه الوحدة</h3>
                <div id="ud-plans-list"></div>
                <hr>
                <h4>إضافة خطة سعر جديدة</h4>
                <div class="tools">
                    <input class="input" id="ud-plan-name" placeholder="اسم الخطة (مثلاً: كاش)">
                    <input class="input" id="ud-plan-price" type="number" placeholder="السعر">
                    <button class="btn" onclick="addPlanToUnit('${u.id}')">إضافة</button>
                </div>
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

  window.addPlanToUnit = (unitId) => {
    const name = document.getElementById('ud-plan-name').value.trim();
    const price = parseNumber(document.getElementById('ud-plan-price').value);
    if (!name || !price) return alert('الرجاء إدخال اسم وسعر الخطة.');
    const unit = unitById(unitId);
    if (!unit) return;
    if (unit.plans.some(p => p.name.toLowerCase() === name.toLowerCase())) return alert('خطة بنفس الاسم موجودة بالفعل.');

    saveState();
    const newPlan = { id: uid('PL'), name, price };
    logAction('إضافة خطة سعر لوحدة', { unitId, planName: name, price });
    unit.plans.push(newPlan);
    persist();
    drawPlans();
    document.getElementById('ud-plan-name').value = '';
    document.getElementById('ud-plan-price').value = '';
  };

  window.removePlanFromUnit = (planId) => {
    const plan = u.plans.find(p => p.id === planId);
    const unitId = u.id;
    if(confirm(`هل أنت متأكد من حذف خطة السعر "${plan.name}"؟`)){
      saveState();
      logAction('حذف خطة سعر من وحدة', { unitId, planId, deletedPlan: JSON.stringify(plan) });
      u.plans = u.plans.filter(p => p.id !== planId);
      persist();
      drawPlans();
    }
  };

  window.editPlanProp = (planId, key, value, isNumber = false) => {
    const plan = u.plans.find(p => p.id === planId);
    if (plan) {
      const oldValue = plan[key];
      const newValue = isNumber ? parseNumber(value) : value;
      saveState();
      logAction('تعديل خطة سعر', { unitId: u.id, planId, key, oldValue, newValue });
      plan[key] = newValue;
      persist();
      drawPlans();
    }
  };

  drawPartners();
  drawPlans();
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
    const rows=state.contracts.map(c=>[ c.code, unitCode(c.unitId), (custById(c.customerId)||{}).name||'—', c.planName || '—', egp(c.totalPrice), egp(c.maintenanceAmount||0), c.start, `<button class="btn" onclick="openContractDetails('${c.id}')">عرض</button> <button class="btn gold" onclick="editContract('${c.id}')">تعديل</button>`, `<button class="btn secondary" onclick="deleteContract('${c.id}')">حذف</button>` ]);
    document.getElementById('ct-list').innerHTML=table(['كود العقد','الوحدة','العميل','خطة السعر','السعر','قيمة الصيانة','تاريخ البدء','إجراءات',''], rows);
  }
  view.innerHTML=`
  <div class="grid">
    <div class="card">
      <h3>إضافة عقد</h3>
      <p style="font-size:13px; color:var(--muted);">اختر الوحدة أولاً لعرض خطط الأسعار المتاحة.</p>
      <div class="grid grid-4">
        <select class="select" id="ct-unit"><option value="">اختر الوحدة...</option>${state.units.filter(u=>u.status==='متاحة' || u.status ==='محجوزة').map(u=>`<option value="${u.id}">${u.code}</option>`).join('')}</select>
        <select class="select" id="ct-plan"><option value="">اختر خطة السعر...</option></select>
        <select class="select" id="ct-cust"><option value="">اختر العميل...</option>${state.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
        <input class="input" id="ct-total" placeholder="السعر الكلي" readonly style="background:var(--bg);">
        <input class="input" id="ct-down" placeholder="المقدم" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
        <input class="input" id="ct-discount" placeholder="مبلغ الخصم" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
        <input class="input" id="ct-brokerp" placeholder="نسبة العمولة %" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
        <input class="input" id="ct-maintp" placeholder="نسبة الصيانة %" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
        <select class="select" id="ct-safe"><option value="">اختر خزنة العمولة...</option>${state.safes.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
        <select class="select" id="ct-type"><option>شهري</option><option>ربع سنوي</option><option>نصف سنوي</option><option>سنوي</option></select>
        <input class="input" id="ct-count" placeholder="عدد الدفعات" oninput="this.value=this.value.replace(/[^\\d]/g,'')">
        <input class="input" id="ct-annual-bonus" placeholder="دفعات سنوية إضافية (0-3)" oninput="this.value=this.value.replace(/[^\\d]/g,'')">
        <input class="input" id="ct-start" type="date" value="${today()}">
      </div>
      <div style="color:var(--muted); font-size:12px; margin-top:4px; padding-right: 5px;">
        إجمالي عدد الأقساط: <span id="ct-total-installments" style="font-weight:bold;">0</span>
      </div>
      <div class="tools">
        <button class="btn" onclick="createContract()">حفظ + توليد أقساط</button>
        <button class="btn secondary" onclick="printContracts()">طباعة PDF</button>
      </div>
    </div>
    <div class="card">
      <h3>العقود</h3>
      <div id="ct-list"></div>
    </div>
  </div>`;

  window.createContract=()=>{
    const total=parseNumber(document.getElementById('ct-total').value), down=parseNumber(document.getElementById('ct-down').value);
    const discount = parseNumber(document.getElementById('ct-discount').value);
    const brokerP=parseNumber(document.getElementById('ct-brokerp').value);
    const brokerAmt=Math.round((total*brokerP/100)*100)/100;
    const commissionSafeId = document.getElementById('ct-safe').value;
    const planSelect = document.getElementById('ct-plan');
    const planName = planSelect.options[planSelect.selectedIndex]?.text;
    const planId = planSelect.value;

    if (brokerAmt > 0 && !commissionSafeId) {
      return alert('الرجاء تحديد الخزنة التي سيتم دفع العمولة منها.');
    }

    const safe = state.safes.find(s => s.id === commissionSafeId);
    if (brokerAmt > 0 && safe && safe.balance < brokerAmt) {
      return alert(`رصيد خزنة العمولة "${safe.name}" غير كافٍ. الرصيد الحالي: ${egp(safe.balance)}`);
    }

    saveState();
    const unitId=document.getElementById('ct-unit').value, customerId=document.getElementById('ct-cust').value;
    if(!unitId||!customerId||!planId) return alert('الرجاء اختيار الوحدة، وخطة السعر، والعميل.');

    const unitPartners = state.unitPartners.filter(up => up.unitId === unitId);
    const totalPercent = unitPartners.reduce((sum, p) => sum + Number(p.percent), 0);

    if (unitPartners.length === 0) {
      return alert('لا يمكن إنشاء عقد. يجب تحديد شركاء لهذه الوحدة أولاً من خلال شاشة "إدارة الوحدة".');
    }
    if (totalPercent !== 100) {
      return alert(`لا يمكن إنشاء عقد. مجموع نسب الشركاء هو ${totalPercent}% ويجب أن يكون 100% بالضبط.`);
    }

    const maintP=parseNumber(document.getElementById('ct-maintp').value);
    const type=document.getElementById('ct-type').value, count=parseInt(document.getElementById('ct-count').value||'0',10);
    const extra=parseInt(document.getElementById('ct-annual-bonus').value||'0',10);
    const startStr=document.getElementById('ct-start').value||today(); const start=new Date(startStr);
    if(count<=0) return alert('عدد الدفعات غير صالح');

    const maintAmt=Math.round((total*maintP/100)*100)/100;

    if (safe && brokerAmt > 0) {
      safe.balance -= brokerAmt;
    }

    const code='CTR-'+String(state.contracts.length+1).padStart(5,'0');
    const ct={id:uid('CT'), code, unitId, customerId, totalPrice:total, downPayment:down, discountAmount: discount, planId, planName, brokerPercent:brokerP, brokerAmount:brokerAmt, commissionSafeId, maintenancePercent: maintP, maintenanceAmount: maintAmt, type, count, extraAnnual:Math.min(Math.max(extra,0),3), start:startStr};
    logAction('إنشاء عقد جديد', { contractId: ct.id, unitId, customerId, price: total });
    state.contracts.push(ct);

    // توليد الأقساط
    const months={'شهري':1,'ربع سنوي':3,'نصف سنوي':6,'سنوي':12}[type]||1;
    const remain=Math.max(0, (total - discount - down) + maintAmt); // Installments cover remaining price + maintenance
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

    const u=unitById(unitId); if(u) u.status='مباعة';
    persist();
    draw();
    printContract(ct);
  };

  window.printContracts=()=>{
    const headers = ['الكود','الوحدة','العميل','خطة السعر','السعر','المقدم','عمولة','صيانة','نوع','عدد','بداية'];
    const rows=state.contracts.map(c=>`<tr><td>${c.code||''}</td><td>${unitCode(c.unitId)}</td><td>${(custById(c.customerId)||{}).name||'—'}</td><td>${c.planName||'—'}</td><td>${egp(c.totalPrice)}</td><td>${egp(c.downPayment)}</td><td>${egp(c.brokerAmount||0)} (${c.brokerPercent||0}%)</td><td>${egp(c.maintenanceAmount||0)} (${c.maintenancePercent||0}%)</td><td>${c.type}</td><td>${c.count}</td><td>${c.start}</td></tr>`).join('');
    printHTML('تقرير العقود', `<h1>تقرير العقود</h1><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`);
  };

  window.printContract=(ct)=>{
    const html=`<h1>عقد بيع — ${ct.code}</h1>
      <p>الوحدة: ${unitCode(ct.unitId)} — العميل: ${(custById(ct.customerId)||{}).name||'—'}</p>
      <table>
        <tr><th>خطة السعر</th><td>${ct.planName||'—'}</td></tr>
        <tr><th>السعر الكلي</th><td>${egp(ct.totalPrice)}</td></tr>
        <tr><th>الخصم</th><td style="color:var(--ok);">${egp(ct.discountAmount||0)}</td></tr>
        <tr><th>المقدم</th><td>${egp(ct.downPayment)}</td></tr>
        <tr><th>عمولة السمسار</th><td>${egp(ct.brokerAmount||0)} (${ct.brokerPercent||0}%)</td></tr>
        <tr><th>رسوم الصيانة</th><td>${egp(ct.maintenanceAmount||0)} (${ct.maintenancePercent||0}%)</td></tr>
        <tr><th>نظام الأقساط</th><td>${ct.type} × ${ct.count} + سنوية إضافية: ${ct.extraAnnual}</td></tr>
        <tr><th>بداية العقد</th><td>${ct.start}</td></tr>
      </table>`;
    printHTML('عقد بيع', html);
  };

  function updateTotalInstallments() {
    const countInput = document.getElementById('ct-count');
    const extraInput = document.getElementById('ct-annual-bonus');
    const totalDisplay = document.getElementById('ct-total-installments');
    if (!countInput || !extraInput || !totalDisplay) return;

    const count = parseInt(countInput.value || '0', 10);
    const extra = parseInt(extraInput.value || '0', 10);
    totalDisplay.textContent = count + extra;
  }

  document.getElementById('ct-count').oninput = updateTotalInstallments;
  document.getElementById('ct-annual-bonus').oninput = updateTotalInstallments;

  draw();
  updateTotalInstallments();
}

/* ===== الأقساط — إضافة عمود المسدد + منع التكرار في المدفوعات ===== */
function renderInstallments(){
  let sort = { idx: 4, dir: 'asc' };
  view.innerHTML = `
    <div class="card">
      <h3>الأقساط</h3>
      <div class="tools">
        <input class="input" id="i-q" placeholder="بحث بالوحدة/الشهر/الحالة" oninput="__inst_draw()">
        <button class="btn secondary" onclick="expInst()">CSV</button>
        <button class="btn" onclick="printInst()">طباعة PDF</button>
      </div>
      <div id="i-list"></div>
    </div>
  `;
  window.__inst_draw = function draw(){
    const q = (document.getElementById('i-q') && document.getElementById('i-q').value || '').trim().toLowerCase();
    let list = state.installments.slice();
    if(q){
      list = list.filter(i => {
        const searchable = `${unitCode(i.unitId)} ${i.status||''} ${i.dueDate||''}`.toLowerCase();
        return searchable.includes(q);
      });
    }
    list.sort((a,b)=>{
      const A = [
        unitCode(a.unitId),
        a.type || '',
        String((a.originalAmount != null ? a.originalAmount : a.amount) || 0),
        String(a.amount || 0),
        a.dueDate || '',
        a.paymentDate || '',
        a.status || ''
      ];
      const B = [
        unitCode(b.unitId),
        b.type || '',
        String((b.originalAmount != null ? b.originalAmount : b.amount) || 0),
        String(b.amount || 0),
        b.dueDate || '',
        b.paymentDate || '',
        b.status || ''
      ];
      return (A[sort.idx] + '').localeCompare(B[sort.idx] + '') * (sort.dir === 'asc' ? 1 : -1);
    });
    const headers = ['الوحدة','النوع','المبلغ','المتبقي','المسدد','الاستحقاق','السداد','الحالة','دفع','إعادة جدولة','تعديل','حذف'];
    const headHtml = headers.map((h,i)=>
      `<th data-idx="${i}" style="cursor:pointer;white-space:nowrap">${h}${sort.idx===i?(sort.dir==='asc'?' ▲':' ▼'):''}</th>`
    ).join('');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rowsHtml = list.map(i=>{
      let rowClass = '';
      if (i.status === 'مدفوع') {
        rowClass = 'paid';
      } else if (i.dueDate) {
        const dueDate = new Date(i.dueDate);
        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(today.getDate() + 7);
        if (dueDate < today) {
          rowClass = 'overdue';
        } else if (dueDate <= sevenDaysFromNow) {
          rowClass = 'due-soon';
        }
      }

      const isPaid = i.status === 'مدفوع';
      const original = egp(i.originalAmount != null ? i.originalAmount : i.amount);
      const remaining = egp(i.amount);
      const paidSoFar = state.payments.filter(p => p.installmentId === i.id).reduce((sum, p) => sum + (p.amount || 0), 0);
      const paidAmt = egp(paidSoFar);
      return `<tr class="${rowClass}">
        <td>${unitCode(i.unitId)}</td>
        <td>${i.type || ''}</td>
        <td>${original}</td>
        <td>${remaining}</td>
        <td>${paidAmt}</td>
        <td><span contenteditable="${!isPaid}" onblur="inlineUpd('installments','${i.id}','dueDate',this.textContent)">${i.dueDate || ''}</span></td>
        <td>${i.paymentDate || '—'}</td>
        <td><span contenteditable="${!isPaid}" onblur="inlineUpd('installments','${i.id}','status',this.textContent)">${i.status || 'غير مدفوع'}</span></td>
        <td><button class="btn ok" onclick="payInstallment('${i.id}', this)" ${isPaid ? 'disabled' : ''}>دفع</button></td>
        <td><button class="btn" onclick="reschedule('${i.id}')" ${isPaid ? 'disabled' : ''}>إعادة جدولة</button></td>
        <td><button class="btn gold" onclick="simpleEditInstallment('${i.id}')" ${isPaid ? 'disabled' : ''}>تعديل</button></td>
        <td><button class="btn secondary" onclick="delRow('installments','${i.id}')" ${isPaid ? 'disabled' : ''}>حذف</button></td>
      </tr>`;
    }).join('');
    document.getElementById('i-list').innerHTML =
      `<table class="table"><thead><tr>${headHtml}</tr></thead><tbody>${
        rowsHtml || `<tr><td colspan="12"><small>لا توجد بيانات</small></td></tr>`
      }</tbody></table>`;
    document.querySelectorAll('#i-list thead th').forEach(th=>{
      th.onclick = function(){
        const idx = Number(this.getAttribute('data-idx'));
        const dir = (sort.idx === idx && sort.dir === 'asc') ? 'desc' : 'asc';
        sort = { idx, dir };
        __inst_draw();
      };
    });
  };
  window.expInst = function(){
    const headers=['الوحدة','النوع','المبلغ','المتبقي','المسدد','الاستحقاق','السداد','الحالة'];
    const rows=state.installments.map(i=>[
      unitCode(i.unitId),
      i.type,
      (i.originalAmount != null ? i.originalAmount : i.amount),
      i.amount,
      Math.max(0,(i.originalAmount != null ? i.originalAmount : i.amount) - (i.amount||0)),
      i.dueDate||'',
      i.paymentDate||'',
      i.status||''
    ]);
    exportCSV(headers, rows, 'installments.csv');
  };
  window.printInst = function(){
    const rows=state.installments.map(i=>`
      <tr>
        <td>${unitCode(i.unitId)}</td>
        <td>${i.type || ''}</td>
        <td>${egp(i.originalAmount != null ? i.originalAmount : i.amount)}</td>
        <td>${egp(i.amount)}</td>
        <td>${egp(Math.max(0,(i.originalAmount != null ? i.originalAmount : i.amount) - (i.amount||0)))}</td>
        <td>${i.dueDate || ''}</td>
        <td>${i.paymentDate || ''}</td>
        <td>${i.status || ''}</td>
      </tr>`).join('');
    printHTML('تقرير الأقساط',
      `<h1>تقرير الأقساط</h1>
       <table>
         <thead><tr>
           <th>الوحدة</th><th>النوع</th><th>المبلغ</th><th>المتبقي</th><th>المسدد</th><th>الاستحقاق</th><th>السداد</th><th>الحالة</th>
         </tr></thead>
         <tbody>${rows}</tbody>
       </table>`);
  };
  window.payInstallment = function(id, btn){
    if (btn) btn.disabled = true;
    try {
      const i = state.installments.find(x=>x.id===id);
      if(!i || i.status==='مدفوع' || i.amount<=0) {
          alert('هذا القسط غير صالح للدفع.');
          return;
      }

      const safeId = prompt(`اختر خزنة للدفع:\n${state.safes.map((s,idx)=>`${idx+1}: ${s.name}`).join('\n')}`, '1');
      if (!safeId) return; // User cancelled
      const selectedSafe = state.safes[parseInt(safeId, 10)-1];
      if (!selectedSafe) {
        alert('اختيار غير صالح.');
        return;
      }

      const paid = Number(prompt('المبلغ المدفوع:', i.amount) || 0);
      if(!(paid>0)) return;

      saveState();
      if (processPayment(i.unitId, paid, 'قسط', today(), selectedSafe.id, i.id)) {
        persist();
        __inst_draw();
      } else {
        undo();
      }
    } finally {
        if (btn) setTimeout(() => { btn.disabled = false; }, 200);
    }
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

/* ===== المدفوعات ===== */
function renderPayments(){
  const safeById = (id) => state.safes.find(s => s.id === id);
  const safeName = (id) => (safeById(id) || {}).name || '—';

  function draw(){
    const q=(document.getElementById('p-q')?.value || '').trim().toLowerCase();
    let list=state.payments.slice().reverse();
    if(q) {
      list=list.filter(p=> {
        const searchable = `${unitCode(p.unitId)} ${p.method||''} ${p.date||''} ${safeName(p.safeId)}`.toLowerCase();
        return searchable.includes(q);
      });
    }
    const rows=list.map(p=>[
      unitCode(p.unitId),
      egp(p.amount),
      p.method||'—',
      safeName(p.safeId),
      p.date||'—',
      (p.installmentId?'<span class="badge info">من قسط</span>':'<span class="badge secondary">يدوي</span>'),
      `<button class="btn" onclick='printHTML("إيصال دفع", "<h1>إيصال دفع</h1><p>الوحدة: ${unitCode(p.unitId)}</p><p>المبلغ: ${egp(p.amount)}</p><p>الطريقة: ${p.method||"—"}</p><p>الخزنة: ${safeName(p.safeId)}</p><p>التاريخ: ${p.date||"—"}</p>")'>إيصال</button>` +
      (p.installmentId ? '' : ` <button class="btn secondary" onclick="deletePayment('${p.id}')">حذف</button>`)
    ]);
    document.getElementById('p-list').innerHTML=table(['الوحدة','المبلغ','الطريقة','الخزنة','التاريخ','مصدر',''], rows);
  }

  view.innerHTML=`
  <div class="grid grid-2">
    <div class="card">
      <h3>إضافة دفعة</h3>
      <select class="select" id="p-safe" required><option value="">اختر الخزنة...</option>${state.safes.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
      <select class="select" id="p-unit" style="margin-top:8px"><option value="">الوحدة</option>${state.units.map(u=>`<option value="${u.id}">${u.code} - ${u.name||''}</option>`).join('')}</select>
      <input class="input" id="p-amount" placeholder="المبلغ" oninput="this.value=this.value.replace(/[^\\d.]/g,'')" style="margin-top:8px">
      <select class="select" id="p-method" style="margin-top:8px"><option value="نقدي">نقدي</option><option value="تحويل">تحويل</option><option value="قسط">قسط</option><option value="جزئي">جزئي</option></select>
      <div id="p-installments-container" style="display:none; margin-top: 8px;">
        <select class="select" id="p-installments"><option value="">اختر القسط المرتبط</option></select>
      </div>
      <input class="input" id="p-date" type="date" value="${today()}" style="margin-top:8px">
      <button class="btn" onclick="addPayment()" style="margin-top:8px">حفظ + إيصال</button>
    </div>
    <div class="card">
      <h3>المدفوعات</h3>
      <div class="tools">
        <input class="input" id="p-q" placeholder="بحث..." oninput="draw()">
        <button class="btn secondary" onclick="expPayments()">CSV</button>
        <button class="btn" onclick="printPayments()">طباعة PDF</button>
      </div>
      <div id="p-list"></div>
    </div>
  </div>`;

  function updateInstallmentSelector() {
      const unitId = document.getElementById('p-unit').value;
      const method = document.getElementById('p-method').value;
      const container = document.getElementById('p-installments-container');
      const select = document.getElementById('p-installments');
      const amountInput = document.getElementById('p-amount');

      if (unitId && (method === 'قسط' || method === 'جزئي')) {
          const unpaid = state.installments.filter(i => i.unitId === unitId && i.status !== 'مدفوع' && i.amount > 0);
          select.innerHTML = '<option value="">اختر القسط...</option>' + unpaid.map(i =>
              `<option value="${i.id}" data-amount="${i.amount}">قسط ${egp(i.amount)} - مستحق في ${i.dueDate}</option>`
          ).join('');
          select.onchange = () => {
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption && selectedOption.dataset.amount) {
              amountInput.value = selectedOption.dataset.amount;
            }
          };
          container.style.display = 'block';
      } else {
          container.style.display = 'none';
      }
  }

  document.getElementById('p-unit').onchange = updateInstallmentSelector;
  document.getElementById('p-method').onchange = updateInstallmentSelector;

  window.addPayment=()=>{
    const unitId=document.getElementById('p-unit').value;
    const amount=parseNumber(document.getElementById('p-amount').value);
    const method=document.getElementById('p-method').value;
    const date=document.getElementById('p-date').value||today();
    const installmentId = document.getElementById('p-installments').value;
    const safeId = document.getElementById('p-safe').value;

    if(!unitId||!(amount>0)) return alert('اختر وحدة واكتب مبلغ صحيح');
    if(!safeId) return alert('الرجاء اختيار الخزنة.');

    saveState();

    const isInstallmentPayment = (method === 'قسط' || method === 'جزئي') && installmentId;

    if (processPayment(unitId, amount, method, date, safeId, isInstallmentPayment ? installmentId : null)) {
      persist();
      draw();
      const safeName = (state.safes.find(s=>s.id===safeId)||{}).name||'—';
      printHTML('إيصال دفع', `<h1>إيصال دفع</h1><p>الوحدة: ${unitCode(unitId)}</p><p>المبلغ: ${egp(amount)}</p><p>الطريقة: ${method}</p><p>الخزنة: ${safeName}</p><p>التاريخ: ${date}</p>`);
    } else {
      undo();
    }
  };
  window.expPayments=()=>{
    exportCSV(['الوحدة','المبلغ','الطريقة','الخزنة','التاريخ','مصدر'], state.payments.map(p=>[unitCode(p.unitId),p.amount,p.method||'',safeName(p.safeId), p.date||'', p.installmentId?'قسط':'' ]), 'payments.csv');
  };
  window.printPayments=()=>{
    const rows=state.payments.map(p=>`<tr><td>${unitCode(p.unitId)}</td>
    <td>${egp(p.amount)}</td><td>${p.method||'—'}</td><td>${safeName(p.safeId)}</td><td>${p.date||'—'}</td></tr>`).join('');
    printHTML('تقرير المدفوعات', `<h1>تقرير المدفوعات</h1><table><thead><tr><th>الوحدة</th><th>المبلغ</th><th>الطريقة</th><th>الخزنة</th><th>التاريخ</th></tr></thead><tbody>${rows}</tbody></table>`);
  };
  window.deletePayment = function(id) {
      const payment = state.payments.find(p => p.id === id);
      if (!payment) return alert('لم يتم العثور على الدفعة.');
      if (payment.installmentId) {
          return alert('لا يمكن حذف دفعة مرتبطة بقسط. يرجى استخدام شاشة الأقساط.');
      }
      if (confirm(`هل أنت متأكد من حذف هذه الدفعة؟\nالمبلغ: ${egp(payment.amount)}\nالتاريخ: ${payment.date}`)) {
          saveState();
          // On deletion, we must also subtract the amount from the safe if possible
          if (payment.safeId) {
            const safe = safeById(payment.safeId);
            if (safe) {
              safe.balance = (safe.balance || 0) - payment.amount;
            }
          }
          state.payments = state.payments.filter(p => p.id !== id);
          persist();
          nav('payments');
      }
  }
  draw();
}

/* ===== الشركاء + ربطهم بالوحدات ===== */
function renderPartners(){
  view.innerHTML=`
  <div class="grid grid-2">
    <div class="card">
      <h3>إضافة شريك</h3>
      <input class="input" id="pr-name" placeholder="اسم الشريك">
      <input class="input" id="pr-phone" placeholder="الهاتف">
      <button class="btn" onclick="addPartner()">حفظ</button>
      <hr>
      <h3>ربط شريك بوحدة</h3>
      <select class="select" id="up-unit"><option>اختر وحدة</option>${state.units.map(u=>`<option value="${u.id}">${u.code} - ${u.name||''}</option>`).join('')}</select>
      <select class="select" id="up-partner"><option>اختر شريك</option>${state.partners.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select>
      <input class="input" id="up-percent" placeholder="النسبة %" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
      <button class="btn" onclick="addUnitPartner()">ربط</button>
    </div>
    <div class="card">
      <h3>الشركاء</h3>
      <div id="pr-list"></div>
      <hr>
      <h3>الوحدات المشتركة</h3>
      <div id="up-list"></div>
    </div>
  </div>`;
  window.addPartner=()=>{
    const name=document.getElementById('pr-name').value.trim(); if(!name) return;
    const phone = document.getElementById('pr-phone').value;
    saveState();
    const newPartner = {id:uid('PR'),name,phone};
    logAction('إضافة شريك جديد', { partnerId: newPartner.id, name });
    state.partners.push(newPartner);
    persist(); nav('partners');
  };
  window.addUnitPartner=()=>{
    const unitId=document.getElementById('up-unit').value, partnerId=document.getElementById('up-partner').value;
    const percent=parseNumber(document.getElementById('up-percent').value);
    if(!unitId||!partnerId||!percent) return;
    saveState();
    state.unitPartners.push({id:uid('UP'),unitId,partnerId,percent});
    persist(); nav('partners');
  };
  const prRows=state.partners.map(p=>[p.name,p.phone,`<button class="btn secondary" onclick="delRow('partners','${p.id}')">حذف</button>`]);
  document.getElementById('pr-list').innerHTML=table(['الاسم','الهاتف',''], prRows);
  const upRows=state.unitPartners.map(up=>[unitCode(up.unitId),(partnerById(up.partnerId)||{}).name||'—',up.percent+'%',`<button class="btn secondary" onclick="delRow('unitPartners','${up.id}')">حذف</button>`]);
  document.getElementById('up-list').innerHTML=table(['الوحدة','الشريك','النسبة',''], upRows);
}

let lastReportData = null;

/* ===== الخزينة ===== */
function renderTreasury() {
    view.innerHTML = `
        <div class="card">
            <h3>الخزينة</h3>
            <p>اختر شريكًا لعرض سجله المالي المفصل.</p>
            <div class="tools">
                <select class="select" id="treasury-partner-select" style="max-width: 300px;">
                    <option value="">اختر شريك...</option>
                    ${state.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
            <div id="treasury-ledger">
                <p style="color: var(--muted);">الرجاء اختيار شريك لعرض البيانات.</p>
            </div>
        </div>
    `;

    document.getElementById('treasury-partner-select').onchange = (e) => {
        const partnerId = e.target.value;
        const ledgerDiv = document.getElementById('treasury-ledger');
        if (!partnerId) {
            ledgerDiv.innerHTML = `<p style="color: var(--muted);">الرجاء اختيار شريك لعرض البيانات.</p>`;
            return;
        }

        const transactions = generatePartnerLedger(partnerId);
        if (transactions.length === 0) {
            ledgerDiv.innerHTML = `<p style="color: var(--muted);">لا توجد معاملات لهذا الشريك.</p>`;
            return;
        }

        let balance = 0;
        const rows = transactions.map(tx => {
            balance += (tx.income || 0) - (tx.expense || 0);
            return [
                tx.date,
                tx.description,
                `<span style="color:var(--ok)">${tx.income ? egp(tx.income) : '—'}</span>`,
                `<span style="color:var(--warn)">${tx.expense ? egp(tx.expense) : '—'}</span>`,
                `<strong style="color:var(--brand)">${egp(balance)}</strong>`
            ];
        });

        const headers = ['التاريخ', 'الوصف', 'الدخل', 'المصروفات', 'الرصيد'];
        ledgerDiv.innerHTML = table(headers, rows);
    };
}

/* ===== التقارير ===== */
function renderReports(){
  let selectedReportType = null;

  view.innerHTML=`
    <div class="card">
      <h3 style="margin-bottom:12px;">1. اختر نوع التقرير</h3>
      <div class="grid grid-3" style="gap: 12px; margin-bottom: 16px;">
        <div class="card">
            <h4 style="margin-top:0; margin-bottom:8px; border-bottom:1px solid var(--line); padding-bottom:4px;">تقارير مالية</h4>
            <div class="tools" style="flex-direction: column; gap: 8px; align-items: stretch;">
                <button class="btn gold report-btn" data-type="payments_monthly">مدفوعات شهرية</button>
                <button class="btn gold report-btn" data-type="cashflow">التدفقات النقدية العامة</button>
            </div>
        </div>
        <div class="card">
            <h4 style="margin-top:0; margin-bottom:8px; border-bottom:1px solid var(--line); padding-bottom:4px;">تقارير الشركاء</h4>
            <div class="tools" style="flex-direction: column; gap: 8px; align-items: stretch;">
                <button class="btn gold report-btn" data-type="partner_summary">ملخص أرباح الشركاء</button>
                <button class="btn gold report-btn" data-type="partner_profits">تفاصيل أرباح الشركاء</button>
                <button class="btn gold report-btn" data-type="partner_cashflow">ملخص تدفقات الشركاء</button>
            </div>
        </div>
        <div class="card">
            <h4 style="margin-top:0; margin-bottom:8px; border-bottom:1px solid var(--line); padding-bottom:4px;">تقارير المتابعة</h4>
            <div class="tools" style="flex-direction: column; gap: 8px; align-items: stretch;">
                <button class="btn gold report-btn" data-type="inst_due">كل الأقساط المستحقة</button>
                <button class="btn gold report-btn" data-type="inst_overdue">الأقساط المتأخرة فقط</button>
                <button class="btn gold report-btn" data-type="cust_activity">نشاط العملاء</button>
                <button class="btn gold report-btn" data-type="units_status">حالة الوحدات</button>
            </div>
        </div>
      </div>

      <h3 style="margin-bottom:12px;">2. حدد الفلاتر (اختياري)</h3>
      <div id="rep-filters-container" class="grid grid-4" style="gap:8px; align-items: end; margin-bottom: 16px;">
        <!-- Filters will be dynamically inserted here -->
      </div>

      <div class="tools">
        <button class="btn" id="generate-report-btn" style="flex:1; padding: 12px; font-size: 16px;">إنشاء التقرير</button>
        <button class="btn secondary" id="reset-filters-btn" style="padding: 12px; font-size: 16px;">مسح الفلتر</button>
      </div>
      <hr>
      <div id="rep-out"></div>
    </div>`;

  const filtersContainer = document.getElementById('rep-filters-container');

  document.querySelectorAll('.report-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.report-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedReportType = btn.dataset.type;

      // Dynamically render filters based on report type
      filtersContainer.innerHTML = ''; // Clear previous
      const needsDates = ['payments_monthly', 'cashflow', 'partner_profits', 'inst_due', 'inst_overdue', 'cust_activity', 'partner_cashflow'];
      const needsPartner = ['partner_profits', 'partner_cashflow'];

      if (needsDates.includes(selectedReportType)) {
        filtersContainer.innerHTML += `
            <input type="date" class="input" id="rep-from" placeholder="من تاريخ">
            <input type="date" class="input" id="rep-to" placeholder="إلى تاريخ">
        `;
      }
      if (needsPartner.includes(selectedReportType)) {
        filtersContainer.innerHTML += `
          <select id="rep-partner-sel" class="select">
              <option value="">اختر شريك...</option>
              ${state.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        `;
      }
    };
  });

  const generateBtn = document.getElementById('generate-report-btn');
  const resetBtn = document.getElementById('reset-filters-btn');

  function triggerReport() {
    if (selectedReportType) {
      runReport(selectedReportType);
    }
  }

  generateBtn.onclick = () => {
    if (!selectedReportType) {
      return alert('الرجاء اختيار نوع التقرير أولاً.');
    }
    triggerReport();
  };

  resetBtn.onclick = () => {
    filtersContainer.querySelectorAll('input, select').forEach(el => {
      el.value = '';
      el.onchange = null; // Clear old listeners
    });
    document.getElementById('rep-out').innerHTML = '';
  };

  // Attach dynamic listeners when filters are created
  const attachListeners = () => {
    filtersContainer.querySelectorAll('input, select').forEach(el => {
      el.onchange = triggerReport;
    });
  };

  document.querySelectorAll('.report-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.report-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedReportType = btn.dataset.type;

      // Dynamically render filters based on report type
      filtersContainer.innerHTML = ''; // Clear previous
      const needsDates = ['payments_monthly', 'cashflow', 'partner_profits', 'inst_due', 'inst_overdue', 'cust_activity', 'partner_cashflow', 'partner_summary'];
      const needsPartner = ['partner_profits', 'partner_cashflow', 'partner_summary'];

      if (needsDates.includes(selectedReportType)) {
        filtersContainer.innerHTML += `
            <input type="date" class="input" id="rep-from" placeholder="من تاريخ">
            <input type="date" class="input" id="rep-to" placeholder="إلى تاريخ">
        `;
      }
      if (needsPartner.includes(selectedReportType) && selectedReportType !== 'partner_summary') { // partner_summary is for all partners
        filtersContainer.innerHTML += `
          <select id="rep-partner-sel" class="select">
              <option value="">اختر شريك...</option>
              ${state.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        `;
      }
      // Attach listeners to the newly created filters
      attachListeners();
    };
  });
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
        const unit = unitCode(d.unitId) || '';
        const searchable = `${paying} ${owed} ${unit} ${d.status}`.toLowerCase();
        return searchable.includes(q);
      });
    }

    list.sort((a,b)=>{
      const pA = partnerById(a.payingPartnerId)?.name || '';
      const oA = partnerById(a.owedPartnerId)?.name || '';
      const uA = unitCode(a.unitId);
      const colsA = [pA, oA, uA, a.dueDate, a.amount, a.status];

      const pB = partnerById(b.payingPartnerId)?.name || '';
      const oB = partnerById(b.owedPartnerId)?.name || '';
      const uB = unitCode(b.unitId);
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
      const unit = unitCode(d.unitId);
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
  switch(type){
    case 'units_status':
      title='تقرير حالة الوحدات'; headers=['الحالة','العدد','إجمالي السعر'];
      const stats={}; state.units.forEach(u=>{ stats[u.status]=(stats[u.status]||{c:0,p:0}); stats[u.status].c++; stats[u.status].p+=Number(u.totalPrice||0); });
      rows=Object.keys(stats).map(k=>[k,stats[k].c,egp(stats[k].p)]);
      break;
    case 'cust_activity':
      title='تقرير نشاط العملاء'; headers=['العميل','عدد الوحدات','إجمالي المدفوعات'];
      const custs={}; state.contracts.forEach(c=>{ custs[c.customerId]=(custs[c.customerId]||{u:new Set(),p:0}); custs[c.customerId].u.add(c.unitId); });

      let custPays=state.payments.slice();
      if(from) custPays=custPays.filter(p=>p.date>=from);
      if(to) custPays=custPays.filter(p=>p.date<=to);
      custPays.forEach(p=>{
        const ct=state.contracts.find(c=>c.unitId===p.unitId);
        if(ct&&ct.customerId&&custs[ct.customerId]) custs[ct.customerId].p+=Number(p.amount||0);
      });
      rows=Object.keys(custs).map(k=>[(custById(k)||{}).name||k,custs[k].u.size,egp(custs[k].p)]);
      break;
    case 'inst_due':
      title='تقرير الأقساط المستحقة'; headers=['الوحدة','العميل','المبلغ','تاريخ الاستحقاق'];
      let inst=state.installments.filter(i=>i.status!=='مدفوع');
      if(from) inst=inst.filter(i=>i.dueDate>=from); if(to) inst=inst.filter(i=>i.dueDate<=to);
      rows=inst.map(i=>[unitCode(i.unitId),(custById(state.contracts.find(c=>c.unitId===i.unitId)?.customerId)||{}).name,egp(i.amount),i.dueDate]);
      break;
    case 'inst_overdue':
      title='تقرير الأقساط المتأخرة فقط';
      headers=['الوحدة', 'العميل', 'المبلغ', 'تاريخ الاستحقاق', 'أيام التأخير'];
      const today = new Date();
      today.setHours(0,0,0,0);
      let overdueInst = state.installments.filter(i => {
          return i.status !== 'مدفوع' && i.dueDate && new Date(i.dueDate) < today;
      });
      if (from) overdueInst = overdueInst.filter(i => i.dueDate >= from);
      if (to) overdueInst = overdueInst.filter(i => i.dueDate <= to);
      rows = overdueInst.map(i => {
        const delay = Math.floor((today - new Date(i.dueDate)) / (1000 * 60 * 60 * 24));
        return [
          unitCode(i.unitId),
          (custById(state.contracts.find(c=>c.unitId===i.unitId)?.customerId)||{}).name,
          egp(i.amount),
          i.dueDate,
          `${delay} يوم`
        ]
      });
      break;
    case 'payments_monthly':
      title='تقرير المدفوعات الشهرية'; headers=['الشهر','إجمالي المدفوعات'];
      let pays=state.payments.slice();
      if(from) pays=pays.filter(p=>p.date>=from); if(to) pays=pays.filter(p=>p.date<=to);
      const months={}; pays.forEach(p=>{ const ym=p.date.slice(0,7); months[ym]=(months[ym]||0)+Number(p.amount||0); });
      const reportData = Object.keys(months).sort().map(k=>({month: k, total: months[k]}));
      rows=reportData.map(r=>[r.month, egp(r.total)]);

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

      const transactions = [];
      state.payments.forEach(p => {
        if ((!from || p.date >= from) && (!to || p.date <= to)) {
            transactions.push({ type: 'payment', data: p });
        }
      });
       state.contracts.forEach(c => {
        if ((!from || c.start >= from) && (!to || c.start <= to)) {
            transactions.push({ type: 'contract', data: c });
        }
      });

      transactions.forEach(tx => {
        const item = tx.data;
        const unitId = item.unitId || (tx.type === 'contract' ? item.unitId : null);
        if (!unitId) return;

        const unitPartners = state.unitPartners.filter(up => up.unitId === unitId);
        unitPartners.forEach(link => {
          if (summary[link.partnerId]) {
            if (tx.type === 'payment') {
              summary[link.partnerId].income += item.amount * (link.percent / 100);
            } else if (tx.type === 'contract') {
              if (item.downPayment > 0) {
                summary[link.partnerId].income += item.downPayment * (link.percent / 100);
              }
              if (item.brokerAmount > 0) {
                summary[link.partnerId].expense += item.brokerAmount * (link.percent / 100);
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
      let partnerPays=state.payments.slice();
      if(from) partnerPays=partnerPays.filter(p=>p.date>=from); if(to) partnerPays=partnerPays.filter(p=>p.date<=to);
      const partnerIdForProfit = document.getElementById('rep-partner-sel')?.value;
      partnerPays.forEach(p=>{
        const links=state.unitPartners.filter(up=>up.unitId===p.unitId && (!partnerIdForProfit || up.partnerId === partnerIdForProfit));
        links.forEach(l=>{
          const profit=Math.round((p.amount*l.percent/100)*100)/100;
          rows.push([(partnerById(l.partnerId)||{}).name||'—',unitCode(p.unitId),egp(p.amount),l.percent+'%',egp(profit)]);
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

      let paysForPartner = state.payments.slice();
      if (from) paysForPartner = paysForPartner.filter(p => p.date >= from);
      if (to) paysForPartner = paysForPartner.filter(p => p.date <= to);

      const monthlyProfits = {};
      paysForPartner.forEach(p => {
          const link = state.unitPartners.find(up => up.unitId === p.unitId && up.partnerId === partnerId);
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
      let trans=[];
      let payFlow=state.payments.slice();
      if(from) payFlow=payFlow.filter(p=>p.date>=from); if(to) payFlow=payFlow.filter(p=>p.date<=to);
      payFlow.forEach(p=>trans.push({d:p.date,n:`دفعة وحدة ${unitCode(p.unitId)}`,i:p.amount,o:0}));

      state.contracts.forEach(c=>{
        if(c.brokerAmount > 0) {
          const include = (!from || c.start >= from) && (!to || c.start <= to);
          if(include) {
            trans.push({d:c.start, n:`عمولة سمسار ${unitCode(c.unitId)}`, i:0, o:c.brokerAmount});
          }
        }
      });

      trans.sort((a,b)=>a.d.localeCompare(b.d));
      let bal=0;
      rows=trans.map(t=>{ bal+=Number(t.i||0)-Number(t.o||0); return [t.d,t.n,egp(t.i),egp(t.o),egp(bal)]; });
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
  view.innerHTML = `
    <div class="card">
      <h3>سجل تتبع التغييرات</h3>
      <p>يعرض هذا السجل آخر 200 إجراء تم في النظام.</p>
      <div id="audit-list"></div>
    </div>
  `;

  const logs = state.auditLog.slice(-200).reverse(); // Get last 200 and reverse to show newest first
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
