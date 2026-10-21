// ==========================================
// route_planner.js - SUPABASE & MASTERLIST
// ==========================================

let supabaseData = [];    
let editingRowId = null;  
let modifiedRows = new Set(); 

const supabaseUrl = 'https://zguemnrszulnzsneqzek.supabase.co/rest/v1/route_schedules';
const supabaseKey = 'sb_publishable_vIKFtbZYeTs9nZf-Oq-OtA_QzTzqLra';

const cloudIndicator = document.getElementById('cloudStatusIndicator');
const masterlistTableBody = document.getElementById('masterlistTableBody');
const btnSaveCloud = document.getElementById('btnSaveCloud');

document.addEventListener('DOMContentLoaded', () => {
    fetchMasterlist();
    populateClearColumnOptions();
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

    if(confirm(`Are you sure you want to clear all schedules for ${inputVal}?\n\nYou still need to click "Save to Cloud" after this.`)) {
        document.getElementById('clearColumnModal').classList.add('hidden');
        
        supabaseData.forEach(row => {
            if(row[targetKey] !== null && row[targetKey] !== '') {
                row[targetKey] = null; 
                
                let count = 0;
                window.allDays.forEach(d => {
                    if (window.isValidStrNum(row[d])) count++;
                });
                row.Frequency = count;
                
                modifiedRows.add(row.id || row.CustomerCode);
            }
        });
        
        btnSaveCloud.classList.remove('hidden');
        renderMasterlist();
    }
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
    if(supabaseData.length === 0) masterlistTableBody.innerHTML = `<tr><td colspan="34" class="py-8 text-center text-blue-600 font-bold"><span class="loader"></span> Fetching latest data from cloud...</td></tr>`;
    
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
        renderMasterlist();
    } catch (error) {
        masterlistTableBody.innerHTML = `<tr><td colspan="34" class="py-8 text-center text-red-500 font-bold">Error loading database: ${error.message}</td></tr>`;
        cloudIndicator.innerHTML = '🔴 Offline';
        cloudIndicator.classList.replace('text-gray-500', 'text-red-600');
    }
}

