import { state, saveState, persist } from '../state.js';
import { uid, egp, table, exportCSV, printHTML, parseNumber, showModal } from '../utils.js';

let sort = { idx: 0, dir: 'asc' };
let viewNode;
let navFunc; // To navigate to other views like 'unit-details'

function calcRemaining(u) {
    const ct = state.contracts.find(c => c.unitId === u.id);
    if (!ct) return Number(u.totalPrice || 0);

    const totalPrice = Number(ct.totalPrice || u.totalPrice || 0);
    const installmentPayments = state.payments
        .filter(p => p.unitId === u.id && p.installmentId)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const downPayment = Number(ct.downPayment || 0);
    const totalPaid = downPayment + installmentPayments;
    const remaining = totalPrice - totalPaid;
    return Math.max(0, remaining);
}

function inlineUpdate(id, key, value) {
    saveState();
    const item = state.units.find(x => x.id === id);
    if (item) {
        item[key] = value;
        persist();
    }
}

function numEdit(id, key, value) {
    const parsedValue = parseNumber(value);
    inlineUpdate(id, key, parsedValue);
}

function deleteUnit(unitId) {
    const isLinked = state.contracts.some(c => c.unitId === unitId);
    if (isLinked) {
        alert('لا يمكن حذف هذه الوحدة لأنها مرتبطة بعقد قائم. يجب حذف العقد أولاً.');
        return;
    }
    if (confirm('هل أنت متأكد من الحذف؟')) {
        saveState();
        state.units = state.units.filter(x => x.id !== unitId);
        persist();
        draw();
    }
}

function addUnit() {
    let code = viewNode.querySelector('#u-code').value.trim();
    const name = viewNode.querySelector('#u-name').value.trim();
    const total = parseNumber(viewNode.querySelector('#u-total').value);
    const status = viewNode.querySelector('#u-status').value;
    const floor = viewNode.querySelector('#u-floor').value.trim();
    const building = viewNode.querySelector('#u-building').value.trim();

    if (!code) {
        if (!building || !floor || !name) {
            return alert('لإنشاء كود تلقائي، الرجاء إدخال اسم الوحدة ورقم الدور والعمارة.');
        }
        const san_b = building.replace(/\s/g, '');
        const san_f = floor.replace(/\s/g, '');
        const san_n = name.replace(/\s/g, '');
        code = `${san_b} - ${san_f} - (${san_n})`;
    }

    if (!total) return alert('أدخل السعر الكلي للوحدة');

    if (state.units.some(u => u.code.toLowerCase() === code.toLowerCase())) {
        return alert('هذا الكود مستخدم بالفعل. الرجاء إدخال كود فريد.');
    }
    saveState();
    state.units.push({ id: uid('U'), code, name, totalPrice: total, status, floor, building });
    persist();
    draw();
    // Clear inputs
    viewNode.querySelector('#u-code').value = '';
    viewNode.querySelector('#u-name').value = '';
    viewNode.querySelector('#u-total').value = '';
    viewNode.querySelector('#u-floor').value = '';
    viewNode.querySelector('#u-building').value = '';
}

function expUnits() {
    const headers = ['الكود', 'اسم الوحدة', 'السعر', 'الدور', 'العمارة', 'الحالة', 'المتبقي'];
    const rows = state.units.map(u => [u.code, u.name || '', u.totalPrice, u.floor || '', u.building || '', u.status, calcRemaining(u)]);
    exportCSV(headers, rows, 'units.csv');
}

function impUnits(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
        saveState();
        const lines = String(r.result).split(/\r?\n/).slice(1);
        lines.forEach(line => {
            const [code, name, total, status, floor, building] = line.split(',').map(x => x?.replace(/^"|"$/g, '') || '');
            if (code) state.units.push({ id: uid('U'), code, name, totalPrice: parseNumber(total), status: status || 'متاحة', floor, building });
        });
        persist();
        draw();
    };
    r.readAsText(f, 'utf-8');
}

