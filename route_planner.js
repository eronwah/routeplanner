// ==========================================
// route_planner.js - SUPABASE & MASTERLIST
// ==========================================

const baseDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const activeDays = window.allDays || Array.from({length: 28}, (_, i) => baseDays[i%7] + (Math.floor(i/7)+1));
const activeDayNames = window.dayNamesMap || {Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday'};

let supabaseData = [];    
let editingRowId = null;  
let originalRowIndex = null; 
let originalRowData = null;  
let modifiedRows = new Set(); 
let deletedRows = new Set(); 
let targetColumnToClear = null; 
let errorRowIds = new Set(); 

let isEditingAll = false;
let originalDataSnapshot = null;
let pendingBulkUpdates = null;

let seqCurrentDay = '';
let isSeqEditing = false;
let seqModifications = {}; 
let seqNewAdds = new Set(); 
let selectedSeqAccountId = null; 

const supabaseUrl = 'https://zguemnrszulnzsneqzek.supabase.co/rest/v1/route_schedules';
const supabaseKey = 'sb_publishable_vIKFtbZYeTs9nZf-Oq-OtA_QzTzqLra';

const cloudIndicator = document.getElementById('cloudStatusIndicator');
const masterlistTableBody = document.getElementById('masterlistTableBody');
const btnSaveCloud = document.getElementById('btnSaveCloud');

document.addEventListener('DOMContentLoaded', () => {
    fetchMasterlist();
    populateClearColumnOptions();
    populateSequenceInsightsDropdown();
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        if (editingRowId !== null) window.cancelInlineEdit();
        if (isEditingAll) window.cancelEditAll();
    }
});

function populateClearColumnOptions() {
    const datalist = document.getElementById('dayColumnOptions');
    if (!datalist) return;
    let optionsHTML = '';
    activeDays.forEach(day => {
        if(!day.startsWith('Sat') && !day.startsWith('Sun')) {
            let prefix = day.substring(0, 3);
            let num = day.substring(3);
            let fullName = `${activeDayNames[prefix]} ${num}`;
            optionsHTML += `<option value="${fullName}"></option>`;
        }
    });
    datalist.innerHTML = optionsHTML;
}

function populateSequenceInsightsDropdown() {
    const selector = document.getElementById('seqInsightDaySelector');
    if (!selector) return;
    let optionsHTML = '<option value="">-- Select --</option>';
    activeDays.forEach(day => {
        if(!day.startsWith('Sat') && !day.startsWith('Sun')) {
            let prefix = day.substring(0, 3);
            let num = day.substring(3);
            let fullName = `${activeDayNames[prefix]} ${num}`;
            optionsHTML += `<option value="${day}">${fullName}</option>`;
        }
    });
    selector.innerHTML = optionsHTML;
}

window.generateUniqueId = function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

window.showSuccessModal = function(msg) {
    document.getElementById('successModalMessage').innerText = msg;
    document.getElementById('successModal').classList.remove('hidden');
};

window.closeSuccessModal = function() {
    document.getElementById('successModal').classList.add('hidden');
};

window.closePreSaveErrorModal = function() {
    document.getElementById('preSaveErrorModal').classList.add('hidden');
};

window.resyncData = function() {
    fetchMasterlist();
};

// ================= PIVOT INSIGHTS CALCULATION =================
window.updatePivotInsights = function() {
    const weeks = [1, 2, 3, 4];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    weeks.forEach(w => {
        let weekTotal = 0;
        days.forEach(d => {
            let col = d + w; 
            let count = 0;
            supabaseData.forEach(row => {
                let id = row['Primary Key'] || row.CustomerCode;
                if (deletedRows.has(id)) return;
                
                if (window.isValidStrNum(row[col])) {
                    count++;
                }
            });
            
            let cell = document.getElementById(`pivot_w${w}_${d.toLowerCase()}`);
            if (cell) cell.innerText = count > 0 ? count : '-';
            weekTotal += count;
        });
        
        let avg = (weekTotal / 5).toFixed(1);
        let avgCell = document.getElementById(`pivot_w${w}_avg`);
        if (avgCell) avgCell.innerText = weekTotal > 0 ? avg : '-';
    });
};

// ================= EDIT ALL FUNCTIONS =================

window.startEditAll = function() {
    if (editingRowId) {
        alert("Please save or cancel your current row edit first.");
        return;
    }
    isEditingAll = true;
    originalDataSnapshot = JSON.parse(JSON.stringify(supabaseData));
    document.getElementById('floatingEditAllBar').classList.remove('hidden');
    renderMasterlist();
};

window.cancelEditAll = function() {
    isEditingAll = false;
    supabaseData = JSON.parse(JSON.stringify(originalDataSnapshot));
    originalDataSnapshot = null;
    pendingBulkUpdates = null;
    document.getElementById('floatingEditAllBar').classList.add('hidden');
    renderMasterlist();
};

