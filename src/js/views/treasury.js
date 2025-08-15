import { state } from '../state.js';
import { egp, table, partnerById, unitCode } from '../utils.js';

let viewNode;

function generatePartnerLedger(partnerId) {
    const transactions = [];

    // Income from customer payments
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

    // Income from down payments and expenses from contracts
    state.contracts.forEach(c => {
        const unitPartners = state.unitPartners.filter(up => up.unitId === c.unitId);
        if (unitPartners.length === 0) return;
        const partnerLink = unitPartners.find(up => up.partnerId === partnerId);
        if (partnerLink) {
            if (c.downPayment > 0) {
                const income = c.downPayment * (partnerLink.percent / 100);
                transactions.push({ date: c.start, description: `حصيلة مقدم العقد للوحدة ${unitCode(c.unitId)}`, income: income, expense: 0 });
            }
            if (c.brokerAmount > 0) {
                const expense = c.brokerAmount * (partnerLink.percent / 100);
                transactions.push({ date: c.start, description: `عمولة سمسار للوحدة ${unitCode(c.unitId)}`, income: 0, expense: expense });
            }
        }
    });

    // Income/Expense from inter-partner debts
    state.partnerDebts.forEach(d => {
        if (d.status !== 'مدفوع') return;
        if (d.owedPartnerId === partnerId) {
            transactions.push({ date: d.paymentDate, description: `تحصيل دين من ${partnerById(d.payingPartnerId)?.name || 'شريك'}`, income: d.amount, expense: 0 });
        }
        if (d.payingPartnerId === partnerId) {
            transactions.push({ date: d.paymentDate, description: `سداد دين إلى ${partnerById(d.owedPartnerId)?.name || 'شريك'}`, income: 0, expense: d.amount });
        }
    });

    return transactions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function drawLedger(partnerId) {
    const ledgerDiv = viewNode.querySelector('#treasury-ledger');
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
}

export function renderTreasury(view) {
    viewNode = view;
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

    viewNode.querySelector('#treasury-partner-select').onchange = (e) => {
        drawLedger(e.target.value);
    };
}
