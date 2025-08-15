import { state, saveState, persist } from '../state.js';
import { egp, table, exportCSV, printHTML, parseNumber, unitCode, today } from '../utils.js';

let sort = { idx: 4, dir: 'asc' };
let viewNode;

function inlineUpdate(id, key, value) {
    saveState();
    const item = state.installments.find(x => x.id === id);
    if (item) {
        item[key] = value;
        persist();
        draw();
    }
}

function deleteInstallment(id) {
    if (confirm('هل أنت متأكد من الحذف؟')) {
        saveState();
        state.installments = state.installments.filter(x => x.id !== id);
        persist();
        draw();
    }
}

function payInstallment(id, btn) {
    if (btn) btn.disabled = true;
    try {
        const i = state.installments.find(x => x.id === id);
        if (!i) return alert('لم يتم العثور على القسط');
        if (i.status === 'مدفوع' || i.amount <= 0) return alert('هذا القسط مسدد بالكامل');

        const paid = Number(prompt('المبلغ المدفوع (يمكنك إدخال جزء من المبلغ):', i.amount) || 0);
        if (!(paid > 0)) return; // User cancelled or entered 0

        saveState();
        if (typeof i.originalAmount !== 'number') i.originalAmount = i.amount;
        const payNow = Math.min(paid, i.amount);

        state.payments.push({ id: uid('P'), unitId: i.unitId, amount: payNow, method: paid < i.amount ? 'جزئي' : 'قسط', date: today(), installmentId: i.id });

        if (paid < i.amount) {
            i.amount = Math.round((i.amount - payNow) * 100) / 100;
        } else {
            i.amount = 0;
            i.status = 'مدفوع';
            i.paymentDate = today();
        }
        persist();
        draw();
    } finally {
        if (btn) setTimeout(() => { btn.disabled = false; }, 200);
    }
}

function reschedule(id) {
    const i = state.installments.find(x => x.id === id); if (!i) return;
    const unitId = i.unitId;
    const remainList = state.installments
        .filter(x => x.unitId === unitId && x.status !== 'مدفوع')
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    const idx = remainList.findIndex(x => x.id === id);
    const newAmt = Number(prompt('قيمة القسط الجديدة', i.amount) || i.amount);
    const newDate = prompt('تاريخ الاستحقاق الجديد (YYYY-MM-DD)', i.dueDate || '') || i.dueDate;

    saveState();
    const diff = Math.round((i.amount - newAmt) * 100) / 100;
    if (typeof i.originalAmount !== 'number') i.originalAmount = i.amount;
    i.amount = newAmt;
    i.dueDate = newDate;

    const others = remainList.slice(idx + 1);
    const share = others.length ? Math.round((diff / others.length) * 100) / 100 : 0;
    others.forEach(x => {
        if (typeof x.originalAmount !== 'number') x.originalAmount = x.amount;
        x.amount = Math.round((x.amount + share) * 100) / 100;
    });
    persist();
    draw();
    alert('تمت إعادة الجدولة وتوزيع الفرق على الأقساط التالية.');
}

function simpleEditInstallment(id) {
    const i = state.installments.find(x => x.id === id);
    if (!i) return alert('لم يتم العثور على القسط.');

    const newAmtStr = prompt('أدخل المبلغ الجديد للقسط:', i.amount);
    if (newAmtStr === null) return; // User cancelled

    const newAmt = parseNumber(newAmtStr);
    if (isNaN(newAmt) || newAmt <= 0) return alert('الرجاء إدخال مبلغ صحيح.');

    const newDateStr = prompt('أدخل تاريخ الاستحقاق الجديد (YYYY-MM-DD):', i.dueDate);
    if (newDateStr === null) return; // User cancelled

    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) {
        return alert('صيغة التاريخ غير صحيحة. الرجاء استخدام YYYY-MM-DD.');
    }

    saveState();
    i.amount = newAmt;
    i.dueDate = newDateStr;
    if (typeof i.originalAmount === 'number') i.originalAmount = newAmt;

    persist();
    draw();
    alert('تم تعديل القسط بنجاح.');
}

function expInst() {
    const headers = ['الوحدة', 'النوع', 'المبلغ', 'المتبقي', 'المسدد', 'الاستحقاق', 'السداد', 'الحالة'];
    const rows = state.installments.map(i => [
        unitCode(i.unitId),
        i.type,
        (i.originalAmount != null ? i.originalAmount : i.amount),
        i.amount,
        Math.max(0, (i.originalAmount != null ? i.originalAmount : i.amount) - (i.amount || 0)),
        i.dueDate || '',
        i.paymentDate || '',
        i.status || ''
    ]);
    exportCSV(headers, rows, 'installments.csv');
}

function printInst() {
    const rows = state.installments.map(i => `
      <tr>
        <td>${unitCode(i.unitId)}</td>
        <td>${i.type || ''}</td>
        <td>${egp(i.originalAmount != null ? i.originalAmount : i.amount)}</td>
        <td>${egp(i.amount)}</td>
        <td>${egp(Math.max(0, (i.originalAmount != null ? i.originalAmount : i.amount) - (i.amount || 0)))}</td>
        <td>${i.dueDate || ''}</td>
        <td>${i.paymentDate || ''}</td>
        <td>${i.status || ''}</td>
      </tr>`).join('');
    printHTML('تقرير الأقساط',
        `<h1>تقرير الأقساط</h1>
         <table>
           <thead><tr><th>الوحدة</th><th>النوع</th><th>المبلغ</th><th>المتبقي</th><th>المسدد</th><th>الاستحقاق</th><th>السداد</th><th>الحالة</th></tr></thead>
           <tbody>${rows}</tbody>
         </table>`);
}

