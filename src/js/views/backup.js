import { state, saveState, persist } from '../state.js';
import { today } from '../utils.js';

let viewNode;
let navFunc;

function doBackup() {
    const data = JSON.stringify(state);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estate-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function restoreBackup(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!confirm('سيتم استبدال كل البيانات الحالية. هل أنت متأكد؟')) return;
    const r = new FileReader();
    r.onload = () => {
        try {
            saveState();
            const restored = JSON.parse(String(r.result));
            Object.keys(state).forEach(key => delete state[key]); // Clear current state
            Object.assign(state, restored); // Assign new state
            persist();
            alert('تمت الاستعادة بنجاح');
            navFunc('dash');
        } catch (err) {
            alert('ملف غير صالح');
        }
    };
    r.readAsText(f);
}

function doExcelBackup() {
    try {
        const wb = XLSX.utils.book_new();
        const dataMap = {
            'العملاء': state.customers, 'الوحدات': state.units, 'الشركاء': state.partners,
            'شركاءالوحدات': state.unitPartners, 'العقود': state.contracts, 'الأقساط': state.installments,
            'المدفوعات': state.payments, 'الإعدادات': [state.settings]
        };
        for (const sheetName in dataMap) {
            if (dataMap[sheetName] && dataMap[sheetName].length > 0) {
                const ws = XLSX.utils.json_to_sheet(dataMap[sheetName]);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            }
        }
        XLSX.writeFile(wb, `estate-backup-${today()}.xlsx`);
    } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء إنشاء ملف Excel.');
    }
}

function doExcelRestore(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('سيتم استبدال كل البيانات الحالية ببيانات ملف Excel. هل أنت متأكد؟')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = event.target.result;
            const workbook = XLSX.read(data, { type: 'array' });
            saveState();
            const newState = {
                customers: [], units: [], partners: [], unitPartners: [],
                contracts: [], installments: [], payments: [],
                settings: state.settings, locked: state.locked
            };
            workbook.SheetNames.forEach(sheetName => {
                const ws = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(ws);
                switch (sheetName) {
                    case 'العملاء': newState.customers = jsonData; break;
                    case 'الوحدات': newState.units = jsonData; break;
                    case 'الشركاء': newState.partners = jsonData; break;
                    case 'شركاءالوحدات': newState.unitPartners = jsonData; break;
                    case 'العقود': newState.contracts = jsonData; break;
                    case 'الأقساط': newState.installments = jsonData; break;
                    case 'المدفوعات': newState.payments = jsonData; break;
                    case 'الإعدادات': if (jsonData[0]) Object.assign(newState.settings, jsonData[0]); break;
                }
            });
            Object.keys(state).forEach(key => delete state[key]);
            Object.assign(state, newState);
            persist();
            alert('تمت استعادة البيانات من ملف Excel بنجاح.');
            navFunc('dash');
        } catch (err) {
            console.error(err);
            alert('ملف Excel غير صالح أو حدث خطأ أثناء القراءة.');
        }
    };
    reader.readAsArrayBuffer(file);
}

function doReset() {
    if (prompt('اكتب "مسح" لتأكيد حذف كل البيانات') === 'مسح') {
        saveState();
        localStorage.removeItem('estate_pro_final_v3');
        location.reload();
    }
}

export function renderBackup(view, nav) {
    viewNode = view;
    navFunc = nav;
    view.innerHTML = `
      <div class="card">
        <h3>نسخة احتياطية</h3>
        <p>يتم حفظ بياناتك في متصفحك. قم بتنزيل نسخة احتياطية بشكل دوري.</p>
        <div class="tools">
          <button class="btn" id="backup-json-btn">تنزيل نسخة JSON</button>
          <label class="btn secondary"><input type="file" id="restore-file" accept=".json" style="display:none">استعادة نسخة JSON</label>
          <button class="btn ok" id="backup-excel-btn">تنزيل نسخة Excel</button>
          <label class="btn ok secondary"><input type="file" id="restore-excel-file" accept=".xlsx, .xls" style="display:none">استعادة نسخة Excel</label>
          <button class="btn warn" id="reset-btn">مسح كل البيانات</button>
        </div>
      </div>`;

    viewNode.querySelector('#backup-json-btn').onclick = doBackup;
    viewNode.querySelector('#restore-file').onchange = restoreBackup;
    viewNode.querySelector('#backup-excel-btn').onclick = doExcelBackup;
    viewNode.querySelector('#restore-excel-file').onchange = doExcelRestore;
    viewNode.querySelector('#reset-btn').onclick = doReset;
}
