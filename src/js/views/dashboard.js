import { state } from '../state.js';
import { egp, createDonutChart, createBarChart, printHTML } from '../utils.js';

/**
 * Handles the logic for printing the cash flow projection report.
 */
function printProjection() {
    const now = new Date();
    const proj = {};
    state.installments
        .filter(i => i.status !== 'مدفوع' && i.dueDate && new Date(i.dueDate) >= now)
        .forEach(i => {
            const ym = i.dueDate.slice(0, 7);
            proj[ym] = (proj[ym] || 0) + Number(i.amount || 0);
        });
    const rows = Object.keys(proj).sort().slice(0, 12).map(k => `<tr><td>${k}</td><td>${egp(proj[k])}</td></tr>`).join('');
    printHTML('تدفقات نقدية (12 شهر)', `<h1>تدفقات نقدية (12 شهر)</h1><table><thead><tr><th>الشهر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>`);
}

/**
 * Renders the main dashboard view.
 * @param {HTMLElement} view - The container element to render the view into.
 */
export function renderDashboard(view) {
    const total = state.units.length;
    const avail = state.units.filter(u => u.status === 'متاحة').length;
    const sold = state.units.filter(u => u.status === 'مباعة').length;
    const ret = state.units.filter(u => u.status === 'مرتجعة').length;
    const revenue = state.payments.reduce((s, p) => s + Number(p.amount || 0), 0);

    const now = new Date();
    const proj = {};
    state.installments
        .filter(i => i.status !== 'مدفوع' && i.dueDate && new Date(i.dueDate) >= now)
        .forEach(i => {
            const ym = i.dueDate.slice(0, 7);
            proj[ym] = (proj[ym] || 0) + Number(i.amount || 0);
        });
    const projRows = Object.keys(proj).sort().slice(0, 6).map(k => [k, proj[k]]);

    const unitChartData = [
        { value: avail, color: '#2563eb', label: 'متاحة' },
        { value: sold, color: '#16a34a', label: 'مباعة' },
        { value: ret, color: '#ef4444', label: 'مرتجعة' }
    ];

    view.innerHTML = `
    <div class="grid grid-3">
        <div class="card">
            <h3>نظرة عامة على الوحدات</h3>
            ${createDonutChart(unitChartData)}
        </div>
        <div class="card"><h3>إجمالي الوحدات</h3><div class="big">${total}</div></div>
        <div class="card"><h3>إجمالي المتحصلات</h3><div class="big">${egp(revenue)}</div></div>
    </div>
    <div class="card" style="margin-top:10px">
      <h3>التدفقات النقدية المتوقعة (6 أشهر)</h3>
      ${createBarChart(projRows)}
      <div class="tools"><button class="btn" id="print-projection">طباعة PDF</button></div>
    </div>`;

    document.getElementById('print-projection').onclick = printProjection;
}