function draw() {
    const listNode = viewNode.querySelector('#i-list');
    const q = (viewNode.querySelector('#i-q')?.value || '').trim().toLowerCase();
    let list = state.installments.slice();
    if (q) {
        list = list.filter(i => {
            const searchable = `${unitCode(i.unitId)} ${i.status || ''} ${i.dueDate || ''}`.toLowerCase();
            return searchable.includes(q);
        });
    }
    list.sort((a, b) => {
        const A = [unitCode(a.unitId), a.type || '', String((a.originalAmount != null ? a.originalAmount : a.amount) || 0), String(a.amount || 0), a.dueDate || '', a.paymentDate || '', a.status || ''];
        const B = [unitCode(b.unitId), b.type || '', String((b.originalAmount != null ? b.originalAmount : b.amount) || 0), String(b.amount || 0), b.dueDate || '', b.paymentDate || '', b.status || ''];
        const valA = A[sort.idx] || '';
        const valB = B[sort.idx] || '';
        return valA.localeCompare(valB) * (sort.dir === 'asc' ? 1 : -1);
    });

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const rows = list.map(i => {
        let rowClass = '';
        if (i.status === 'مدفوع') rowClass = 'paid';
        else if (i.dueDate) {
            const dueDate = new Date(i.dueDate);
            const sevenDaysFromNow = new Date(todayDate);
            sevenDaysFromNow.setDate(todayDate.getDate() + 7);
            if (dueDate < todayDate) rowClass = 'overdue';
            else if (dueDate <= sevenDaysFromNow) rowClass = 'due-soon';
        }

        const isPaid = i.status === 'مدفوع';
        const original = egp(i.originalAmount != null ? i.originalAmount : i.amount);
        const remaining = egp(i.amount);
        const paidSoFar = state.payments.filter(p => p.installmentId === i.id).reduce((sum, p) => sum + (p.amount || 0), 0);
        const paidAmt = egp(paidSoFar);

        return `<tr class="${rowClass}" data-id="${i.id}">
            <td>${unitCode(i.unitId)}</td>
            <td>${i.type || ''}</td>
            <td>${original}</td>
            <td>${remaining}</td>
            <td>${paidAmt}</td>
            <td><span contenteditable="${!isPaid}" data-key="dueDate">${i.dueDate || ''}</span></td>
            <td>${i.paymentDate || '—'}</td>
            <td><span contenteditable="${!isPaid}" data-key="status">${i.status || 'غير مدفوع'}</span></td>
            <td><button class="btn ok" data-action="pay" ${isPaid ? 'disabled' : ''}>دفع</button></td>
            <td><button class="btn" data-action="reschedule" ${isPaid ? 'disabled' : ''}>إعادة جدولة</button></td>
            <td><button class="btn gold" data-action="edit" ${isPaid ? 'disabled' : ''}>تعديل</button></td>
            <td><button class="btn secondary" data-action="delete" ${isPaid ? 'disabled' : ''}>حذف</button></td>
        </tr>`;
    });

    const headers = ['الوحدة', 'النوع', 'المبلغ', 'المتبقي', 'المسدد', 'الاستحقاق', 'السداد', 'الحالة', 'دفع', 'إعادة جدولة', 'تعديل', 'حذف'];
    listNode.innerHTML = `<table class="table"><thead><tr>${headers.map((h, i) => `<th data-idx="${i}" style="cursor:pointer;white-space:nowrap">${h}${sort.idx === i ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="12"><small>لا توجد بيانات</small></td></tr>`}</tbody></table>`;

    // Add event listeners
    listNode.querySelectorAll('th').forEach(th => {
        th.onclick = () => {
            const idx = Number(th.dataset.idx);
            const dir = (sort.idx === idx && sort.dir === 'asc') ? 'desc' : 'asc';
            sort = { idx, dir };
            draw();
        };
    });
    listNode.querySelectorAll('button').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.closest('tr').dataset.id;
            const action = e.target.dataset.action;
            if (action === 'pay') payInstallment(id, e.target);
            if (action === 'reschedule') reschedule(id);
            if (action === 'edit') simpleEditInstallment(id);
            if (action === 'delete') deleteInstallment(id);
        };
    });
    listNode.querySelectorAll('[contenteditable]').forEach(span => {
        span.onblur = (e) => {
            const id = e.target.closest('tr').dataset.id;
            const key = e.target.dataset.key;
            inlineUpdate(id, key, e.target.textContent);
        };
    });
}

function attachEventListeners() {
    viewNode.querySelector('#i-q').oninput = draw;
    viewNode.querySelector('#exp-csv-btn').onclick = expInst;
    viewNode.querySelector('#print-pdf-btn').onclick = printInst;
}

export function renderInstallments(view) {
    viewNode = view;
    view.innerHTML = `
      <div class="card">
        <h3>الأقساط</h3>
        <div class="tools">
          <input class="input" id="i-q" placeholder="بحث بالوحدة/الشهر/الحالة">
          <button class="btn secondary" id="exp-csv-btn">CSV</button>
          <button class="btn" id="print-pdf-btn">طباعة PDF</button>
        </div>
        <div id="i-list"></div>
      </div>
    `;
    attachEventListeners();
    draw();
}
