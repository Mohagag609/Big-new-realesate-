import { state, saveState, persist } from '../state.js';
import { uid, table, unitById, partnerById, parseNumber } from '../utils.js';

let viewNode;
let navFunc;
let currentUnit;

function addPartnerToUnit() {
    const partnerId = viewNode.querySelector('#ud-pr-select').value;
    const percent = parseNumber(viewNode.querySelector('#ud-pr-percent').value);
    if (!partnerId || !(percent > 0)) return alert('الرجاء اختيار شريك وإدخال نسبة صحيحة.');

    if (state.unitPartners.find(up => up.unitId === currentUnit.id && up.partnerId === partnerId)) {
        return alert('هذا الشريك تم إضافته بالفعل لهذه الوحدة.');
    }

    saveState();
    state.unitPartners.push({ id: uid('UP'), unitId: currentUnit.id, partnerId, percent });
    persist();
    drawPartners();
}

function removePartnerFromUnit(linkId) {
    if (!confirm('هل أنت متأكد من حذف هذا الشريك من الوحدة؟')) return;
    saveState();
    state.unitPartners = state.unitPartners.filter(up => up.id !== linkId);
    persist();
    drawPartners();
}

function drawPartners() {
    const listNode = viewNode.querySelector('#ud-partners-list');
    const links = state.unitPartners.filter(up => up.unitId === currentUnit.id);
    const rows = links.map(link => {
        const partner = partnerById(link.partnerId);
        return [
            partner ? partner.name : 'شريك محذوف',
            link.percent + ' %',
            `<button class="btn secondary" data-id="${link.id}">حذف</button>`
        ];
    });
    listNode.innerHTML = table(['الشريك', 'النسبة', ''], rows);

    listNode.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => removePartnerFromUnit(btn.dataset.id);
    });

    const sum = links.reduce((s, p) => s + Number(p.percent || 0), 0);
    const sumEl = viewNode.querySelector('#ud-partners-sum');
    sumEl.textContent = sum + ' %';
    sumEl.className = 'badge ' + (sum > 100 ? 'warn' : (sum === 100 ? 'ok' : 'info'));
}

function attachEventListeners() {
    viewNode.querySelector('#back-to-units-btn').onclick = () => navFunc('units');
    viewNode.querySelector('#add-partner-to-unit-btn').onclick = addPartnerToUnit;
}

export function renderUnitDetails(view, nav, unitId) {
    viewNode = view;
    navFunc = nav;
    currentUnit = unitById(unitId);

    if (!currentUnit) {
        alert('لم يتم العثور على الوحدة');
        return navFunc('units');
    }

    view.innerHTML = `
      <div class="card">
          <div class="header" style="justify-content: space-between;">
              <h1>إدارة الوحدة — ${currentUnit.code}</h1>
              <button class="btn secondary" id="back-to-units-btn">⬅️ العودة للوحدات</button>
          </div>
          <p><b>اسم الوحدة:</b> ${currentUnit.name || '—'} | <b>العمارة:</b> ${currentUnit.building || '—'} | <b>الدور:</b> ${currentUnit.floor || '—'}</p>

          <div class="card" style="margin-top:16px;">
              <h3>الشركاء في هذه الوحدة</h3>
              <div id="ud-partners-list"></div>
              <hr>
              <h4>إضافة شريك جديد</h4>
              <div class="tools" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                  <select class="select" id="ud-pr-select" style="flex:1;"><option value="">اختر شريك...</option>${state.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
                  <input class="input" id="ud-pr-percent" type="number" min="0.1" max="100" step="0.1" placeholder="النسبة %" style="flex:0.5;">
                  <button class="btn" id="add-partner-to-unit-btn">إضافة</button>
                  <span class="badge" id="ud-partners-sum">0 %</span>
              </div>
              <small style="color:var(--muted)">أضف شركاء للوحدة من هنا. مجموع النسب يجب أن يكون 100%.</small>
          </div>
      </div>
    `;

    attachEventListeners();
    drawPartners();
}
