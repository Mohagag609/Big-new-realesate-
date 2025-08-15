import { state } from '../state.js';
import { egp, table, unitById, custById } from '../utils.js';

let viewNode;
let navFunc;
let currentContract;

function calcRemainingForUnit(unit) {
    if (!unit) return 0;
    const ct = state.contracts.find(c => c.unitId === unit.id);
    if (!ct) return Number(unit.totalPrice || 0);
    const totalPrice = Number(ct.totalPrice || unit.totalPrice || 0);
    const installmentPayments = state.payments
        .filter(p => p.unitId === unit.id && p.installmentId)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const downPayment = Number(ct.downPayment || 0);
    const totalPaid = downPayment + installmentPayments;
    const remaining = totalPrice - totalPaid;
    return Math.max(0, remaining);
}

export function renderContractDetails(view, nav, contractId) {
    viewNode = view;
    navFunc = nav;
    currentContract = state.contracts.find(c => c.id === contractId);

    if (!currentContract) {
        alert('لم يتم العثور على العقد');
        return navFunc('contracts');
    }

    const unit = unitById(currentContract.unitId);
    const customer = custById(currentContract.customerId);

    const insts = state.installments.filter(i => i.unitId === currentContract.unitId).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
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

    const pays = state.payments.filter(p => p.unitId === currentContract.unitId).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const payRows = pays.map(p => `<tr>
        <td>${egp(p.amount)}</td>
        <td>${p.method || '—'}</td>
        <td>${p.date || '—'}</td>
        <td>${p.installmentId ? 'قسط' : 'يدوي'}</td>
    </tr>`).join('');

    const html = `
        <div class="card">
            <div class="header">
                <h1>تفاصيل العقد — ${currentContract.code}</h1>
                <button class="btn secondary" id="back-to-contracts-btn">⬅️ العودة إلى العقود</button>
            </div>
            <div class="grid grid-2" style="margin-top:12px; align-items: flex-start;">
                <div class="card">
                    <h3>بيانات العقد</h3>
                    <table>
                        <tr><th>العميل</th><td>${customer?.name || '—'} (${customer?.phone || '—'})</td></tr>
                        <tr><th>الوحدة</th><td>${unit?.code || '—'} (${unit?.name || '—'})</td></tr>
                        <tr><th>السعر الكلي</th><td style="font-weight:bold">${egp(currentContract.totalPrice)}</td></tr>
                        <tr><th>المقدم</th><td>${egp(currentContract.downPayment)}</td></tr>
                        <tr><th>عمولة السمسار</th><td>${egp(currentContract.brokerAmount || 0)} (${currentContract.brokerPercent || 0}%)</td></tr>
                        <tr><th>نظام الأقساط</th><td>${currentContract.type} × ${currentContract.count} + ${currentContract.extraAnnual} سنوية</td></tr>
                        <tr><th>تاريخ البدء</th><td>${currentContract.start}</td></tr>
                    </table>
                </div>
                <div class="card">
                    <h3>ملخص مالي للوحدة</h3>
                    <table>
                      <tr><th>إجمالي المتبقي من سعر الوحدة</th><td style="font-weight:bold">${egp(calcRemainingForUnit(unit))}</td></tr>
                      <tr><th>إجمالي الأقساط المتبقية</th><td>${egp(insts.reduce((s, i) => s + (i.amount || 0), 0))}</td></tr>
                      <tr><th>إجمالي المدفوعات المسجلة</th><td>${egp(pays.reduce((s, p) => s + (p.amount || 0), 0))}</td></tr>
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
        </div>`;

    view.innerHTML = html;
    view.querySelector('#back-to-contracts-btn').onclick = () => navFunc('contracts');
}
