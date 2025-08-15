import { state } from '../state.js';
import { egp, table, printHTML, unitCode, custById, partnerById } from '../utils.js';

let viewNode;
let lastReportData = null;

function printLastReport() {
    if (lastReportData) {
        const { title, headers, rows } = lastReportData;
        const head = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        const body = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
        printHTML(title, `<h1>${title}</h1><table><thead>${head}</thead>${body}</table>`);
    } else {
        alert('لا توجد بيانات تقرير للطباعة. يرجى إنشاء تقرير أولاً.');
    }
}

function runReport(type) {
    const from = viewNode.querySelector('#rep-from')?.value;
    const to = viewNode.querySelector('#rep-to')?.value;
    let title = '', headers = [], rows = [];
    const out = viewNode.querySelector('#rep-out');
    out.innerHTML = '';

    switch (type) {
        case 'units_status':
            title = 'تقرير حالة الوحدات'; headers = ['الحالة', 'العدد', 'إجمالي السعر'];
            const stats = {}; state.units.forEach(u => { stats[u.status] = (stats[u.status] || { c: 0, p: 0 }); stats[u.status].c++; stats[u.status].p += Number(u.totalPrice || 0); });
            rows = Object.keys(stats).map(k => [k, stats[k].c, egp(stats[k].p)]);
            break;
        case 'cust_activity':
            title = 'تقرير نشاط العملاء'; headers = ['العميل', 'عدد الوحدات', 'إجمالي المدفوعات'];
            const custs = {}; state.contracts.forEach(c => { custs[c.customerId] = (custs[c.customerId] || { u: new Set(), p: 0 }); custs[c.customerId].u.add(c.unitId); });
            let custPays = state.payments.slice();
            if (from) custPays = custPays.filter(p => p.date >= from);
            if (to) custPays = custPays.filter(p => p.date <= to);
            custPays.forEach(p => { const ct = state.contracts.find(c => c.unitId === p.unitId); if (ct && ct.customerId && custs[ct.customerId]) custs[ct.customerId].p += Number(p.amount || 0); });
            rows = Object.keys(custs).map(k => [(custById(k) || {}).name || k, custs[k].u.size, egp(custs[k].p)]);
            break;
        case 'inst_due':
            title = 'تقرير الأقساط المستحقة'; headers = ['الوحدة', 'العميل', 'المبلغ', 'تاريخ الاستحقاق'];
            let inst = state.installments.filter(i => i.status !== 'مدفوع');
            if (from) inst = inst.filter(i => i.dueDate >= from); if (to) inst = inst.filter(i => i.dueDate <= to);
            rows = inst.map(i => [unitCode(i.unitId), (custById(state.contracts.find(c => c.unitId === i.unitId)?.customerId) || {}).name, egp(i.amount), i.dueDate]);
            break;
        case 'inst_overdue':
            title = 'تقرير الأقساط المتأخرة فقط'; headers = ['الوحدة', 'العميل', 'المبلغ', 'تاريخ الاستحقاق', 'أيام التأخير'];
            const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
            let overdueInst = state.installments.filter(i => i.status !== 'مدفوع' && i.dueDate && new Date(i.dueDate) < todayDate);
            if (from) overdueInst = overdueInst.filter(i => i.dueDate >= from); if (to) overdueInst = overdueInst.filter(i => i.dueDate <= to);
            rows = overdueInst.map(i => { const delay = Math.floor((todayDate - new Date(i.dueDate)) / (1000 * 60 * 60 * 24)); return [unitCode(i.unitId), (custById(state.contracts.find(c => c.unitId === i.unitId)?.customerId) || {}).name, egp(i.amount), i.dueDate, `${delay} يوم`] });
            break;
        case 'payments_monthly':
            title = 'تقرير المدفوعات الشهرية'; headers = ['الشهر', 'إجمالي المدفوعات'];
            let pays = state.payments.slice();
            if (from) pays = pays.filter(p => p.date >= from); if (to) pays = pays.filter(p => p.date <= to);
            const months = {}; pays.forEach(p => { const ym = p.date.slice(0, 7); months[ym] = (months[ym] || 0) + Number(p.amount || 0); });
            rows = Object.keys(months).sort().map(k => [k, egp(months[k])]);
            break;
        case 'partner_profits':
            title = 'تقرير أرباح الشركاء'; headers = ['الشريك', 'الوحدة', 'إجمالي الدفعة', 'نسبة الشريك', 'ربح الشريك'];
            let partnerPays = state.payments.slice();
            if (from) partnerPays = partnerPays.filter(p => p.date >= from); if (to) partnerPays = partnerPays.filter(p => p.date <= to);
            const partnerIdForProfit = viewNode.querySelector('#rep-partner-sel')?.value;
            partnerPays.forEach(p => {
                const links = state.unitPartners.filter(up => up.unitId === p.unitId && (!partnerIdForProfit || up.partnerId === partnerIdForProfit));
                links.forEach(l => { const profit = Math.round((p.amount * l.percent / 100) * 100) / 100; rows.push([(partnerById(l.partnerId) || {}).name || '—', unitCode(p.unitId), egp(p.amount), l.percent + '%', egp(profit)]); });
            });
            break;
        case 'partner_cashflow':
            title = 'تقرير ملخص تدفقات الشريك'; headers = ['الشهر', 'إجمالي حصة الأرباح'];
            const partnerId = viewNode.querySelector('#rep-partner-sel')?.value;
            if (!partnerId) { out.innerHTML = '<p style=\"color:var(--warn)\">الرجاء اختيار شريك لعرض هذا التقرير.</p>'; return; }
            const partner = partnerById(partnerId); title += ` - ${partner.name}`;
            let paysForPartner = state.payments.slice();
            if (from) paysForPartner = paysForPartner.filter(p => p.date >= from); if (to) paysForPartner = paysForPartner.filter(p => p.date <= to);
            const monthlyProfits = {};
            paysForPartner.forEach(p => { const link = state.unitPartners.find(up => up.unitId === p.unitId && up.partnerId === partnerId); if (link) { const profit = (p.amount * link.percent / 100); const month = p.date.slice(0, 7); monthlyProfits[month] = (monthlyProfits[month] || 0) + profit; } });
            rows = Object.keys(monthlyProfits).sort().map(month => [month, egp(monthlyProfits[month])]);
            break;
        case 'cashflow':
            title = 'تقرير التدفقات النقدية العامة'; headers = ['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد'];
            let trans = [];
            let payFlow = state.payments.slice();
            if (from) payFlow = payFlow.filter(p => p.date >= from); if (to) payFlow = payFlow.filter(p => p.date <= to);
            payFlow.forEach(p => trans.push({ d: p.date, n: `دفعة وحدة ${unitCode(p.unitId)}`, i: p.amount, o: 0 }));
            state.contracts.forEach(c => { if (c.brokerAmount > 0) { const include = (!from || c.start >= from) && (!to || c.start <= to); if (include) { trans.push({ d: c.start, n: `عمولة سمسار ${unitCode(c.unitId)}`, i: 0, o: c.brokerAmount }); } } });
            trans.sort((a, b) => a.d.localeCompare(b.d));
            let bal = 0;
            rows = trans.map(t => { bal += Number(t.i || 0) - Number(t.o || 0); return [t.d, t.n, egp(t.i), egp(t.o), egp(bal)]; });
            break;
    }
    lastReportData = { title, headers, rows };
    const bodyHTML = `<h1>${title}</h1>` + table(headers, rows);
    out.innerHTML = bodyHTML + `<div class="tools"><button class="btn" id="print-last-report-btn">طباعة PDF</button></div>`;
    out.querySelector('#print-last-report-btn').onclick = printLastReport;
}

