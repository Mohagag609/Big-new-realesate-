import { state, saveState, persist } from '../state.js';
import { egp, table, partnerById, unitCode, today } from '../utils.js';

let sort = { idx: 3, dir: 'asc' };
let viewNode;

function payPartnerDebt(debtId) {
    const debt = state.partnerDebts.find(d => d.id === debtId);
    if (!debt) return alert('لم يتم العثور على الدين.');
    if (confirm(`هل تؤكد سداد هذا الدين بمبلغ ${egp(debt.amount)}؟`)) {
        saveState();
        debt.status = 'مدفوع';
        debt.paymentDate = today();
        persist();
        draw();
    }
}

function draw() {
    const listNode = viewNode.querySelector('#pd-list');
    const q = (viewNode.querySelector('#pd-q')?.value || '').trim().toLowerCase();
    let list = state.partnerDebts.slice();
    if (q) {
        list = list.filter(d => {
            const paying = partnerById(d.payingPartnerId)?.name || '';
            const owed = partnerById(d.owedPartnerId)?.name || '';
            const unit = unitCode(d.unitId) || '';
            const searchable = `${paying} ${owed} ${unit} ${d.status}`.toLowerCase();
            return searchable.includes(q);
        });
    }

    list.sort((a, b) => {
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
        return (String(valA) || '').localeCompare(String(valB) || '') * (sort.dir === 'asc' ? 1 : -1);
    });

    const rows = list.map(d => {
        const paying = partnerById(d.payingPartnerId)?.name || 'محذوف';
        const owed = partnerById(d.owedPartnerId)?.name || 'محذوف';
        const unit = unitCode(d.unitId);
        const payButton = d.status !== 'مدفوع' ? `<button class="btn ok" data-id="${d.id}">تسجيل السداد</button>` : 'تم السداد';
        return [paying, owed, unit, d.dueDate, egp(d.amount), d.status, payButton];
    });
    const headers = ['الشريك الدافع', 'الشريك المستحق', 'الوحدة', 'تاريخ الاستحقاق', 'المبلغ', 'الحالة', ''];

    listNode.innerHTML = table(headers, rows, sort);

    listNode.querySelectorAll('th').forEach(th => {
        th.onclick = () => {
            const idx = Number(th.dataset.idx);
            const dir = sort.idx === idx && sort.dir === 'asc' ? 'desc' : 'asc';
            sort = { idx, dir };
            draw();
        };
    });
    listNode.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => payPartnerDebt(btn.dataset.id);
    });
}

export function renderPartnerDebts(view) {
    viewNode = view;
    view.innerHTML = `
      <div class="card">
          <h3>ديون الشركاء</h3>
          <p style="font-size:13px; color:var(--muted);">هذه هي الديون التي نشأت بين الشركاء نتيجة عمليات إرجاع الوحدات.</p>
          <div class="tools">
              <input class="input" id="pd-q" placeholder="بحث باسم الشريك أو الوحدة...">
          </div>
          <div id="pd-list"></div>
      </div>
    `;

    viewNode.querySelector('#pd-q').oninput = draw;
    draw();
}
