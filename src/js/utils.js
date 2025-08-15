import { state } from './state.js';

/* ===== General Purpose Helpers ===== */

/**
 * Generates a unique ID with a given prefix.
 * @param {string} p - The prefix for the ID.
 * @returns {string} A unique ID string.
 */
export function uid(p) { return p + '-' + Math.random().toString(36).slice(2, 9); }

/**
 * Gets today's date in YYYY-MM-DD format.
 * @returns {string} Today's date.
 */
export function today() { return new Date().toISOString().slice(0, 10); }

/**
 * Formats a number as Egyptian Pounds (EGP).
 * @param {number} v - The value to format.
 * @returns {string} The formatted currency string.
 */
const fmt = new Intl.NumberFormat('ar-EG');
export function egp(v) { v = Number(v || 0); return isFinite(v) ? fmt.format(v) + ' ج.م' : '' }

/**
 * Parses a string to a number, removing non-numeric characters.
 * @param {string} v - The string to parse.
 * @returns {number} The parsed number.
 */
export function parseNumber(v) { v = String(v || '').replace(/[^\d.]/g, ''); return Number(v || 0); }

/**
 * Triggers a browser download for a CSV file.
 * @param {string[]} headers - The CSV header row.
 * @param {Array<string[]>} rows - The data rows.
 * @param {string} name - The filename for the download.
 */
export function exportCSV(headers, rows, name) {
    const csv = [headers.join(','), ...rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}


/* ===== Data Access Helpers (Read-only) ===== */

export function unitById(id) { return state.units.find(u => u.id === id); }
export function custById(id) { return state.customers.find(c => c.id === id); }
export function partnerById(id) { return state.partners.find(p => p.id === id); }
export function unitCode(id) { return (unitById(id) || {}).code || '—'; }


/* ===== DOM & UI Helpers ===== */

/**
 * Applies theme and font settings to the document.
 */
export function applySettings() {
    document.documentElement.setAttribute('data-theme', state.settings.theme || 'dark');
    document.documentElement.style.fontSize = (state.settings.font || 16) + 'px';
}

/**
 * Renders a simple HTML table.
 * @param {string[]} headers - The table header titles.
 * @param {Array<string[]>} rows - The table data rows.
 * @param {object} sortKey - The current sort key {idx, dir}.
 * @param {function} onSort - The callback function for when a header is clicked.
 * @returns {string} The HTML string for the table.
 */
export function table(headers, rows, sortKey = null, onSort = null) {
    const head = headers.map((h, i) => `<th data-idx="${i}" style="cursor:pointer;white-space:nowrap">${h}${sortKey && sortKey.idx === i ? (sortKey.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`).join('');
    const body = rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}"><small>لا توجد بيانات</small></td></tr>`;
    const html = `<table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;

    // To make the table sortable, the innerHTML must be set first, then query for the headers.
    // The caller of this function should handle adding the event listeners.
    return html;
}

/**
 * Opens a new window and prints the given HTML content.
 * @param {string} title - The document title.
 * @param {string} bodyHTML - The HTML content to print.
 */
export function printHTML(title, bodyHTML) {
    const w = window.open('', '_blank');
    if (!w) return alert('الرجاء السماح بالنوافذ المنبثقة لطباعة التقارير.');
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

/**
 * Creates the HTML for a donut chart.
 * @param {Array<{value: number, color: string, label: string}>} items - Chart data.
 * @returns {string} The HTML string for the chart.
 */
export function createDonutChart(items) {
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0) return '<div style="text-align:center; padding: 20px; color: var(--muted);">لا توجد بيانات لعرضها</div>';

    const gradientParts = [];
    let currentDeg = 0;
    items.forEach(item => {
        const percent = item.value / total * 100;
        if (percent > 0) {
            gradientParts.push(`${item.color} ${currentDeg}deg ${currentDeg + percent * 3.6}deg`);
        }
        currentDeg += percent * 3.6;
    });

    const legend = items.map(i => `
      <div style="display:flex; align-items:center; gap: 6px; margin-bottom: 4px;">
        <div style="width:12px; height:12px; background-color:${i.color}; border-radius: 3px;"></div>
        <div>${i.label}: <strong>${i.value}</strong></div>
      </div>
    `).join('');

    return `
        <div style="display:flex; align-items:center; gap:20px; margin-top:10px;">
            <div style="width:100px; height:100px; border-radius:50%; background:conic-gradient(${gradientParts.join(',')});"></div>
            <div style="font-size:13px;">${legend}</div>
        </div>`;
}

/**
 * Creates the HTML for a bar chart.
 * @param {Array<[string, number]>} rows - Chart data.
 * @returns {string} The HTML string for the chart.
 */
export function createBarChart(rows) {
    if (!rows.length) return '<div style="text-align:center; padding: 20px; color: var(--muted);">لا توجد بيانات لعرضها</div>';

    const maxVal = Math.max(...rows.map(r => r[1]));
    if (maxVal === 0) return '<div style="text-align:center; padding: 20px; color: var(--muted);">لا توجد تدفقات نقدية قادمة</div>';

    const bars = rows.map((r, i) => {
        const percent = (r[1] / maxVal) * 100;
        return `
            <g transform="translate(${i * 55 + 10}, 0)">
                <title>${r[0]}: ${egp(r[1])}</title>
                <rect y="${100 - percent}" width="40" height="${percent}" fill="var(--brand)" rx="4"></rect>
                <text x="20" y="115" text-anchor="middle" fill="var(--muted)" font-size="10">${r[0]}</text>
            </g>
        `;
    }).join('');
    return `<svg viewBox="0 0 ${rows.length * 55 + 10} 120" width="100%" height="150" style="margin-top:10px;">${bars}</svg>`;
}
