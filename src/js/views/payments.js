import { state, saveState, persist } from '../state.js';
import { uid, egp, table, exportCSV, printHTML, parseNumber, unitCode, today } from '../utils.js';

let viewNode;

function deletePayment(id) {
    const payment = state.payments.find(p => p.id === id);
    if (!payment) return alert('لم يتم العثور على الدفعة.');
    if (payment.installmentId) {
        return alert('لا يمكن حذف دفعة مرتبطة بقسط. يرجى استخدام شاشة الأقساط.');
    }
    if (confirm(`هل أنت متأكد من حذف هذه الدفعة؟\nالمبلغ: ${egp(payment.amount)}\nالتاريخ: ${payment.date}`)) {
        saveState();
        state.payments = state.payments.filter(p => p.id !== id);
        persist();
        draw();
    }
}

function addPayment() {
    const unitId = viewNode.querySelector('#p-unit').value;
    const amount = parseNumber(viewNode.querySelector('#p-amount').value);
    const method = viewNode.querySelector('#p-method').value;
    const date = viewNode.querySelector('#p-date').value || today();
    const installmentId = viewNode.querySelector('#p-installments').value;

    if (!unitId || !(amount > 0)) return alert('اختر وحدة واكتب مبلغ صحيح');

    saveState();
    const p = { id: uid('P'), unitId, amount, method, date };

    if ((method === 'قسط' || method === 'جزئي') && installmentId) {
        const i = state.installments.find(x => x.id === installmentId);
        if (!i) return alert('لم يتم العثور على القسط المختار.');
        if (amount > i.amount) {
            return alert(`المبلغ المدفوع ${egp(amount)} أكبر من المتبقي على القسط ${egp(i.amount)}.`);
        }

        p.installmentId = installmentId;

        if (typeof i.originalAmount !== 'number') i.originalAmount = i.amount;
        i.amount = Math.round((i.amount - amount) * 100) / 100;
        if (i.amount <= 0) {
            i.status = 'مدفوع';
            i.paymentDate = date;
        }
    }

    state.payments.push(p);
    persist();
    draw();
    printHTML('إيصال دفع', `<h1>إيصال دفع</h1><p>الوحدة: ${unitCode(unitId)}</p><p>المبلغ: ${egp(amount)}</p><p>الطريقة: ${p.method}</p><p>التاريخ: ${p.date}</p>`);
}

function expPayments() {
    exportCSV(['الوحدة', 'المبلغ', 'الطريقة', 'التاريخ', 'مصدر'], state.payments.map(p => [unitCode(p.unitId), p.amount, p.method || '', p.date || '', p.installmentId ? 'قسط' : '']), 'payments.csv');
}

function printPayments() {
    const rows = state.payments.map(p => `<tr><td>${unitCode(p.unitId)}</td><td>${egp(p.amount)}</td><td>${p.method || '—'}</td><td>${p.date || '—'}</td></tr>`).join('');
    printHTML('تقرير المدفوعات', `<h1>تقرير المدفوعات</h1><table><thead><tr><th>الوحدة</th><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function draw() {
    const listNode = viewNode.querySelector('#p-list');
    const q = (viewNode.querySelector('#p-q')?.value || '').trim().toLowerCase();
    let list = state.payments.slice().reverse();
    if (q) {
        list = list.filter(p => {
            const searchable = `${unitCode(p.unitId)} ${p.method || ''} ${p.date || ''}`.toLowerCase();
            return searchable.includes(q);
        });
    }
    const rows = list.map(p => [
        unitCode(p.unitId),
        egp(p.amount),
        p.method || '—',
        p.date || '—',
        (p.installmentId ? '<span class="badge info">من قسط</span>' : '<span class="badge secondary">يدوي</span>'),
        `<button class="btn" data-action="receipt" data-id="${p.id}">إيصال</button>` +
        (p.installmentId ? '' : ` <button class="btn secondary" data-action="delete" data-id="${p.id}">حذف</button>`)
    ]);
    listNode.innerHTML = table(['الوحدة', 'المبلغ', 'الطريقة', 'التاريخ', 'مصدر', ''], rows);

    listNode.querySelectorAll('button').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.dataset.id;
            const action = e.target.dataset.action;
            const payment = state.payments.find(p => p.id === id);
            if (!payment) return;

            if (action === 'receipt') {
                printHTML("إيصال دفع", `<h1>إيصال دفع</h1><p>الوحدة: ${unitCode(payment.unitId)}</p><p>المبلغ: ${egp(payment.amount)}</p><p>الطريقة: ${payment.method || "—"}</p><p>التاريخ: ${payment.date || "—"}</p>`);
            }
            if (action === 'delete') {
                deletePayment(id);
            }
        };
    });
}

function updateInstallmentSelector() {
    const unitId = viewNode.querySelector('#p-unit').value;
    const method = viewNode.querySelector('#p-method').value;
    const container = viewNode.querySelector('#p-installments-container');
    const select = viewNode.querySelector('#p-installments');
    const amountInput = viewNode.querySelector('#p-amount');

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

function attachEventListeners() {
    viewNode.querySelector('#p-q').oninput = draw;
    viewNode.querySelector('#add-payment-btn').onclick = addPayment;
    viewNode.querySelector('#exp-csv-btn').onclick = expPayments;
    viewNode.querySelector('#print-pdf-btn').onclick = printPayments;
    viewNode.querySelector('#p-unit').onchange = updateInstallmentSelector;
    viewNode.querySelector('#p-method').onchange = updateInstallmentSelector;
}

export function renderPayments(view) {
    viewNode = view;
    view.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <h3>إضافة دفعة</h3>
          <select class="select" id="p-unit"><option value="">الوحدة</option>${state.units.map(u => `<option value="${u.id}">${u.code} - ${u.name || ''}</option>`).join('')}</select>
          <input class="input" id="p-amount" placeholder="المبلغ" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
          <select class="select" id="p-method"><option value="نقدي">نقدي</option><option value="تحويل">تحويل</option><option value="قسط">قسط</option><option value="جزئي">جزئي</option></select>
          <div id="p-installments-container" style="display:none; margin-top: 8px;">
            <select class="select" id="p-installments"><option value="">اختر القسط المرتبط</option></select>
          </div>
          <input class="input" id="p-date" type="date" value="${today()}">
          <button class="btn" id="add-payment-btn">حفظ + إيصال</button>
        </div>
        <div class="card">
          <h3>المدفوعات</h3>
          <div class="tools">
            <input class="input" id="p-q" placeholder="بحث">
            <button class="btn secondary" id="exp-csv-btn">CSV</button>
            <button class="btn" id="print-pdf-btn">طباعة PDF</button>
          </div>
          <div id="p-list"></div>
        </div>
      </div>`;

    attachEventListeners();
    draw();
}