function renderMasterlist() {
    masterlistTableBody.innerHTML = '';
    if(supabaseData.length === 0) {
        masterlistTableBody.innerHTML = `<tr><td colspan="34" class="py-6 text-center text-gray-500 italic">No records found in database.</td></tr>`;
        return;
    }

    let rowIndex = 1;
    supabaseData.forEach(row => {
        const rowId = row.id || row.CustomerCode;
        const isEditing = String(editingRowId) === String(rowId);
        const isModifiedLocally = modifiedRows.has(rowId);
        
        let trClass = isEditing ? 'bg-blue-50 shadow-inner border-b border-blue-200' : 'border-b border-gray-100 hover:bg-gray-50 transition';
        if(isModifiedLocally && !isEditing) trClass += ' bg-yellow-50';

        let tr = `<tr id="editing_tr_${rowId}" data-id="${rowId}" class="${trClass}">`;
        
        if(isEditing) {
            tr += `<td class="p-0.5 sm:p-2 text-center sticky left-0 z-10 w-[60px] bg-blue-50 border-r border-blue-200 align-middle">
                <div class="w-full mx-auto text-center">
                    <span class="bg-blue-200 text-blue-800 font-bold text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-md animate-pulse whitespace-nowrap">Editing</span>
                </div>
            </td>`;
        } else {
            tr += `<td class="p-0.5 sm:p-2 text-center sticky left-0 z-10 w-[60px] ${isModifiedLocally ? 'bg-yellow-50' : 'bg-white'} border-r border-gray-100 align-middle">
                <div class="w-full mx-auto flex justify-center">
                    <button onclick="startInlineEdit('${rowId}')" class="text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded font-bold text-[8px] sm:text-[10px] transition shadow-sm w-full">✏️ Edit</button>
                </div>
            </td>`;
        }

        // FIX: Pinaliit ang font size at padding sa lahat
        tr += `<td class="p-0.5 sm:p-1 border-r border-gray-100 align-middle bg-transparent"><div class="w-[30px] mx-auto text-center text-gray-400 font-bold text-[8px] sm:text-[10px]">${rowIndex++}</div></td>`;
        tr += `<td class="p-0.5 sm:p-1 border-r border-gray-100 align-middle bg-transparent"><div class="w-full mx-auto text-center font-mono font-bold text-blue-600 text-[8px] sm:text-[10px] whitespace-nowrap">${row.CustomerCode || '-'}</div></td>`;

        tr += `
            <td class="p-0.5 sm:p-1 border-r border-gray-100 bg-transparent align-middle whitespace-nowrap">
                <div class="font-bold text-gray-800 text-[8px] sm:text-[10px] customer-name-col" title="${row['Customer Name'] || '-'}">${row['Customer Name'] || '-'}</div>
            </td>
        `;

        const accDisplay = window.getAccountLogo(row['Account']);
        tr += `<td class="p-0.5 sm:p-1 border-r border-gray-100 align-middle bg-transparent text-center">
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
            tr += `<td id="inline_freq_display_${rowId}" class="fixed-40 border-r border-gray-100 bg-blue-50 text-gray-400 align-middle" title="Auto computed based on schedules">
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
                    tr += `<td class="fixed-40 border-r border-gray-100 bg-blue-50 align-middle ${hideClass}" id="td_edit_${rowId}_${d}">
                            <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto flex justify-center items-center">
                                <input type="text" inputmode="numeric" size="2" maxlength="3" id="edit_${d}" value="${val}" oninput="this.value=this.value.replace(/[^0-9]/g, ''); updateInlineFrequency('${rowId}')" class="edit-input">
                            </div>
                           </td>`;
                } else {
                    tr += `<td class="fixed-40 border-r border-gray-100 bg-blue-50 align-middle ${hideClass}" id="td_edit_${rowId}_${d}">
                            <div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto flex justify-center items-center">
                                <button type="button" onclick="assignNextSequence('${rowId}', '${d}')" class="btn-add-seq" title="Add Next Sequence">+</button>
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
        const rowId = row.id || row.CustomerCode;
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
        if (!isNaN(val) && String(r.id || r.CustomerCode) !== String(rowId)) {
            if (val > max) max = val;
        }
    });
    let nextSeq = max + 1;
    
    const td = document.getElementById(`td_edit_${rowId}_${day}`);
    if(td) {
        td.innerHTML = `<div class="w-[40px] min-w-[40px] max-w-[40px] mx-auto flex justify-center items-center"><input type="text" inputmode="numeric" size="2" maxlength="3" id="edit_${day}" value="${nextSeq}" oninput="this.value=this.value.replace(/[^0-9]/g, ''); updateInlineFrequency('${rowId}')" class="edit-input animate-[fadeIn_0.3s_ease-in-out]"></div>`;
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
};

window.startInlineEdit = function(id) {
    editingRowId = id;
    document.getElementById('floatingEditBar').classList.remove('hidden');
    renderMasterlist();
}

window.cancelInlineEdit = function() {
    editingRowId = null;
    document.getElementById('floatingEditBar').classList.add('hidden');
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

    const index = supabaseData.findIndex(r => String(r.id || r.CustomerCode) === String(id));
    if(index !== -1) {
        supabaseData[index] = { ...supabaseData[index], ...updates };
        modifiedRows.add(id);
    }
    
    editingRowId = null;
    document.getElementById('floatingEditBar').classList.add('hidden');
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
        modifiedRows.add(row.id || row.CustomerCode);
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
        const row = supabaseData.find(r => String(r.id || r.CustomerCode) === String(id));
        if(row) {
            let payload = { Frequency: row.Frequency };
            window.allDays.forEach(d => payload[d] = row[d]);
            
            promises.push(
                fetch(`${supabaseUrl}?id=eq.${id}`, {
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
        alert("Successfully saved to cloud database!");
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
            "Primary Key": row.id || row.CustomerCode,
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