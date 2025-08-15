import { state, saveState, persist } from '../state.js';
import { uid, egp, table, printHTML, parseNumber, unitById, custById, unitCode, today } from '../utils.js';

let viewNode;
let navFunc;

function deleteContract(contractId) {
    if (!confirm('هل أنت متأكد من حذف هذا العقد؟ سيتم حذف جميع الأقساط والمدفوعات المرتبطة به.')) return;

    const contract = state.contracts.find(c => c.id === contractId);
    if (!contract) return alert('لم يتم العثور على العقد.');

    const unitId = contract.unitId;
    saveState();

    state.payments = state.payments.filter(p => p.unitId !== unitId);
    state.installments = state.installments.filter(i => i.unitId !== unitId);
    state.contracts = state.contracts.filter(c => c.id !== contractId);

    const unit = unitById(unitId);
    if (unit) unit.status = 'متاحة';

    persist();
    draw();
}

function editContract(contractId) {
    const contract = state.contracts.find(c => c.id === contractId);
    if (!contract) return alert('لم يتم العثور على العقد.');

    const hasPayments = state.payments.some(p => p.unitId === contract.unitId);
    if (hasPayments) {
        alert('لا يمكن تعديل هذا العقد لأنه توجد مدفوعات مسجلة عليه.');
        return;
    }

    if (confirm('هل أنت متأكد أنك تريد "تعديل" هذا العقد؟ سيتم حذف العقد الحالي وجميع أقساطه، ويجب عليك إنشاء عقد جديد.')) {
        deleteContract(contractId);
    }
}

function printContract(ct) {
    const html = `<h1>عقد بيع — ${ct.code}</h1>
      <p>الوحدة: ${unitCode(ct.unitId)} — العميل: ${(custById(ct.customerId) || {}).name || '—'}</p>
      <table>
        <tr><th>السعر الكلي</th><td>${egp(ct.totalPrice)}</td></tr>
        <tr><th>المقدم</th><td>${egp(ct.downPayment)}</td></tr>
        <tr><th>عمولة السمسار</th><td>${egp(ct.brokerAmount || 0)} (${ct.brokerPercent || 0}%)</td></tr>
        <tr><th>نظام الأقساط</th><td>${ct.type} × ${ct.count} + سنوية إضافية: ${ct.extraAnnual}</td></tr>
        <tr><th>بداية العقد</th><td>${ct.start}</td></tr>
      </table>`;
    printHTML('عقد بيع', html);
}

function createContract() {
    const unitId = viewNode.querySelector('#ct-unit').value;
    const customerId = viewNode.querySelector('#ct-cust').value;
    if (!unitId || !customerId) return alert('اختر الوحدة والعميل');

    const unitPartners = state.unitPartners.filter(up => up.unitId === unitId);
    const totalPercent = unitPartners.reduce((sum, p) => sum + p.percent, 0);
    if (unitPartners.length > 0 && totalPercent !== 100) {
        if (!confirm(`تحذير: مجموع نسب الشركاء لهذه الوحدة هو ${totalPercent}%. هل تريد المتابعة على أي حال؟`)) {
            return;
        }
    }

    saveState();
    const total = parseNumber(viewNode.querySelector('#ct-total').value);
    const down = parseNumber(viewNode.querySelector('#ct-down').value);
    const brokerP = parseNumber(viewNode.querySelector('#ct-brokerp').value);
    const type = viewNode.querySelector('#ct-type').value;
    const count = parseInt(viewNode.querySelector('#ct-count').value || '0', 10);
    const extra = parseInt(viewNode.querySelector('#ct-annual-bonus').value || '0', 10);
    const startStr = viewNode.querySelector('#ct-start').value || today();
    const start = new Date(startStr);

    if (count <= 0) return alert('عدد الدفعات غير صالح');

    const brokerAmt = Math.round((total * brokerP / 100) * 100) / 100;
    const code = 'CTR-' + String(state.contracts.length + 1).padStart(5, '0');
    const ct = { id: uid('CT'), code, unitId, customerId, totalPrice: total, downPayment: down, brokerPercent: brokerP, brokerAmount: brokerAmt, type, count, extraAnnual: Math.min(Math.max(extra, 0), 3), start: startStr };
    state.contracts.push(ct);

    // Installment Generation
    const months = { 'شهري': 1, 'ربع سنوي': 3, 'نصف سنوي': 6, 'سنوي': 12 }[type] || 1;
    const remain = Math.max(0, total - down - brokerAmt);
    const parts = count + ct.extraAnnual;
    const base = Math.floor((remain / parts) * 100) / 100;
    let acc = 0;
    for (let i = 0; i < count; i++) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + months * (i + 1));
        const amt = (i === count - 1 && ct.extraAnnual === 0) ? Math.round((remain - acc) * 100) / 100 : base;
        acc += amt;
        state.installments.push({ id: uid('I'), unitId, type, amount: amt, originalAmount: amt, dueDate: d.toISOString().slice(0, 10), paymentDate: null, status: 'غير مدفوع' });
    }
    for (let j = 0; j < ct.extraAnnual; j++) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + 12 * (j + 1));
        const amt = (j === ct.extraAnnual - 1) ? Math.round((remain - acc) * 100) / 100 : base;
        acc += amt;
        state.installments.push({ id: uid('I'), unitId, type: 'سَنوي إضافي', amount: amt, originalAmount: amt, dueDate: d.toISOString().slice(0, 10), paymentDate: null, status: 'غير مدفوع' });
    }

    const u = unitById(unitId);
    if (u) u.status = 'مباعة';

    persist();
    draw();
    printContract(ct);
}

