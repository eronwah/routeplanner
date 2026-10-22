// ==========================================
// route_planner.js - SUPABASE & MASTERLIST
// ==========================================

let supabaseData = [];    
let editingRowId = null;  
let modifiedRows = new Set(); 
let targetColumnToClear = null; 

const supabaseUrl = 'https://zguemnrszulnzsneqzek.supabase.co/rest/v1/route_schedules';
const supabaseKey = 'sb_publishable_vIKFtbZYeTs9nZf-Oq-OtA_QzTzqLra';

const cloudIndicator = document.getElementById('cloudStatusIndicator');
const masterlistTableBody = document.getElementById('masterlistTableBody');
const btnSaveCloud = document.getElementById('btnSaveCloud');

document.addEventListener('DOMContentLoaded', () => {
    fetchMasterlist();
    populateClearColumnOptions();
});

// ESCAPE KEY LOGIC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && editingRowId !== null) {
        window.cancelInlineEdit();
    }
});

function populateClearColumnOptions() {
    const datalist = document.getElementById('dayColumnOptions');
    if (!datalist) return;
    let optionsHTML = '';
    window.allDays.forEach(day => {
        if(!day.startsWith('Sat') && !day.startsWith('Sun')) {
            let prefix = day.substring(0, 3);
            let num = day.substring(3);
            let fullName = `${window.dayNamesMap[prefix]} ${num}`;
            optionsHTML += `<option value="${fullName}"></option>`;
        }
    });
    datalist.innerHTML = optionsHTML;
}

// BAGO: 6-Digits Alphanumeric ALL CAPS Primary Key Generator
window.generateUniqueId = function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// BAGO: Success Pop-up Modal Function
window.showSuccessModal = function(msg) {
    document.getElementById('successModalMessage').innerText = msg;
    document.getElementById('successModal').classList.remove('hidden');
};

window.closeSuccessModal = function() {
    document.getElementById('successModal').classList.add('hidden');
};

// BAGO: Resync Button Function
window.resyncData = function() {
    fetchMasterlist();
};

// ================= ADD ROUTE LOGIC =================
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

window.proceedToAddRouteConfirm = function() {
    const name = document.getElementById('newCustomerName').value.trim();
    const account = document.getElementById('newAccount').value.trim();
    const city = document.getElementById('newCity').value.trim();
    const code = document.getElementById('newCustomerCode').value.trim();

    if(!name || !account || !city || !code) {
        document.getElementById('validationErrorModal').classList.remove('hidden');
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

    window.allDays.forEach(d => {
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
        // Pinalitan ang alert() ng custom modal
        showSuccessModal("New route successfully added to the cloud database.");
    } catch(e) {
        alert("Error adding new route:\n\n" + e.message);
    } finally {
        btn.innerHTML = `Yes, Save`;
        btn.disabled = false;
    }
};
// =========================================================

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
    for (let d of window.allDays) {
        let prefix = d.substring(0, 3);
        let num = d.substring(3);
        let fullName = `${window.dayNamesMap[prefix]} ${num}`;
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
        if(row[targetColumnToClear] !== null && row[targetColumnToClear] !== '') {
            row[targetColumnToClear] = null; 
            
            let count = 0;
            window.allDays.forEach(d => {
                if (window.isValidStrNum(row[d])) count++;
            });
            row.Frequency = count;
            
            modifiedRows.add(row['Primary Key'] || row.CustomerCode);
        }
    });
    
    btnSaveCloud.classList.remove('hidden');
    renderMasterlist();
    targetColumnToClear = null; 
};

