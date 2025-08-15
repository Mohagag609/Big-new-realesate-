import { state, saveState, persist } from '../state.js';
import { uid, table, exportCSV, printHTML } from '../utils.js';

let sort = { idx: 0, dir: 'asc' };
let viewNode;

function inlineUpdate(id, key, value) {
    saveState();
    const item = state.customers.find(x => x.id === id);
    if (item) {
        item[key] = value;
        persist();
    }
}

function deleteCustomer(id) {
    if (confirm('هل أنت متأكد من الحذف؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        saveState();
        state.customers = state.customers.filter(x => x.id !== id);
        // Also check if this customer is linked to any contracts
        const isLinked = state.contracts.some(c => c.customerId === id);
        if (isLinked) {
            alert('تحذير: هذا العميل مرتبط بعقد واحد أو أكثر. قد تحتاج إلى مراجعة العقود.');
        }
        persist();
        draw();
    }
}

function addCustomer() {
    const nameInput = viewNode.querySelector('#c-name');
    const phoneInput = viewNode.querySelector('#c-phone');
    const name = nameInput.value.trim();
    if (!name) return alert('اكتب اسم');
    saveState();
    state.customers.push({ id: uid('C'), name, phone: phoneInput.value || '' });
    persist();
    draw();
    nameInput.value = '';
    phoneInput.value = '';
}

function expCustomers() {
    exportCSV(['الاسم', 'الهاتف'], state.customers.map(c => [c.name || '', c.phone || '']), 'customers.csv');
}

function impCustomers(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
        saveState();
        const lines = String(r.result).split(/\r?\n/).slice(1);
        lines.forEach(line => {
            const [name, phone] = line.split(',').map(x => x?.replace(/^"|"$/g, '') || '');
            if (name) state.customers.push({ id: uid('C'), name, phone });
        });
        persist();
        draw();
    };
    r.readAsText(f, 'utf-8');
}

function printCustomers() {
    const rows = state.customers.map(c => `<tr><td>${c.name || ''}</td><td>${c.phone || ''}</td></tr>`).join('');
    printHTML('تقرير العملاء', `<h1>تقرير العملاء</h1><table><thead><tr><th>الاسم</th><th>الهاتف</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function draw() {
    const q = (viewNode.querySelector('#c-q')?.value || '').trim().toLowerCase();
    let list = state.customers.slice();
    if (q) {
        list = list.filter(c => {
            const searchable = `${c.name || ''} ${c.phone || ''}`.toLowerCase();
            return searchable.includes(q);
        });
    }
    list.sort((a, b) => {
        const cols = [a.name || '', a.phone || ''];
        const colsB = [b.name || '', b.phone || ''];
        return (cols[sort.idx] + '').localeCompare(colsB[sort.idx] + '') * (sort.dir === 'asc' ? 1 : -1);
    });
    const rows = list.map(c => [
        `<span contenteditable="true" onblur="this.getRootNode().host.inlineUpdate('${c.id}','name',this.textContent)">${c.name || ''}</span>`,
        `<span contenteditable="true" onblur="this.getRootNode().host.inlineUpdate('${c.id}','phone',this.textContent)">${c.phone || ''}</span>`,
        `<button class="btn secondary" data-id="${c.id}">حذف</button>`
    ]);
    const listNode = viewNode.querySelector('#c-list');
    listNode.innerHTML = table(['الاسم', 'الهاتف', ''], rows, sort, (ns) => { sort = ns; draw(); });

    // Add event listeners after rendering
    listNode.querySelectorAll('th').forEach(th => {
        th.onclick = () => {
            const idx = Number(th.dataset.idx);
            const dir = sort && sort.idx === idx && sort.dir === 'asc' ? 'desc' : 'asc';
            sort = { idx, dir };
            draw();
        };
    });
    listNode.querySelectorAll('.btn.secondary').forEach(btn => {
        btn.onclick = () => deleteCustomer(btn.dataset.id);
    });
    listNode.querySelectorAll('[contenteditable]').forEach(span => {
        span.onblur = (e) => {
            const id = e.target.closest('tr').querySelector('.btn').dataset.id;
            const key = e.target.dataset.key; // We need to add data-key to the spans
            inlineUpdate(id, key, e.target.textContent);
        }
    });
}

function attachEventListeners() {
    viewNode.querySelector('#c-q').oninput = draw;
    viewNode.querySelector('#add-customer-btn').onclick = addCustomer;
    viewNode.querySelector('#exp-csv-btn').onclick = expCustomers;
    viewNode.querySelector('#imp-csv-label input').onchange = impCustomers;
    viewNode.querySelector('#print-pdf-btn').onclick = printCustomers;
}

export function renderCustomers(view) {
    viewNode = view;
    view.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <h3>إضافة عميل</h3>
          <input class="input" id="c-name" placeholder="اسم العميل">
          <input class="input" id="c-phone" placeholder="الهاتف">
          <button class="btn" id="add-customer-btn">حفظ</button>
        </div>
        <div class="card">
          <h3>العملاء</h3>
          <div class="tools">
            <input class="input" id="c-q" placeholder="بحث">
            <button class="btn secondary" id="exp-csv-btn">CSV</button>
            <label class="btn secondary" id="imp-csv-label"><input type="file" accept=".csv" style="display:none">استيراد CSV</label>
            <button class="btn" id="print-pdf-btn">طباعة PDF</button>
          </div>
          <div id="c-list"></div>
        </div>
      </div>`;

    // The inline onblur handlers in the original code are tricky with module scope.
    // A better way is to attach events after rendering.
    // To do that, we need to be able to call the functions from the event listeners.
    // We can't use `getRootNode().host` easily here, so we will attach them directly.
    // But first, let's refactor the draw function to handle this.

    const listNode = viewNode.querySelector('#c-list');
    listNode.addEventListener('blur', (e) => {
        if (e.target.hasAttribute('contenteditable')) {
            const id = e.target.closest('tr').querySelector('.btn.secondary').dataset.id;
            const key = e.target.dataset.key;
            inlineUpdate(id, key, e.target.textContent);
        }
    }, true);


    // A better approach for draw():
    function draw() {
        const q = (viewNode.querySelector('#c-q')?.value || '').trim().toLowerCase();
        let list = state.customers.slice();
        if (q) {
            list = list.filter(c => {
                const searchable = `${c.name || ''} ${c.phone || ''}`.toLowerCase();
                return searchable.includes(q);
            });
        }
        list.sort((a, b) => {
            const cols = [a.name || '', a.phone || ''];
            const colsB = [b.name || '', b.phone || ''];
            const valA = cols[sort.idx] || '';
            const valB = colsB[sort.idx] || '';
            return valA.localeCompare(valB) * (sort.dir === 'asc' ? 1 : -1);
        });
        const rows = list.map(c => [
            `<span contenteditable="true" data-key="name">${c.name || ''}</span>`,
            `<span contenteditable="true" data-key="phone">${c.phone || ''}</span>`,
            `<button class="btn secondary" data-id="${c.id}">حذف</button>`
        ]);

        listNode.innerHTML = table(['الاسم', 'الهاتف', ''], rows, sort);

        listNode.querySelectorAll('th').forEach(th => {
            th.onclick = () => {
                const idx = Number(th.dataset.idx);
                const dir = sort && sort.idx === idx && sort.dir === 'asc' ? 'desc' : 'asc';
                sort = { idx, dir };
                draw();
            };
        });
        listNode.querySelectorAll('.btn.secondary').forEach(btn => {
            btn.onclick = () => deleteCustomer(btn.dataset.id);
        });
    }

    attachEventListeners();
    draw();
}