function printUnits() {
    const rows = state.units.map(u => `<tr><td>${u.code}</td><td>${u.name || ''}</td><td>${egp(u.totalPrice)}</td><td>${u.floor || ''}</td><td>${u.building || ''}</td><td>${u.status}</td><td>${egp(calcRemaining(u))}</td></tr>`).join('');
    printHTML('تقرير الوحدات', `<h1>تقرير الوحدات</h1><table><thead><tr><th>الكود</th><th>اسم الوحدة</th><th>السعر</th><th>الدور</th><th>العمارة</th><th>الحالة</th><th>المتبقي</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function draw() {
    const q = (viewNode.querySelector('#u-q')?.value || '').trim().toLowerCase();
    let list = state.units.slice();
    if (q) {
        list = list.filter(u => {
            const searchable = `${u.code || ''} ${u.name || ''} ${u.floor || ''} ${u.building || ''} ${u.status || ''}`.toLowerCase();
            return searchable.includes(q);
        });
    }
    list.sort((a, b) => {
        const cols = [a.code || '', a.name || '', String(a.totalPrice || 0), a.floor || '', a.building || '', a.status || ''];
        const colsB = [b.code || '', b.name || '', String(b.totalPrice || 0), b.floor || '', b.building || '', b.status || ''];
        const valA = cols[sort.idx] || '';
        const valB = colsB[sort.idx] || '';
        return valA.localeCompare(valB) * (sort.dir === 'asc' ? 1 : -1);
    });

    const listNode = viewNode.querySelector('#u-list');
    const rows = list.map(u => {
        let actions = `<button class="btn" data-action="details" data-id="${u.id}">إدارة</button>`;
        if (u.status === 'مباعة') {
            actions += ` <button class="btn gold" style="margin-right: 5px;" data-action="return" data-id="${u.id}">إرجاع وشراء</button>`;
        }
        return [
            `<span contenteditable="true" data-key="code">${u.code || ''}</span>`,
            `<span contenteditable="true" data-key="name">${u.name || ''}</span>`,
            `<span contenteditable="true" data-key="totalPrice">${u.totalPrice || 0}</span>`,
            `<span contenteditable="true" data-key="floor">${u.floor || ''}</span>`,
            `<span contenteditable="true" data-key="building">${u.building || ''}</span>`,
            `<span>${egp(calcRemaining(u))}</span>`,
            `<span contenteditable="true" data-key="status">${u.status || 'متاحة'}</span>`,
            `<div class="tools" style="gap:5px; flex-wrap:nowrap;">${actions}</div>`,
            `<button class="btn secondary" data-action="delete" data-id="${u.id}">حذف</button>`
        ];
    });

    listNode.innerHTML = table(['الكود', 'اسم الوحدة', 'السعر', 'الدور', 'العمارة', 'المتبقي', 'الحالة', 'إجراءات', ''], rows, sort);

    // Add event listeners
    listNode.querySelectorAll('th').forEach(th => {
        th.onclick = () => {
            const idx = Number(th.dataset.idx);
            const dir = sort && sort.idx === idx && sort.dir === 'asc' ? 'desc' : 'asc';
            sort = { idx, dir };
            draw();
        };
    });
    listNode.querySelectorAll('button').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.dataset.id;
            const action = e.target.dataset.action;
            if (action === 'details') navFunc('unit-details', id);
            if (action === 'delete') deleteUnit(id);
            if (action === 'return') startReturnProcess(id);
        };
    });
    listNode.querySelectorAll('[contenteditable]').forEach(span => {
        span.onblur = (e) => {
            const id = e.target.closest('tr').querySelector('button[data-id]').dataset.id;
            const key = e.target.dataset.key;
            const value = e.target.textContent;
            if (key === 'totalPrice') {
                numEdit(id, key, value);
            } else {
                inlineUpdate(id, key, value);
            }
        };
    });
}

function attachEventListeners() {
    viewNode.querySelector('#u-q').oninput = draw;
    viewNode.querySelector('#add-unit-btn').onclick = addUnit;
    viewNode.querySelector('#exp-csv-btn').onclick = expUnits;
    viewNode.querySelector('#imp-csv-label input').onchange = impUnits;
    viewNode.querySelector('#print-pdf-btn').onclick = printUnits;
}

export function renderUnits(view, nav) {
    viewNode = view;
    navFunc = nav;
    view.innerHTML = `
      <div class="grid">
        <div class="card">
          <h3>إضافة وحدة</h3>
          <div class="grid grid-4">
            <input class="input" id="u-code" placeholder="كود/اسم مختصر">
            <input class="input" id="u-name" placeholder="اسم الوحدة">
            <input class="input" id="u-total" placeholder="السعر الكلي" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
            <select class="select" id="u-status"><option>متاحة</option><option>مباعة</option><option>مرتجعة</option></select>
            <input class="input" id="u-floor" placeholder="رقم الدور">
            <input class="input" id="u-building" placeholder="رقم العمارة">
          </div>
          <button class="btn" id="add-unit-btn">حفظ</button>
        </div>
        <div class="card">
          <h3>قائمة الوحدات</h3>
          <div class="tools">
            <input class="input" id="u-q" placeholder="بحث">
            <button class="btn secondary" id="exp-csv-btn">CSV</button>
            <label class="btn secondary" id="imp-csv-label"><input type="file" style="display:none" accept=".csv">استيراد CSV</label>
            <button class="btn" id="print-pdf-btn">طباعة PDF</button>
          </div>
          <div id="u-list"></div>
        </div>
      </div>`;

    attachEventListeners();
    draw();
}

// --- Return and Buy Process ---
// These functions are highly specific to the units view.

function executeReturn(unitId, buyingPartnerId) {
    saveState();
    const u = state.units.find(unit => unit.id === unitId);
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
    const scheduleBasis = originalInstallments.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
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
    draw(); // Redraw the units list
    return true; // for modal
}

function startReturnProcess(unitId) {
    const u = state.units.find(unit => unit.id === unitId);
    const originalPartners = state.unitPartners.filter(up => up.unitId === unitId);

    if (!u || u.status !== 'مباعة') {
        return alert('يمكن تنفيذ هذه العملية على الوحدات المباعة فقط.');
    }
    if (originalPartners.length === 0) {
        return alert('لا يوجد شركاء مرتبطون بهذه الوحدة. لا يمكن إتمام العملية.');
    }

    const partnerOptions = originalPartners.map(up => {
        const p = state.partners.find(partner => partner.id === up.partnerId);
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
}
