import { state, saveState, persist } from '../state.js';
import { uid, table, unitCode, partnerById, parseNumber } from '../utils.js';

let viewNode;

function deleteRow(collection, id) {
    if (confirm('هل أنت متأكد من الحذف؟')) {
        saveState();
        state[collection] = state[collection].filter(x => x.id !== id);
        persist();
        draw();
    }
}

function addPartner() {
    const nameInput = viewNode.querySelector('#pr-name');
    const phoneInput = viewNode.querySelector('#pr-phone');
    const name = nameInput.value.trim();
    if (!name) return;
    saveState();
    state.partners.push({ id: uid('PR'), name, phone: phoneInput.value });
    persist();
    draw();
    nameInput.value = '';
    phoneInput.value = '';
}

function addUnitPartner() {
    const unitId = viewNode.querySelector('#up-unit').value;
    const partnerId = viewNode.querySelector('#up-partner').value;
    const percent = parseNumber(viewNode.querySelector('#up-percent').value);
    if (!unitId || !partnerId || !percent) return;
    saveState();
    state.unitPartners.push({ id: uid('UP'), unitId, partnerId, percent });
    persist();
    draw();
}

function draw() {
    // Draw partners list
    const prListNode = viewNode.querySelector('#pr-list');
    const prRows = state.partners.map(p => [
        p.name,
        p.phone,
        `<button class="btn secondary" data-collection="partners" data-id="${p.id}">حذف</button>`
    ]);
    prListNode.innerHTML = table(['الاسم', 'الهاتف', ''], prRows);

    // Draw unit-partners list
    const upListNode = viewNode.querySelector('#up-list');
    const upRows = state.unitPartners.map(up => [
        unitCode(up.unitId),
        (partnerById(up.partnerId) || {}).name || '—',
        up.percent + '%',
        `<button class="btn secondary" data-collection="unitPartners" data-id="${up.id}">حذف</button>`
    ]);
    upListNode.innerHTML = table(['الوحدة', 'الشريك', 'النسبة', ''], upRows);

    // Add event listeners
    viewNode.querySelectorAll('#pr-list button, #up-list button').forEach(btn => {
        btn.onclick = () => deleteRow(btn.dataset.collection, btn.dataset.id);
    });
}


function attachEventListeners() {
    viewNode.querySelector('#add-partner-btn').onclick = addPartner;
    viewNode.querySelector('#add-unit-partner-btn').onclick = addUnitPartner;
}

export function renderPartners(view) {
    viewNode = view;
    view.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <h3>إضافة شريك</h3>
          <input class="input" id="pr-name" placeholder="اسم الشريك">
          <input class="input" id="pr-phone" placeholder="الهاتف">
          <button class="btn" id="add-partner-btn">حفظ</button>
          <hr>
          <h3>ربط شريك بوحدة</h3>
          <select class="select" id="up-unit"><option value="">اختر وحدة</option>${state.units.map(u => `<option value="${u.id}">${u.code} - ${u.name || ''}</option>`).join('')}</select>
          <select class="select" id="up-partner"><option value="">اختر شريك</option>${state.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
          <input class="input" id="up-percent" placeholder="النسبة %" oninput="this.value=this.value.replace(/[^\\d.]/g,'')">
          <button class="btn" id="add-unit-partner-btn">ربط</button>
        </div>
        <div class="card">
          <h3>الشركاء</h3>
          <div id="pr-list"></div>
          <hr>
          <h3>الوحدات المشتركة</h3>
          <div id="up-list"></div>
        </div>
      </div>`;

    attachEventListeners();
    draw();
}