window.reviewEditAll = function() {
    let changedRows = [];
    let hasFreqError = false;

    supabaseData.forEach(row => {
        const id = row['Primary Key'] || row.CustomerCode;
        let changes = [];
        let currentFreq = 0;
        let rowUpdates = {};

        activeDays.forEach(d => {
            let inputEl = document.getElementById('edit_' + id + '_' + d);
            if (inputEl) {
                let val = inputEl.value.trim();
                let origRow = originalDataSnapshot.find(r => (r['Primary Key'] || r.CustomerCode) == id);
                let origVal = origRow ? origRow[d] : null;
                origVal = origVal !== null && origVal !== undefined ? String(origVal) : '';

                if (val !== '') {
                    currentFreq++;
                    rowUpdates[d] = parseFloat(val);
                } else {
                    rowUpdates[d] = null;
                }

                if (val !== origVal) {
                    changes.push(d); 
                }
            }
        });

        if (currentFreq >= 5) {
            hasFreqError = true;
        }

        if (changes.length > 0) {
            changedRows.push({
                id: id,
                name: row['Customer Name'],
                newFreq: currentFreq,
                changes: changes,
                updates: rowUpdates
            });
        }
    });

    if (hasFreqError) {
        document.getElementById('freqWarningModal').classList.remove('hidden');
        return;
    }

    if (changedRows.length === 0) {
        alert("No changes detected.");
        return;
    }

    let tbody = document.getElementById('editAllSummaryBody');
    let html = '';
    changedRows.forEach(r => {
        let dayText = r.changes.map(d => {
            let prefix = d.substring(0, 3);
            let num = d.substring(3);
            return `${activeDayNames[prefix]} ${num}`;
        }).join(', ');

        html += `
            <tr class="border-b border-gray-100 hover:bg-indigo-50 transition">
                <td class="p-2 text-gray-800 font-semibold text-xs sm:text-sm border-r border-gray-100">${r.name || '-'}</td>
                <td class="p-2 text-center text-blue-600 font-bold text-xs sm:text-sm border-r border-gray-100">${r.newFreq}</td>
                <td class="p-2 text-gray-600 text-xs sm:text-sm">${dayText}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;

    pendingBulkUpdates = changedRows;
    document.getElementById('editAllSummaryModal').classList.remove('hidden');
};

window.closeEditAllSummary = function() {
    document.getElementById('editAllSummaryModal').classList.add('hidden');
};

window.saveEditAll = function() {
    if (!pendingBulkUpdates) return;

    pendingBulkUpdates.forEach(update => {
        const index = supabaseData.findIndex(r => String(r['Primary Key'] || r.CustomerCode) === String(update.id));
        if (index !== -1) {
            activeDays.forEach(d => {
                if (update.updates.hasOwnProperty(d)) {
                    supabaseData[index][d] = update.updates[d];
                }
            });
            supabaseData[index].Frequency = update.newFreq;
            modifiedRows.add(update.id);
        }
    });

    isEditingAll = false;
    originalDataSnapshot = null;
    pendingBulkUpdates = null;

    document.getElementById('editAllSummaryModal').classList.add('hidden');
    document.getElementById('floatingEditAllBar').classList.add('hidden');
    
    btnSaveCloud.classList.remove('hidden');
    renderMasterlist();
};

// ================= SINGLE EDIT FUNCTIONS =================

window.moveRowUp = function(id) {
    const index = supabaseData.findIndex(r => String(r['Primary Key'] || r.CustomerCode) === String(id));
    if (index > 0) {
        const temp = supabaseData[index - 1];
        supabaseData[index - 1] = supabaseData[index];
        supabaseData[index] = temp;
        updateFloatingBarLineNumber(id);
        renderMasterlist();
    }
};

window.moveRowDown = function(id) {
    const index = supabaseData.findIndex(r => String(r['Primary Key'] || r.CustomerCode) === String(id));
    if (index !== -1 && index < supabaseData.length - 1) {
        const temp = supabaseData[index + 1];
        supabaseData[index + 1] = supabaseData[index];
        supabaseData[index] = temp;
        updateFloatingBarLineNumber(id);
        renderMasterlist();
    }
};

window.updateFloatingBarLineNumber = function(id) {
    const idx = supabaseData.findIndex(r => String(r['Primary Key'] || r.CustomerCode) === String(id));
    const lineNumber = idx !== -1 ? (idx + 1) : '-';
    const editTitle = document.getElementById('floatingEditTitle');
    if(editTitle) editTitle.innerText = 'Editing Line ' + lineNumber;
};

// ================= MODAL OPERATIONS =================

window.openAddRouteModal = function() {
    document.getElementById('newCustomerName').value = '';
    document.getElementById('newAccount').value = '';
    document.getElementById('newCity').value = '';
    document.getElementById('newCustomerCode').value = '';
    document.getElementById('addRouteModal').classList.remove('hidden');
};

window.closeAddRouteModal = function() {
    document.getElementById('addRouteModal').classList.add('hidden');
};

window.closeValidationErrorModal = function() {
    document.getElementById('validationErrorModal').classList.add('hidden');
};

window.closeDuplicateErrorModal = function() {
    document.getElementById('duplicateErrorModal').classList.add('hidden');
};

// SEQUENCE INSIGHTS FUNCTIONS
window.openSequenceInsightsModal = function() {
    seqCurrentDay = '';
    isSeqEditing = false;
    seqModifications = {};
    seqNewAdds.clear();
    selectedSeqAccountId = null;
    
    document.getElementById('seqInsightDaySelector').value = '';
    document.getElementById('seqInsightTableBody').innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-500 italic">Please select a day.</td></tr>`;
    
    document.getElementById('btnSeqEdit').classList.add('hidden');
    document.getElementById('btnSeqAdd').classList.add('hidden');
    document.getElementById('btnSeqSave').classList.add('hidden');

    document.getElementById('sequenceInsightsModal').classList.remove('hidden');
};

window.closeSequenceInsightsModal = function() {
    seqCurrentDay = '';
    isSeqEditing = false;
    seqModifications = {};
    seqNewAdds.clear();
    document.getElementById('sequenceInsightsModal').classList.add('hidden');
};

window.renderSequenceInsightsTable = function() {
    seqCurrentDay = document.getElementById('seqInsightDaySelector').value;
    const tbody = document.getElementById('seqInsightTableBody');
    
    if (!seqCurrentDay) {
        tbody.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-500 italic">Please select a day.</td></tr>`;
        document.getElementById('btnSeqEdit').classList.add('hidden');
        document.getElementById('btnSeqAdd').classList.add('hidden');
        document.getElementById('btnSeqSave').classList.add('hidden');
        return;
    }

    document.getElementById('btnSeqEdit').classList.remove('hidden');
    if(isSeqEditing) {
        document.getElementById('btnSeqAdd').classList.remove('hidden');
    } else {
        document.getElementById('btnSeqAdd').classList.add('hidden');
        document.getElementById('btnSeqSave').classList.add('hidden');
    }

    let combinedData = supabaseData.filter(row => {
        let id = row['Primary Key'] || row.CustomerCode;
        return window.isValidStrNum(row[seqCurrentDay]) || seqNewAdds.has(id);
    });

    let displayData = combinedData.map(row => {
        let id = row['Primary Key'] || row.CustomerCode;
        let currentVal = seqModifications.hasOwnProperty(id) ? seqModifications[id] : row[seqCurrentDay];
        return { ...row, _tempSeq: currentVal };
    });

    displayData.sort((a, b) => {
        let valA = parseFloat(a._tempSeq);
        let valB = parseFloat(b._tempSeq);
        let isNumA = !isNaN(valA);
        let isNumB = !isNaN(valB);
        if(!isNumA && !isNumB) return 0;
        if(!isNumA) return -1; 
        if(!isNumB) return 1;
        return valA - valB;
    });

    if (displayData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-500 italic">No schedules found for this day.</td></tr>`;
        return;
    }

    let rowsHtml = '';
    displayData.forEach(row => {
        let id = row['Primary Key'] || row.CustomerCode;
        let originalVal = row[seqCurrentDay];
        let currentVal = row._tempSeq;
        
        let isAdded = seqNewAdds.has(id);
        let isModified = seqModifications.hasOwnProperty(id) && String(seqModifications[id]) !== String(originalVal);
        let isEmpty = currentVal === null || currentVal === '' || currentVal === undefined;

        let trClass = 'border-b border-gray-100 transition ';
        if (isEmpty && (isAdded || isModified)) {
            trClass += 'bg-red-50'; 
        } else if (isAdded || isModified) {
            trClass += 'bg-yellow-100'; 
        } else {
            trClass += 'hover:bg-gray-50 bg-white';
        }

        let seqColHTML = '';
        if (isSeqEditing) {
            seqColHTML = `<input type="number" class="w-full h-full p-1 text-center bg-transparent outline-none font-bold text-blue-600 no-spinners" value="${isEmpty ? '' : currentVal}" oninput="if(this.value === '0') this.value = ''; handleSeqInput('${id}', this.value)" placeholder="-">`;
        } else {
            seqColHTML = `<span class="font-bold text-blue-600 inline-block w-full text-center">${isEmpty ? '-' : currentVal}</span>`;
        }

        rowsHtml += `
            <tr id="seq_tr_${id}" class="${trClass}">
                <td class="p-2 px-3 text-gray-800 font-semibold text-xs sm:text-sm border-r border-gray-100">${row['Customer Name'] || '-'} <span class="text-[9px] text-gray-400 font-normal ml-1">(${row.CustomerCode})</span></td>
                <td class="p-0 align-middle w-[60px] sm:w-[80px]">
                    ${seqColHTML}
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = rowsHtml;
    updateSeqSaveBtnVisibility();
};

window.toggleSeqEdit = function() {
    isSeqEditing = true;
    renderSequenceInsightsTable();
};

window.handleSeqInput = function(id, val) {
    seqModifications[id] = val;
    updateSeqSaveBtnVisibility();
    
    const tr = document.getElementById(`seq_tr_${id}`);
    if(!tr) return;

    let isAdded = seqNewAdds.has(id);
    let isEmpty = val === null || val === '' || val === undefined;
    let row = supabaseData.find(r => (r['Primary Key'] || r.CustomerCode) == id);
    let originalVal = row ? row[seqCurrentDay] : null;
    let isModified = String(originalVal) !== String(val);

    tr.className = 'border-b border-gray-100 transition ';
    if(isEmpty && (isAdded || isModified)) {
        tr.classList.add('bg-red-50');
    } else if (isAdded || isModified) {
        tr.classList.add('bg-yellow-100');
    } else {
        tr.classList.add('bg-white', 'hover:bg-gray-50');
    }
};

window.updateSeqSaveBtnVisibility = function() {
    let hasChanges = seqNewAdds.size > 0 || Object.keys(seqModifications).some(id => {
        let row = supabaseData.find(r => (r['Primary Key'] || r.CustomerCode) == id);
        return String(row[seqCurrentDay] || '') !== String(seqModifications[id] || '');
    });
    
    if (hasChanges) {
        document.getElementById('btnSeqSave').classList.remove('hidden');
    } else {
        document.getElementById('btnSeqSave').classList.add('hidden');
    }
};

window.openSeqAddModal = function() {
    document.getElementById('seqSearchInput').value = '';
    document.getElementById('seqSearchResults').innerHTML = '';
    document.getElementById('seqAddModal').classList.remove('hidden');
};

window.closeSeqAddModal = function() {
    document.getElementById('seqAddModal').classList.add('hidden');
};

window.searchSeqAccounts = function() {
    const query = document.getElementById('seqSearchInput').value.toLowerCase();
    const resultsContainer = document.getElementById('seqSearchResults');
    
    if(query.length < 2) {
        resultsContainer.innerHTML = '<p class="text-xs text-gray-500 italic p-2">Type at least 2 characters...</p>';
        return;
    }

    let availableData = supabaseData.filter(r => {
        let id = r['Primary Key'] || r.CustomerCode;
        let hasSchedules = window.isValidStrNum(r[seqCurrentDay]);
        let isAlreadyAdded = seqNewAdds.has(id);
        return !hasSchedules && !isAlreadyAdded;
    });

    let filtered = availableData.filter(r => {
        let name = (r['Customer Name'] || '').toLowerCase();
        let code = (r['CustomerCode'] || '').toLowerCase();
        return name.includes(query) || code.includes(query);
    }).slice(0, 15); 

    if(filtered.length === 0) {
        resultsContainer.innerHTML = '<p class="text-xs text-gray-500 italic p-2">No matching accounts found.</p>';
        return;
    }

    let html = '';
    filtered.forEach(r => {
        let id = r['Primary Key'] || r.CustomerCode;
        html += `
            <div class="flex justify-between items-center p-2 hover:bg-gray-50 border-b border-gray-100">
                <div>
                    <p class="text-xs font-bold text-gray-800">${r['Customer Name'] || '-'}</p>
                    <p class="text-[10px] text-gray-500 font-mono">${r.CustomerCode || '-'}</p>
                </div>
                <button onclick="selectSeqAccount('${id}')" class="bg-blue-50 text-blue-600 px-3 py-1 rounded text-xs font-bold hover:bg-blue-100 border border-blue-200 shadow-sm transition">Select</button>
            </div>
        `;
    });
    resultsContainer.innerHTML = html;
};

window.selectSeqAccount = function(id) {
    selectedSeqAccountId = id;
    document.getElementById('seqAddModal').classList.add('hidden');
    document.getElementById('seqConfirmAddModal').classList.remove('hidden');
};

window.closeSeqConfirmAddModal = function() {
    document.getElementById('seqConfirmAddModal').classList.add('hidden');
    document.getElementById('seqAddModal').classList.remove('hidden');
};

window.confirmAddSeqAccount = function() {
    if(selectedSeqAccountId) {
        seqNewAdds.add(selectedSeqAccountId);
        seqModifications[selectedSeqAccountId] = ''; 
    }
    document.getElementById('seqConfirmAddModal').classList.add('hidden');
    renderSequenceInsightsTable();
};

window.closeSeqValidationModal = function() {
    document.getElementById('seqValidationModal').classList.add('hidden');
};

window.closeSeqLocalSuccessModal = function() {
    document.getElementById('seqLocalSuccessModal').classList.add('hidden');
};

window.saveSequenceInsights = function() {
    let allItemsIds = supabaseData
        .filter(r => window.isValidStrNum(r[seqCurrentDay]) || seqNewAdds.has(r['Primary Key'] || r.CustomerCode))
        .map(r => r['Primary Key'] || r.CustomerCode);

    let hasEmpty = false;
    for(let id of allItemsIds) {
        let row = supabaseData.find(r=> (r['Primary Key']||r.CustomerCode)==id);
        let val = seqModifications.hasOwnProperty(id) ? seqModifications[id] : (row ? row[seqCurrentDay] : null);
        if(val === '' || val === null || val === undefined) {
            hasEmpty = true;
            break;
        }
    }

    if(hasEmpty) {
        document.getElementById('seqValidationModal').classList.remove('hidden');
        return;
    }

    Object.keys(seqModifications).forEach(id => {
        let row = supabaseData.find(r => (r['Primary Key'] || r.CustomerCode) == id);
        if(row) {
            row[seqCurrentDay] = parseFloat(seqModifications[id]);
            let count = 0;
            activeDays.forEach(d => { if(window.isValidStrNum(row[d])) count++; });
            row.Frequency = count;
            modifiedRows.add(id);
        }
    });

    isSeqEditing = false;
    seqModifications = {};
    seqNewAdds.clear();
    
    renderMasterlist();
    renderSequenceInsightsTable();
    document.getElementById('btnSaveCloud').classList.remove('hidden');
    document.getElementById('seqLocalSuccessModal').classList.remove('hidden');
};

window.proceedToAddRouteConfirm = function() {
    const name = document.getElementById('newCustomerName').value.trim();
    const account = document.getElementById('newAccount').value.trim();
    const city = document.getElementById('newCity').value.trim();
    const code = document.getElementById('newCustomerCode').value.trim();

    if(!name || !account || !city || !code) {
        document.getElementById('validationErrorModal').classList.remove('hidden');
        return;
    }

    const isDuplicate = supabaseData.some(row => {
        const isCodeDuplicate = code.toLowerCase() !== 'new' && row['CustomerCode'] && String(row['CustomerCode']).toLowerCase() === code.toLowerCase();
        const isNameDuplicate = row['Customer Name'] && String(row['Customer Name']).toLowerCase() === name.toLowerCase();
        return isCodeDuplicate || isNameDuplicate;
    });

    if (isDuplicate) {
        document.getElementById('duplicateErrorModal').classList.remove('hidden');
        return;
    }

    document.getElementById('addRouteModal').classList.add('hidden');
    document.getElementById('confirmAddRouteModal').classList.remove('hidden');
};

window.closeConfirmAddRoute = function() {
    document.getElementById('confirmAddRouteModal').classList.add('hidden');
    document.getElementById('addRouteModal').classList.remove('hidden'); 
};

window.saveNewRoute = async function() {
    const btn = document.getElementById('btnFinalSaveRoute');
    btn.innerHTML = `<span class="loader"></span> Saving...`;
    btn.disabled = true;

    const payload = {
        "Primary Key": window.generateUniqueId(),
        "Customer Name": document.getElementById('newCustomerName').value.trim().toUpperCase(),
        "Account": document.getElementById('newAccount').value.trim().toUpperCase(),
        "City": document.getElementById('newCity').value.trim().toUpperCase(),
        "CustomerCode": document.getElementById('newCustomerCode').value.trim(),
        "PositionCode": document.getElementById('newPositionCode').value,
        "Sales Office": document.getElementById('newSalesOffice').value,
        "Frequency": 0
    };

    activeDays.forEach(d => {
        payload[d] = null;
    });

    try {
        const response = await fetch(supabaseUrl, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMsg = (errorData && errorData.message) ? errorData.message : "Failed to insert data";
            throw new Error(errorMsg);
        }

        const insertedData = await response.json();
        
        if (insertedData && insertedData.length > 0) {
            supabaseData.push(insertedData[0]);
            supabaseData = getOrderedSupabaseData();
            renderMasterlist();
        } else {
            fetchMasterlist(); 
        }

        document.getElementById('confirmAddRouteModal').classList.add('hidden');
        showSuccessModal("New route successfully added to the cloud database.");
    } catch(e) {
        alert("Error adding new route:\n\n" + e.message);
    } finally {
        btn.innerHTML = `Yes, Save`;
        btn.disabled = false;
    }
};

window.openClearColumnModal = function() {
    document.getElementById('clearColumnInput').value = '';
    document.getElementById('clearColumnModal').classList.remove('hidden');
};

window.closeClearColumnModal = function() {
    document.getElementById('clearColumnModal').classList.add('hidden');
};

window.confirmClearColumn = function() {
    const inputVal = document.getElementById('clearColumnInput').value.trim();
    if (!inputVal) {
        alert("Please select a column to clear.");
        return;
    }

    let targetKey = null;
    for (let d of activeDays) {
        let prefix = d.substring(0, 3);
        let num = d.substring(3);
        let fullName = `${activeDayNames[prefix]} ${num}`;
        if (fullName.toLowerCase() === inputVal.toLowerCase()) {
            targetKey = d;
            break;
        }
    }

    if (!targetKey) {
        alert("Invalid column name. Please select from the dropdown list.");
        return;
    }

    targetColumnToClear = targetKey;
    document.getElementById('confirmColumnNameText').innerText = inputVal;
    
    document.getElementById('clearColumnModal').classList.add('hidden');
    document.getElementById('confirmClearColumnModal').classList.remove('hidden');
};

window.cancelConfirmClearColumn = function() {
    document.getElementById('confirmClearColumnModal').classList.add('hidden');
    document.getElementById('clearColumnModal').classList.remove('hidden');
    targetColumnToClear = null;
};

window.proceedClearColumn = function() {
    if (!targetColumnToClear) return;
    
    document.getElementById('confirmClearColumnModal').classList.add('hidden');
    
    supabaseData.forEach(row => {
        let id = row['Primary Key'] || row.CustomerCode;
        if(deletedRows.has(id)) return; 

        if(row[targetColumnToClear] !== null && row[targetColumnToClear] !== '') {
            row[targetColumnToClear] = null; 
            
            let count = 0;
            activeDays.forEach(d => {
                if (window.isValidStrNum(row[d])) count++;
            });
            row.Frequency = count;
            
            modifiedRows.add(id);
        }
    });
    
    btnSaveCloud.classList.remove('hidden');
    renderMasterlist();
    targetColumnToClear = null; 
};

window.markRowForDeletion = function(id) {
    deletedRows.add(id);
    modifiedRows.delete(id); 
    document.getElementById('btnSaveCloud').classList.remove('hidden');
    renderMasterlist();
};

window.undoDeleteRow = function(id) {
    deletedRows.delete(id);
    if (modifiedRows.size === 0 && deletedRows.size === 0) {
        document.getElementById('btnSaveCloud').classList.add('hidden');
    }
    renderMasterlist();
};

function getMasterScore(row) {
    const dayOrder = { 'Mon':0, 'Tue':1, 'Wed':2, 'Thu':3, 'Fri':4, 'Sat':5, 'Sun':6 };
    let minScore = 999999;
    for (let d of activeDays) {
        if (window.isValidStrNum(row[d])) {
            let prefix = d.substring(0, 3);
            let dayIdx = dayOrder[prefix];
            let seq = parseFloat(row[d]);
            let score = dayIdx * 10000 + seq;
            if (score < minScore) minScore = score;
        }
    }
    return minScore;
}

function getOrderedSupabaseData() {
    let sortedData = [...supabaseData];
    sortedData.sort((a, b) => {
        let scoreA = getMasterScore(a);
        let scoreB = getMasterScore(b);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return (a['Customer Name'] || '').localeCompare(b['Customer Name'] || '');
    });
    return sortedData;
}

async function fetchMasterlist() {
    const syncBtn = document.getElementById('btnResync');
    
    if(supabaseData.length === 0) {
        masterlistTableBody.innerHTML = `<tr><td colspan="34" class="py-8 text-center text-blue-600 font-bold"><span class="loader"></span> Loading cloud database...</td></tr>`;
    }
    
    if(syncBtn) {
        syncBtn.innerHTML = '⏳ Syncing...';
        syncBtn.disabled = true;
    }

    try {
        const response = await fetch(supabaseUrl + '?select=*', {
            method: 'GET',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        if (!response.ok) throw new Error('Cloud response error');
        supabaseData = await response.json();
        
        supabaseData = getOrderedSupabaseData(); 
        modifiedRows.clear();
        deletedRows.clear(); 
        errorRowIds.clear(); 

        btnSaveCloud.classList.add('hidden');
        
        cloudIndicator.innerHTML = '🟢 Connected';
        cloudIndicator.classList.replace('text-gray-500', 'text-green-600');
        
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; 
        minutes = minutes < 10 ? '0' + minutes : minutes;
        
        const lastTimeElement = document.getElementById('lastUpdateTime');
        if(lastTimeElement) lastTimeElement.textContent = `Last updated: ${hours}:${minutes} ${ampm}`;

        renderMasterlist();
    } catch (error) {
        masterlistTableBody.innerHTML = `<tr><td colspan="34" class="py-8 text-center text-red-500 font-bold">Error loading database: ${error.message}</td></tr>`;
        cloudIndicator.innerHTML = '🔴 Offline';
        cloudIndicator.classList.replace('text-gray-500', 'text-red-600');
    } finally {
        if(syncBtn) {
            syncBtn.innerHTML = '🔄 Resync';
            syncBtn.disabled = false;
        }
    }
}

function clearInsightsPanel() {
    const codeEl = document.getElementById('insightCode');
    const custEl = document.getElementById('insightCustomer');
    const accEl = document.getElementById('insightAccount');
    const freqEl = document.getElementById('insightFrequency');
    const titleEl = document.getElementById('insightMiniTableTitle');
    const bodyEl = document.getElementById('insightMiniTableBody');

    if(codeEl) codeEl.textContent = '-';
    if(custEl) custEl.textContent = '-';
    if(accEl) accEl.textContent = '-';
    if(freqEl) freqEl.textContent = '-';
    if(titleEl) titleEl.textContent = 'Insights Table';
    if(bodyEl) bodyEl.innerHTML = `<tr><td colspan="2" class="p-2 text-center text-gray-400 italic">No schedule selected</td></tr>`;
}

window.updateEditingInsights = function(rowId) {
    const panel = document.getElementById('editingInsightsPanel');
    const codeEl = document.getElementById('insightCode');
    const custEl = document.getElementById('insightCustomer');
    const accEl = document.getElementById('insightAccount');
    const freqEl = document.getElementById('insightFrequency');
    const titleEl = document.getElementById('insightMiniTableTitle');
    const bodyEl = document.getElementById('insightMiniTableBody');

    if (!panel || (!editingRowId && !isEditingAll)) return;

    const rowData = supabaseData.find(r => String(r['Primary Key'] || r.CustomerCode) === String(rowId));
    if (!rowData) return;

    if(codeEl) codeEl.textContent = rowData.CustomerCode || '-';
    if(custEl) custEl.textContent = rowData['Customer Name'] || '-';
    if(accEl) accEl.textContent = rowData['Account'] || '-'; 
    if(titleEl) titleEl.textContent = 'Insights table for - ' + (rowData['Customer Name'] || '-');

    let count = 0;
    let miniTableHTML = '';
    
    activeDays.forEach(d => {
        let inputEl = document.getElementById('edit_' + rowId + '_' + d);
        let val = '';
        
        if (inputEl) {
            val = inputEl.value.trim();
        } else if (rowData[d] !== null && rowData[d] !== undefined) {
            val = String(rowData[d]);
        }

        if (val !== '' && !isNaN(parseFloat(val))) {
            count++;
            let prefix = d.substring(0, 3);
            let num = d.substring(3);
            let fullName = `${activeDayNames[prefix]} ${num}`;
            
            miniTableHTML += `
                <tr class="border-b border-gray-200 hover:bg-blue-50 transition">
                    <td class="p-1 px-2 text-gray-600 text-center text-xs sm:text-sm border-r border-gray-200">${fullName}</td>
                    <td class="p-1 px-2 font-bold text-blue-600 text-center text-xs sm:text-sm">${val}</td>
                </tr>
            `;
        }
    });

    if(freqEl) freqEl.textContent = count;
    
    if (count > 0) {
        if(bodyEl) bodyEl.innerHTML = miniTableHTML;
    } else {
        if(bodyEl) bodyEl.innerHTML = `<tr><td colspan="2" class="p-2 text-center text-gray-400 italic">No schedules set</td></tr>`;
    }

    panel.classList.remove('hidden');
};

function renderMasterlist() {
    masterlistTableBody.innerHTML = '';
    if(supabaseData.length === 0) {
        masterlistTableBody.innerHTML = `<tr><td colspan="34" class="py-6 text-center text-gray-500 italic">No records found in database.</td></tr>`;
        return;
    }

    let rowIndex = 1;
    supabaseData.forEach(row => {
        const rowId = row['Primary Key'] || row.CustomerCode;
        const isEditing = (String(editingRowId) === String(rowId)) || isEditingAll;
        const isModifiedLocally = modifiedRows.has(rowId);
        const isDeleted = deletedRows.has(rowId); 
        
        let trClass = 'border-b transition';
        if (isDeleted) {
            trClass += ' bg-red-50 opacity-60 line-through border-red-200 transition-all';
        } else if (errorRowIds.has(rowId)) {
            trClass += ' bg-red-100 border-red-400'; 
        } else if (isEditing) {
            trClass += ' bg-yellow-100 shadow-inner border-yellow-300';
        } else if (isModifiedLocally) {
            trClass += ' bg-amber-50 border-gray-100 hover:bg-amber-100';
        } else {
            trClass += ' bg-white border-gray-100 hover:bg-gray-50';
        }

        let tr = `<tr id="editing_tr_${rowId}" data-id="${rowId}" class="${trClass}">`;
        
        let actionContent = '';
        if (isDeleted) {
            actionContent = `<button onclick="undoDeleteRow('${rowId}')" class="text-gray-600 bg-gray-200 hover:bg-gray-300 px-2 py-0.5 rounded font-bold text-[8px] sm:text-[10px] w-full transition shadow-sm">↩️ Undo</button>`;
        } else if (isEditingAll) {
            actionContent = `<span class="bg-indigo-100 text-indigo-800 font-bold text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap w-full inline-block text-center">Editing All</span>`;
        } else if (isEditing) {
            actionContent = `
                <div class="flex flex-col items-center justify-center gap-1 w-full">
                    <span class="bg-yellow-300 text-yellow-900 font-bold text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-md animate-pulse whitespace-nowrap w-full inline-block text-center">Editing</span>
                    <div class="flex gap-1 w-full justify-center">
                        <button onclick="moveRowUp('${rowId}')" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded font-bold text-[8px] sm:text-[10px] transition shadow-sm w-full" title="Move Up">⬆️</button>
                        <button onclick="moveRowDown('${rowId}')" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded font-bold text-[8px] sm:text-[10px] transition shadow-sm w-full" title="Move Down">⬇️</button>
                    </div>
                </div>
            `;
        } else {
            actionContent = `
                <div class="flex gap-1 justify-center w-full">
                    <button onclick="startInlineEdit('${rowId}')" class="text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded font-bold text-[8px] sm:text-[10px] transition shadow-sm" title="Edit">✏️</button>
                    <button onclick="markRowForDeletion('${rowId}')" class="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-1.5 py-0.5 rounded font-bold text-[8px] sm:text-[10px] transition shadow-sm" title="Delete">🗑️</button>
                </div>
            `;
        }

        tr += `<td class="p-0.5 sm:p-1 text-center sticky left-0 z-10 w-[75px] ${isDeleted ? 'bg-red-50' : (errorRowIds.has(rowId) ? 'bg-red-100' : (isEditing ? 'bg-yellow-100' : (isModifiedLocally ? 'bg-amber-50' : 'bg-white')))} border-r ${isDeleted ? 'border-red-200' : (errorRowIds.has(rowId) ? 'border-red-400' : (isEditing ? 'border-yellow-300' : 'border-gray-100'))} align-middle">
            <div class="w-full mx-auto text-center">${actionContent}</div>
        </td>`;

        tr += `<td class="p-0.5 sm:p-1 border-r ${isEditing ? 'border-yellow-300' : 'border-gray-100'} align-middle bg-transparent"><div class="w-[30px] mx-auto text-center ${isEditing ? 'text-yellow-700' : 'text-gray-400'} font-bold text-[8px] sm:text-[10px]">${rowIndex++}</div></td>`;
        tr += `<td class="p-0.5 sm:p-1 border-r ${isEditing ? 'border-yellow-300' : 'border-gray-100'} align-middle bg-transparent"><div class="w-full mx-auto text-center font-mono font-bold ${isDeleted ? 'text-red-600' : 'text-blue-600'} text-[8px] sm:text-[10px] whitespace-nowrap">${row.CustomerCode || '-'}</div></td>`;

        tr += `
            <td class="p-0.5 sm:p-1 border-r ${isEditing ? 'border-yellow-300' : 'border-gray-100'} bg-transparent align-middle whitespace-nowrap">
                <div class="font-bold ${isDeleted ? 'text-red-800' : 'text-gray-800'} text-[8px] sm:text-[10px] customer-name-col" title="${row['Customer Name'] || '-'}">${row['Customer Name'] || '-'}</div>
            </td>
        `;

        const accDisplay = window.getAccountLogo(row['Account']);
        tr += `<td class="p-0.5 sm:p-1 border-r ${isEditing ? 'border-yellow-300' : 'border-gray-100'} align-middle bg-transparent text-center">
                <div class="font-semibold text-[8px] sm:text-[10px] whitespace-nowrap">${accDisplay}</div>
               </td>`;

        let actualFreq = 0;
        activeDays.forEach(d => {
            if (window.isValidStrNum(row[d])) actualFreq++;
        });
        
        let freqDisplay = actualFreq > 0 ? actualFreq : '-';
        let freqStyle = 'bg-gray-50 text-gray-700 text-center';

        if (actualFreq >= 5 && !isDeleted) {
            freqDisplay = `⚠️ ${actualFreq}`;
            freqStyle = 'text-red-700 font-bold text-center';
            if(!isEditing) tr += `<script>document.getElementById('editing_tr_${rowId}').classList.add('blink-bg');<\/script>`;
        }

        if(isEditing && !isDeleted) {
            tr += `<td id="inline_freq_display_${rowId}" class="fixed-40 border-r border-yellow-300 bg-yellow-100 text-gray-800 align-middle" title="Auto computed based on schedules">
                    <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto text-center font-bold text-[9px] sm:text-[10px]">${actualFreq > 0 ? actualFreq : '-'}</div>
                   </td>`;
        } else {
            tr += `<td class="fixed-40 border-r border-gray-100 align-middle">
                    <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto text-center font-bold text-[9px] sm:text-[10px] ${freqStyle}">${freqDisplay}</div>
                   </td>`;
        }

        activeDays.forEach(d => {
            const isWeekend = d.startsWith('Sat') || d.startsWith('Sun');
            const hideClass = isWeekend ? 'hidden' : '';

            if(isEditing && !isDeleted) {
                const val = row[d];
                if (window.isValidStrNum(val)) {
                    tr += `<td class="fixed-40 border-r border-yellow-300 bg-yellow-100 align-middle ${hideClass}" id="td_edit_${rowId}_${d}">
                            <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto flex justify-center items-center">
                                <input type="text" inputmode="numeric" size="2" maxlength="3" id="edit_${rowId}_${d}" value="${val}" onfocus="updateEditingInsights('${rowId}')" oninput="this.value=this.value.replace(/[^0-9]/g, ''); if(this.value === '0') this.value = ''; updateInlineFrequency('${rowId}')" class="edit-input no-spinners" style="text-align: center !important; margin: 0 auto !important;">
                            </div>
                           </td>`;
                } else {
                    tr += `<td class="fixed-40 border-r border-yellow-300 bg-yellow-100 align-middle ${hideClass}" id="td_edit_${rowId}_${d}">
                            <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto flex justify-center items-center">
                                <button type="button" onclick="assignNextSequence('${rowId}', '${d}')" class="btn-add-seq" title="Add Next Sequence" style="text-align: center !important; margin: 0 auto !important;">+</button>
                                <input type="hidden" id="edit_${rowId}_${d}" value="">
                            </div>
                           </td>`;
                }
            } else {
                const val = row[d];
                const hasVal = window.isValidStrNum(val);
                tr += `<td class="fixed-40 border-r border-gray-100 align-middle bg-transparent ${hideClass}">
                        <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto text-center text-[9px] sm:text-[11px] ${hasVal ? 'font-bold text-blue-700' : 'text-gray-300'}">${hasVal ? val : '-'}</div>
                       </td>`;
            }
        });

        tr += `</tr>`;
        masterlistTableBody.innerHTML += tr;
    });

    updatePivotInsights();
}

window.startInlineEdit = function(id) {
    if (isEditingAll) return;
    editingRowId = id;
    errorRowIds.delete(id);
    
    originalRowIndex = supabaseData.findIndex(r => String(r['Primary Key'] || r.CustomerCode) === String(id));
    if (originalRowIndex !== -1) {
        originalRowData = JSON.parse(JSON.stringify(supabaseData[originalRowIndex]));
    }

    document.getElementById('floatingEditBar').classList.remove('hidden');
    updateFloatingBarLineNumber(id);
    renderMasterlist();
    if(window.updateEditingInsights) window.updateEditingInsights(id);
}

window.assignNextSequence = function(rowId, day) {
    let max = 0;
    supabaseData.forEach(r => {
        let val = parseFloat(r[day]);
        if (!isNaN(val) && String(r['Primary Key'] || r.CustomerCode) !== String(rowId)) {
            if (val > max) max = val;
        }
    });
    let nextSeq = max + 1;
    
    const td = document.getElementById(`td_edit_${rowId}_${day}`);
    if(td) {
        td.innerHTML = `<div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto flex justify-center items-center"><input type="text" inputmode="numeric" size="2" maxlength="3" id="edit_${rowId}_${day}" value="${nextSeq}" onfocus="updateEditingInsights('${rowId}')" oninput="this.value=this.value.replace(/[^0-9]/g, ''); if(this.value === '0') this.value = ''; updateInlineFrequency('${rowId}')" class="edit-input text-center no-spinners animate-[fadeIn_0.3s_ease-in-out]" style="text-align: center !important; margin: 0 auto !important;"></div>`;
    }
    
    window.updateInlineFrequency(rowId);
};

window.updateInlineFrequency = function(rowId) {
    let count = 0;
    activeDays.forEach(d => {
        let inputEl = document.getElementById('edit_' + rowId + '_' + d);
        if (inputEl) {
            let val = inputEl.value;
            if (val !== '' && !isNaN(parseFloat(val))) count++;
        }
    });
    
    let freqCell = document.getElementById('inline_freq_display_' + rowId);
    let trElem = document.getElementById('editing_tr_' + rowId);
    
    if(freqCell) freqCell.innerText = count > 0 ? count : '-';
    
    if (count >= 5) {
        trElem.classList.add('blink-bg');
        if(freqCell) freqCell.classList.add('text-red-600', 'font-bold');
    } else {
        trElem.classList.remove('blink-bg');
        if(freqCell) freqCell.classList.remove('text-red-600', 'font-bold');
    }

    if(window.updateEditingInsights) {
        window.updateEditingInsights(rowId);
    }
};

window.cancelInlineEdit = function() {
    if (editingRowId && originalRowData !== null && originalRowIndex !== null) {
        const currentIndex = supabaseData.findIndex(r => String(r['Primary Key'] || r.CustomerCode) === String(editingRowId));
        if (currentIndex !== -1) {
            supabaseData.splice(currentIndex, 1);
            supabaseData.splice(originalRowIndex, 0, originalRowData);
        }
    }

    editingRowId = null;
    originalRowData = null;
    originalRowIndex = null;
    document.getElementById('floatingEditBar').classList.add('hidden');
    clearInsightsPanel();
    renderMasterlist();
}

window.saveCurrentEdit = function() {
    if(!editingRowId) return;

    let count = 0;
    activeDays.forEach(d => {
        let inputEl = document.getElementById('edit_' + editingRowId + '_' + d);
        if(inputEl && inputEl.value !== '' && !isNaN(parseFloat(inputEl.value))) count++;
    });

    if (count >= 5) {
        document.getElementById('freqWarningModal').classList.remove('hidden');
        return;
    }

    const index = supabaseData.findIndex(r => String(r['Primary Key'] || r.CustomerCode) === String(editingRowId));
    if(index !== -1) {
        if (index !== originalRowIndex) {
            const row = supabaseData[index];
            document.getElementById('editConfirmCustomerName').innerText = row['Customer Name'] || '-';
            document.getElementById('editConfirmLine').innerText = index + 1;
            document.getElementById('editConfirmModal').classList.remove('hidden');
        } else {
            proceedSaveCurrentEdit();
        }
    }
};

window.closeEditConfirmModal = function() {
    document.getElementById('editConfirmModal').classList.add('hidden');
};

window.proceedSaveCurrentEdit = function() {
    if(!editingRowId) return;
    const id = editingRowId;
    let count = 0;
    let updates = {};
    
    activeDays.forEach(d => {
        let inputEl = document.getElementById('edit_' + id + '_' + d);
        if(inputEl) {
            const val = inputEl.value;
            if (val !== '' && !isNaN(parseFloat(val))) count++;
            updates[d] = val !== '' ? parseFloat(val) : null;
        }
    });

    updates['Frequency'] = count;

    const index = supabaseData.findIndex(r => String(r['Primary Key'] || r.CustomerCode) === String(id));
    if(index !== -1) {
        supabaseData[index] = { ...supabaseData[index], ...updates };
        modifiedRows.add(id);
    }
    
    editingRowId = null;
    originalRowData = null;
    originalRowIndex = null;
    
    document.getElementById('editConfirmModal').classList.add('hidden');
    document.getElementById('floatingEditBar').classList.add('hidden');
    clearInsightsPanel(); 
    
    btnSaveCloud.classList.remove('hidden');
    renderMasterlist();
};

window.closeFreqModal = function() {
    document.getElementById('freqWarningModal').classList.add('hidden');
}

window.clearAllSchedules = function() {
    document.getElementById('clearAllModal').classList.remove('hidden');
};

window.closeClearAllModal = function() {
    document.getElementById('clearAllModal').classList.add('hidden');
};

window.confirmClearAll = function() {
    document.getElementById('clearAllModal').classList.add('hidden');
    supabaseData.forEach(row => {
        activeDays.forEach(d => row[d] = null);
        row.Frequency = 0;
        modifiedRows.add(row['Primary Key'] || row.CustomerCode);
    });
    btnSaveCloud.classList.remove('hidden');
    renderMasterlist();
};

window.saveToCloud = async function() {
    if (modifiedRows.size === 0 && deletedRows.size === 0) return;
    
    errorRowIds.clear();
    let freqErrors = [];
    let duplicateErrors = [];
    
    let nameMap = {};
    let codeMap = {};

    supabaseData.forEach((row, index) => {
        let id = row['Primary Key'] || row.CustomerCode;
        if (deletedRows.has(id)) return; 

        let lineNum = index + 1;
        let actualFreq = 0;
        
        activeDays.forEach(d => {
            if (window.isValidStrNum(row[d])) actualFreq++;
        });

        if (actualFreq > 4) {
            freqErrors.push(`<b>Line ${lineNum}:</b> ${row['Customer Name']} (Frequency: ${actualFreq})`);
            errorRowIds.add(id);
        }

        let name = (row['Customer Name'] || '').trim().toLowerCase();
        let code = (row['CustomerCode'] || '').trim().toLowerCase();

        if (name) {
            if (!nameMap[name]) nameMap[name] = [];
            nameMap[name].push({ line: lineNum, id: id, name: row['Customer Name'], code: row['CustomerCode'] });
        }
        
        if (code && code !== '-' && code !== 'new') {
            if (!codeMap[code]) codeMap[code] = [];
            codeMap[code].push({ line: lineNum, id: id, name: row['Customer Name'], code: row['CustomerCode'] });
        }
    });

    let processedNameGroups = new Set();
    Object.values(nameMap).forEach(group => {
        if (group.length > 1) {
            let lines = group.map(g => g.line).join(' and ');
            duplicateErrors.push(`<div><b>Duplicate Customer Name:</b><br>Line: ${lines}<br>Customer Name: ${group[0].name}</div>`);
            group.forEach(g => errorRowIds.add(g.id));
            processedNameGroups.add(group[0].name.toLowerCase());
        }
    });

    Object.values(codeMap).forEach(group => {
        if (group.length > 1) {
            let lines = group.map(g => g.line).join(' and ');
            duplicateErrors.push(`<div><b>Duplicate Code:</b><br>Line: ${lines}<br>Code: ${group[0].code}<br>Customer Name: ${group[0].name}</div>`);
            group.forEach(g => errorRowIds.add(g.id));
        }
    });

    if (errorRowIds.size > 0) {
        let errorHtml = '';
        
        if (freqErrors.length > 0) {
            errorHtml += `<div class="text-red-700"><b class="text-red-800">Frequency Exceeded (Max 4):</b><br><ul class="list-disc pl-5 mt-1 text-xs">`;
            freqErrors.forEach(err => errorHtml += `<li>${err}</li>`);
            errorHtml += `</ul></div>`;
        }
        
        if (duplicateErrors.length > 0) {
            if (freqErrors.length > 0) errorHtml += `<hr class="my-2 border-red-200">`; 
            errorHtml += `<div class="text-red-700 flex flex-col gap-2 text-xs">`;
            duplicateErrors.forEach(err => errorHtml += err);
            errorHtml += `</div>`;
        }

        document.getElementById('preSaveErrorContent').innerHTML = errorHtml;
        document.getElementById('preSaveErrorModal').classList.remove('hidden');
        renderMasterlist(); 
        return; 
    }

    btnSaveCloud.innerHTML = `<span class="loader"></span> Saving...`;
    btnSaveCloud.disabled = true;
    cloudIndicator.innerHTML = '🔄 Syncing...';
    cloudIndicator.classList.replace('text-green-600', 'text-yellow-600');

    let promises = [];
    
    modifiedRows.forEach(id => {
        if(deletedRows.has(id)) return; 

        const row = supabaseData.find(r => String(r['Primary Key'] || r.CustomerCode) === String(id));
        if(row) {
            let payload = { Frequency: row.Frequency };
            activeDays.forEach(d => payload[d] = row[d]);
            
            const queryParam = encodeURIComponent('"Primary Key"') + '=eq.' + encodeURIComponent(id);

            promises.push(
                fetch(`${supabaseUrl}?${queryParam}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(payload)
                })
            );
        }
    });

    deletedRows.forEach(id => {
        const queryParam = encodeURIComponent('"Primary Key"') + '=eq.' + encodeURIComponent(id);
        promises.push(
            fetch(`${supabaseUrl}?${queryParam}`, {
                method: 'DELETE',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            })
        );
    });

    try {
        await Promise.all(promises);
        modifiedRows.clear();
        deletedRows.clear();
        btnSaveCloud.innerHTML = `☁️ Save to Cloud`;
        btnSaveCloud.classList.add('hidden');
        btnSaveCloud.disabled = false;
        cloudIndicator.innerHTML = '🟢 Connected';
        cloudIndicator.classList.replace('text-yellow-600', 'text-green-600');
        
        await fetchMasterlist(); 
        
        showSuccessModal("Changes successfully saved to the cloud database.");
    } catch(e) {
        alert("Error saving to cloud. Please try again.");
        btnSaveCloud.innerHTML = `☁️ Retry Save`;
        btnSaveCloud.disabled = false;
    }
};

window.downloadMasterlistExcel = function() {
    if(supabaseData.length === 0) return alert('No data to download');
    
    const exportData = supabaseData.map(row => {
        let cleanRow = {
            "Customer Name": row['Customer Name'] || '-',
            "Account": row['Account'] || '-',
            "City": row['City'] || '-', 
            "Customer Code": row['CustomerCode'] || '-',
            "Position Code": row['PositionCode'] || '-',
            "Frequency": row.Frequency || 0
        };
        activeDays.forEach(d => { 
            cleanRow[d] = window.isValidStrNum(row[d]) ? row[d] : ''; 
        });
        return cleanRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "IC003CAB OCTOBER - FINAL");
    XLSX.writeFile(workbook, "UPDATED_ROUTE_MASTERLIST.xlsx");
};