function getMasterScore(row) {
    const dayOrder = { 'Mon':0, 'Tue':1, 'Wed':2, 'Thu':3, 'Fri':4, 'Sat':5, 'Sun':6 };
    let minScore = 999999;
    for (let d of window.allDays) {
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
        masterlistTableBody.innerHTML = `<tr><td colspan="34" class="py-8 text-center text-blue-600 font-bold"><span class="loader"></span> Fetching latest data from cloud...</td></tr>`;
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
        btnSaveCloud.classList.add('hidden');
        
        cloudIndicator.innerHTML = '🟢 Connected';
        cloudIndicator.classList.replace('text-gray-500', 'text-green-600');
        
        // BAGO: Timestamp ng pagkuha ng most updated data
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

    if (!panel || !editingRowId || editingRowId !== rowId) return;

    const rowData = supabaseData.find(r => String(r['Primary Key'] || r.CustomerCode) === String(rowId));
    if (!rowData) return;

    if(codeEl) codeEl.textContent = rowData.CustomerCode || '-';
    if(custEl) custEl.textContent = rowData['Customer Name'] || '-';
    if(accEl) accEl.textContent = rowData['Account'] || '-'; 
    if(titleEl) titleEl.textContent = 'Insights table for - ' + (rowData['Customer Name'] || '-');

    let count = 0;
    let miniTableHTML = '';
    
    window.allDays.forEach(d => {
        let inputEl = document.getElementById('edit_' + d);
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
            let fullName = `${window.dayNamesMap[prefix]} ${num}`;
            
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
        const isEditing = String(editingRowId) === String(rowId);
        const isModifiedLocally = modifiedRows.has(rowId);
        
        let trClass = isEditing ? 'bg-yellow-100 shadow-inner border-b border-yellow-300' : 'border-b border-gray-100 hover:bg-gray-50 transition';
        if(isModifiedLocally && !isEditing) trClass += ' bg-amber-50'; 

        let tr = `<tr id="editing_tr_${rowId}" data-id="${rowId}" class="${trClass}">`;
        
        if(isEditing) {
            tr += `<td class="p-0.5 sm:p-2 text-center sticky left-0 z-10 w-[60px] bg-yellow-100 border-r border-yellow-300 align-middle">
                <div class="w-full mx-auto text-center">
                    <span class="bg-yellow-300 text-yellow-900 font-bold text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-md animate-pulse whitespace-nowrap">Editing</span>
                </div>
            </td>`;
        } else {
            tr += `<td class="p-0.5 sm:p-2 text-center sticky left-0 z-10 w-[60px] ${isModifiedLocally ? 'bg-amber-50' : 'bg-white'} border-r border-gray-100 align-middle">
                <div class="w-full mx-auto flex justify-center">
                    <button onclick="startInlineEdit('${rowId}')" class="text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded font-bold text-[8px] sm:text-[10px] transition shadow-sm w-full">✏️ Edit</button>
                </div>
            </td>`;
        }

        tr += `<td class="p-0.5 sm:p-1 border-r ${isEditing ? 'border-yellow-300' : 'border-gray-100'} align-middle bg-transparent"><div class="w-[30px] mx-auto text-center ${isEditing ? 'text-yellow-700' : 'text-gray-400'} font-bold text-[8px] sm:text-[10px]">${rowIndex++}</div></td>`;
        tr += `<td class="p-0.5 sm:p-1 border-r ${isEditing ? 'border-yellow-300' : 'border-gray-100'} align-middle bg-transparent"><div class="w-full mx-auto text-center font-mono font-bold text-blue-600 text-[8px] sm:text-[10px] whitespace-nowrap">${row.CustomerCode || '-'}</div></td>`;

        tr += `
            <td class="p-0.5 sm:p-1 border-r ${isEditing ? 'border-yellow-300' : 'border-gray-100'} bg-transparent align-middle whitespace-nowrap">
                <div class="font-bold text-gray-800 text-[8px] sm:text-[10px] customer-name-col" title="${row['Customer Name'] || '-'}">${row['Customer Name'] || '-'}</div>
            </td>
        `;

        const accDisplay = window.getAccountLogo(row['Account']);
        tr += `<td class="p-0.5 sm:p-1 border-r ${isEditing ? 'border-yellow-300' : 'border-gray-100'} align-middle bg-transparent text-center">
                <div class="font-semibold text-[8px] sm:text-[10px] whitespace-nowrap">${accDisplay}</div>
               </td>`;

        let autoFreq = window.allDays.filter(d => window.isValidStrNum(row[d])).length;
        let freqDisplay = autoFreq > 0 ? autoFreq : '-';
        let freqStyle = 'bg-gray-50 text-gray-700 text-center';

        if (autoFreq >= 5) {
            freqDisplay = `⚠️ ${autoFreq}`;
            freqStyle = 'text-red-700 font-bold text-center';
            if(!isEditing) tr += `<script>document.getElementById('editing_tr_${rowId}').classList.add('blink-bg');<\/script>`;
        }

        if(isEditing) {
            tr += `<td id="inline_freq_display_${rowId}" class="fixed-40 border-r border-yellow-300 bg-yellow-100 text-gray-800 align-middle" title="Auto computed based on schedules">
                    <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto text-center font-bold text-[9px] sm:text-[10px]">${autoFreq > 0 ? autoFreq : '-'}</div>
                   </td>`;
        } else {
            tr += `<td class="fixed-40 border-r border-gray-100 align-middle">
                    <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto text-center font-bold text-[9px] sm:text-[10px] ${freqStyle}">${freqDisplay}</div>
                   </td>`;
        }

        window.allDays.forEach(d => {
            const isWeekend = d.startsWith('Sat') || d.startsWith('Sun');
            const hideClass = isWeekend ? 'hidden' : '';

            if(isEditing) {
                const val = row[d];
                if (window.isValidStrNum(val)) {
                    tr += `<td class="fixed-40 border-r border-yellow-300 bg-yellow-100 align-middle ${hideClass}" id="td_edit_${rowId}_${d}">
                            <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto flex justify-center items-center">
                                <input type="text" inputmode="numeric" size="2" maxlength="3" id="edit_${d}" value="${val}" oninput="this.value=this.value.replace(/[^0-9]/g, ''); updateInlineFrequency('${rowId}')" class="edit-input" style="text-align: center !important; margin: 0 auto !important;">
                            </div>
                           </td>`;
                } else {
                    tr += `<td class="fixed-40 border-r border-yellow-300 bg-yellow-100 align-middle ${hideClass}" id="td_edit_${rowId}_${d}">
                            <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto flex justify-center items-center">
                                <button type="button" onclick="assignNextSequence('${rowId}', '${d}')" class="btn-add-seq" title="Add Next Sequence" style="text-align: center !important; margin: 0 auto !important;">+</button>
                                <input type="hidden" id="edit_${d}" value="">
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
    
    supabaseData.forEach(row => {
        const rowId = row['Primary Key'] || row.CustomerCode;
        let autoFreq = window.allDays.filter(d => window.isValidStrNum(row[d])).length;
        if(autoFreq >= 5) {
            let trElem = document.getElementById('editing_tr_' + rowId);
            if(trElem) trElem.classList.add('blink-bg');
        }
    });
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
        td.innerHTML = `<div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto flex justify-center items-center"><input type="text" inputmode="numeric" size="2" maxlength="3" id="edit_${day}" value="${nextSeq}" oninput="this.value=this.value.replace(/[^0-9]/g, ''); updateInlineFrequency('${rowId}')" class="edit-input text-center animate-[fadeIn_0.3s_ease-in-out]" style="text-align: center !important; margin: 0 auto !important;"></div>`;
    }
    
    window.updateInlineFrequency(rowId);
};

window.updateInlineFrequency = function(rowId) {
    let count = 0;
    window.allDays.forEach(d => {
        let inputEl = document.getElementById('edit_' + d);
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

window.startInlineEdit = function(id) {
    editingRowId = id;
    document.getElementById('floatingEditBar').classList.remove('hidden');
    renderMasterlist();
    if(window.updateEditingInsights) window.updateEditingInsights(id);
}

window.cancelInlineEdit = function() {
    editingRowId = null;
    document.getElementById('floatingEditBar').classList.add('hidden');
    clearInsightsPanel();
    renderMasterlist();
}

window.saveCurrentEdit = function() {
    if(!editingRowId) return;
    const id = editingRowId;
    let count = 0;
    let updates = {};
    
    window.allDays.forEach(d => {
        let inputEl = document.getElementById('edit_' + d);
        if(inputEl) {
            const val = inputEl.value;
            if (val !== '' && !isNaN(parseFloat(val))) count++;
            updates[d] = val !== '' ? parseFloat(val) : null;
        }
    });

    if (count >= 5) {
        document.getElementById('freqWarningModal').classList.remove('hidden');
        return;
    }

    updates['Frequency'] = count;

    const index = supabaseData.findIndex(r => String(r['Primary Key'] || r.CustomerCode) === String(id));
    if(index !== -1) {
        supabaseData[index] = { ...supabaseData[index], ...updates };
        modifiedRows.add(id);
    }
    
    editingRowId = null;
    document.getElementById('floatingEditBar').classList.add('hidden');
    clearInsightsPanel(); 
    
    supabaseData = getOrderedSupabaseData(); 
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
        window.allDays.forEach(d => row[d] = null);
        row.Frequency = 0;
        modifiedRows.add(row['Primary Key'] || row.CustomerCode);
    });
    btnSaveCloud.classList.remove('hidden');
    renderMasterlist();
};

window.saveToCloud = async function() {
    if (modifiedRows.size === 0) return;
    
    btnSaveCloud.innerHTML = `<span class="loader"></span> Saving...`;
    btnSaveCloud.disabled = true;
    cloudIndicator.innerHTML = '🔄 Syncing...';
    cloudIndicator.classList.replace('text-green-600', 'text-yellow-600');

    let promises = [];
    modifiedRows.forEach(id => {
        const row = supabaseData.find(r => String(r['Primary Key'] || r.CustomerCode) === String(id));
        if(row) {
            let payload = { Frequency: row.Frequency };
            window.allDays.forEach(d => payload[d] = row[d]);
            
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

    try {
        await Promise.all(promises);
        modifiedRows.clear();
        btnSaveCloud.innerHTML = `☁️ Save to Cloud`;
        btnSaveCloud.classList.add('hidden');
        btnSaveCloud.disabled = false;
        cloudIndicator.innerHTML = '🟢 Connected';
        cloudIndicator.classList.replace('text-yellow-600', 'text-green-600');
        renderMasterlist(); 
        
        // Pinalitan din ang alert() ng custom modal para sa general save edits
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
            "Primary Key": row['Primary Key'] || row.CustomerCode,
            "Customer Name": row['Customer Name'],
            "Frequency": row.Frequency
        };
        window.allDays.forEach(d => { cleanRow[d] = row[d] });
        return cleanRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "IC003CAB OCTOBER - FINAL");
    XLSX.writeFile(workbook, "UPDATED_ROUTE_MASTERLIST.xlsx");
};