function printContracts() {
    const rows = state.contracts.map(c => `<tr><td>${c.code || ''}</td><td>${unitCode(c.unitId)}</td><td>${(custById(c.customerId) || {}).name || '—'}</td><td>${egp(c.totalPrice)}</td><td>${egp(c.downPayment)}</td><td>${egp(c.brokerAmount || 0)} (${c.brokerPercent || 0}%)</td><td>${c.type}</td><td>${c.count}</td><td>${c.start}</td></tr>`).join('');
    printHTML('تقرير العقود', `<h1>تقرير العقود</h1><table><thead><tr><th>الكود</th><th>الوحدة</th><th>العميل</th><th>السعر</th><th>المقدم</th><th>عمولة</th><th>نوع</th><th>عدد</th><th>بداية</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function draw() {
    const listNode = viewNode.querySelector('#ct-list');
    const rows = state.contracts.map(c => [
        c.code,
        unitCode(c.unitId),
        (custById(c.customerId) || {}).name || '—',
        egp(c.totalPrice),
        c.start,
        `<button class="btn" data-action="details" data-id="${c.id}">عرض</button> <button class="btn gold" data-action="edit" data-id="${c.id}">تعديل</button>`,
        `<button class="btn secondary" data-action="delete" data-id="${c.id}">حذف</button>`
    ]);
    listNode.innerHTML = table(['كود العقد', 'الوحدة', 'العميل', 'السعر', 'تاريخ البدء', 'إجراءات', ''], rows);

    listNode.querySelectorAll('button').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.dataset.id;
            const action = e.target.dataset.action;
            if (action === 'details') navFunc('contract-details', id); // This will be a new view
            if (action === 'edit') editContract(id);
            if (action === 'delete') deleteContract(id);
        };
    });
}

function updateTotalInstallments() {
    const countInput = viewNode.querySelector('#ct-count');
    const extraInput = viewNode.querySelector('#ct-annual-bonus');
    const totalDisplay = viewNode.querySelector('#ct-total-installments');
    if (!countInput || !extraInput || !totalDisplay) return;
    const count = parseInt(countInput.value || '0', 10);
    const extra = parseInt(extraInput.value || '0', 10);
    totalDisplay.textContent = count + extra;
}

function attachEventListeners() {
    viewNode.querySelector('#create-contract-btn').onclick = createContract;
    viewNode.querySelector('#print-contracts-btn').onclick = printContracts;
    viewNode.querySelector('#ct-count').oninput = updateTotalInstallments;
    viewNode.querySelector('#ct-annual-bonus').oninput = updateTotalInstallments;
}

export function renderContracts(view, nav) {
    viewNode = view;
    navFunc = nav;
    view.innerHTML = `
      <div class="grid">
        <div class="card">
          <h3>إضافة عقد</h3>
          <p style="font-size:13px; color:var(--muted);">لإدارة الشركاء، اذهب إلى شاشة الوحدات ثم اضغط "إدارة" بجانب الوحدة المطلوبة.</p>
          <div class="grid grid-4">
            <select class="select" id="ct-unit"><option value="">الوحدة</option>${state.units.filter(u => u.status !== 'مباعة').map(u => `<option value="${u.id}">${u.code}</option>`).join('')}</select>
            <select class="select" id="ct-cust"><option value="">العميل</option>${state.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
            <input class="input" id="ct-total" placeholder="السعر الكلي" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
            <input class="input" id="ct-down" placeholder="المقدم" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
            <input class="input" id="ct-brokerp" placeholder="نسبة السمسار %" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
            <select class="select" id="ct-type"><option>شهري</option><option>ربع سنوي</option><option>نصف سنوي</option><option>سنوي</option></select>
            <input class="input" id="ct-count" placeholder="عدد الدفعات" oninput="this.value=this.value.replace(/[^\\d]/g,'')">
            <input class="input" id="ct-annual-bonus" placeholder="دفعات سنوية إضافية (0-3)" oninput="this.value=this.value.replace(/[^\\d]/g,'')">
            <input class="input" id="ct-start" type="date" value="${today()}">
          </div>
          <div style="color:var(--muted); font-size:12px; margin-top:4px; padding-right: 5px;">
            إجمالي عدد الأقساط: <span id="ct-total-installments" style="font-weight:bold;">0</span>
          </div>
          <div class="tools">
            <button class="btn" id="create-contract-btn">حفظ + توليد أقساط</button>
            <button class="btn secondary" id="print-contracts-btn">طباعة PDF</button>
          </div>
        </div>
        <div class="card">
          <h3>العقود</h3>
          <div id="ct-list"></div>
        </div>
      </div>`;

    attachEventListeners();
    updateTotalInstallments();
    draw();
}