export function renderReports(view) {
    viewNode = view;
    let selectedReportType = null;
    view.innerHTML = `
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
      <div id="rep-filters-container" class="grid grid-4" style="gap:8px; align-items: end; margin-bottom: 16px;"></div>

      <div class="tools">
        <button class="btn" id="generate-report-btn" style="flex:1; padding: 12px; font-size: 16px;">إنشاء التقرير</button>
        <button class="btn secondary" id="reset-filters-btn" style="padding: 12px; font-size: 16px;">مسح الفلتر</button>
      </div>
      <hr>
      <div id="rep-out"></div>
    </div>`;

    const filtersContainer = viewNode.querySelector('#rep-filters-container');
    viewNode.querySelectorAll('.report-btn').forEach(btn => {
        btn.onclick = () => {
            viewNode.querySelectorAll('.report-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedReportType = btn.dataset.type;
            filtersContainer.innerHTML = '';
            const needsDates = ['payments_monthly', 'cashflow', 'partner_profits', 'inst_due', 'inst_overdue', 'cust_activity', 'partner_cashflow'];
            const needsPartner = ['partner_profits', 'partner_cashflow'];
            if (needsDates.includes(selectedReportType)) filtersContainer.innerHTML += `<input type="date" class="input" id="rep-from" placeholder="من تاريخ"><input type="date" class="input" id="rep-to" placeholder="إلى تاريخ">`;
            if (needsPartner.includes(selectedReportType)) filtersContainer.innerHTML += `<select id="rep-partner-sel" class="select"><option value="">اختر شريك...</option>${state.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>`;
        };
    });
    viewNode.querySelector('#generate-report-btn').onclick = () => {
        if (!selectedReportType) return alert('الرجاء اختيار نوع التقرير أولاً.');
        runReport(selectedReportType);
    };
    viewNode.querySelector('#reset-filters-btn').onclick = () => {
        filtersContainer.querySelectorAll('input, select').forEach(el => el.value = '');
        viewNode.querySelector('#rep-out').innerHTML = '';
    };
}
