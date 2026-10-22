// ==========================================
// app.js - CORE, EXCEL, LOOKUP, PIVOT, GRAPHS
// ==========================================

Chart.defaults.font.family = "'Inter', 'Segoe UI', 'Helvetica Neue', 'Arial', sans-serif";
Chart.defaults.color = '#6b7280';

// Global Data
window.globalExcelData = []; 
let myBarChart = null;
let myDoughnutChart = null;

window.allDays = [
    'Mon1', 'Tue1', 'Wed1', 'Thu1', 'Fri1', 'Sat1', 'Sun1',
    'Mon2', 'Tue2', 'Wed2', 'Thu2', 'Fri2', 'Sat2', 'Sun2',
    'Mon3', 'Tue3', 'Wed3', 'Thu3', 'Fri3', 'Sat3', 'Sun3',
    'Mon4', 'Tue4', 'Wed4', 'Thu4', 'Fri4', 'Sat4', 'Sun4'
];

window.dayNamesMap = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' };
window.chartColors = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4f46e5', '#0d9488', '#e11d48'];

// DOM Elements
const fileInput = document.getElementById('excelFile');
const uploadStatus = document.getElementById('uploadStatus');
const uploadFileName = document.getElementById('uploadFileName'); 
const daySelector = document.getElementById('daySelector');
const resultTableBody = document.getElementById('resultTableBody');
const totalCount = document.getElementById('totalCount');
const lookupContentWrapper = document.getElementById('lookupContentWrapper');

const tabLookup = document.getElementById('tab-lookup');
const tabPivot = document.getElementById('tab-pivot');
const tabGraphs = document.getElementById('tab-graphs');
const tabMasterlist = document.getElementById('tab-masterlist');

const secLookup = document.getElementById('section-lookup');
const secPivot = document.getElementById('section-pivot');
const secGraphs = document.getElementById('section-graphs');
const secMasterlist = document.getElementById('section-masterlist');

const graphWeekSelector = document.getElementById('graphWeekSelector');
const graphCategorySelector = document.getElementById('graphCategorySelector');
const barChartAnalysis = document.getElementById('barChartAnalysis');
const doughnutChartAnalysis = document.getElementById('doughnutChartAnalysis');

const customerModal = document.getElementById('customerModal');
const modalContent = document.getElementById('modalContent');
const closeModalBtn = document.getElementById('closeModalBtn');
const closeModalBtnBottom = document.getElementById('closeModalBtnBottom');

const weeklyModal = document.getElementById('weeklyModal');
const weeklyModalHeader = document.getElementById('weeklyModalHeader');
const weeklyModalTitle = document.getElementById('weeklyModalTitle');
const weeklyModalContent = document.getElementById('weeklyModalContent');
const closeWeeklyModalBtn = document.getElementById('closeWeeklyModalBtn');
const closeWeeklyModalBtnBottom = document.getElementById('closeWeeklyModalBtnBottom');

const graphModal = document.getElementById('graphModal');
const graphModalTitle = document.getElementById('graphModalTitle');
const graphModalContent = document.getElementById('graphModalContent');
const closeGraphModalBtn = document.getElementById('closeGraphModalBtn');
const closeGraphModalBtnBottom = document.getElementById('closeGraphModalBtnBottom');

// Global Helpers
window.isValidCell = (val) => { return val !== null && val !== undefined && String(val).trim() !== '' && !isNaN(parseFloat(val)); };
window.isValidStrNum = window.isValidCell;

// MAS STRIKTONG MOBILE LOGO (max-height: 12px) PARA HINDI MAG-STRETCH ANG ROW
window.getAccountLogo = (accountName) => {
    if (!accountName || accountName === '-') return '-';
    const acc = accountName.toString().toUpperCase();
    
    let imgSrc = '';
    if (acc.includes('7-ELEVEN') || acc.includes('7/11')) imgSrc = 'seven-eleven.png';
    else if (acc.includes('ALFAMART')) imgSrc = 'alfamart.png';
    else if (acc.includes('SHELL')) imgSrc = 'shell.png';
    else if (acc === 'RS' || acc.includes('ROBINSONS')) imgSrc = 'robinsons.png';

    if (imgSrc) {
        return `
            <div class="sm:hidden flex items-center justify-center w-full" style="height: 12px; max-height: 12px; overflow: hidden;">
                <img src="${imgSrc}" alt="${accountName}" style="height: 12px; max-height: 12px; width: auto; max-width: 35px; object-fit: contain; display: block; margin: 0 auto;" loading="lazy">
            </div>
            <span class="font-medium hidden sm:inline-block text-[9px] sm:text-[11px]">${accountName}</span>
        `;
    }

    return `<span class="font-medium text-[9px] sm:text-[11px] whitespace-nowrap">${accountName}</span>`;
};

window.disableScroll = () => { document.body.classList.add('overflow-hidden'); document.documentElement.classList.add('overflow-hidden'); };
window.enableScroll = () => { document.body.classList.remove('overflow-hidden'); document.documentElement.classList.remove('overflow-hidden'); };
window.checkBodyScroll = () => { if (customerModal.classList.contains('hidden') && weeklyModal.classList.contains('hidden') && graphModal.classList.contains('hidden')) { window.enableScroll(); } };

// ================= TAB NAVIGATION =================
// Inayos para mag-render nang maayos ang charts at tables sa mobile browsers kapag nag-switch tab
function switchTab(activeTabStr) {
    const activeTabClasses = ['border-blue-700', 'text-blue-700', 'bg-blue-50', 'font-bold', 'rounded-t-md'];
    const inactiveTabClasses = ['text-gray-500', 'border-transparent', 'font-semibold', 'hover:text-blue-600'];
    const activeGreenClasses = ['border-green-600', 'text-green-700', 'bg-green-50', 'font-bold', 'rounded-t-md'];
    const inactiveGreenClasses = ['text-green-600', 'border-transparent', 'font-bold', 'hover:text-green-700'];

    [tabLookup, tabPivot, tabGraphs].forEach(t => { t.classList.remove(...activeTabClasses); t.classList.add(...inactiveTabClasses); });
    tabMasterlist.classList.remove(...activeGreenClasses); tabMasterlist.classList.add(...inactiveGreenClasses);
    [secLookup, secPivot, secGraphs, secMasterlist].forEach(s => s.classList.add('hidden'));

    if (activeTabStr === 'lookup') {
        tabLookup.classList.remove(...inactiveTabClasses); tabLookup.classList.add(...activeTabClasses); secLookup.classList.remove('hidden');
    } else if (activeTabStr === 'pivot') {
        tabPivot.classList.remove(...inactiveTabClasses); tabPivot.classList.add(...activeTabClasses); secPivot.classList.remove('hidden');
        if(window.globalExcelData.length > 0) {
            setTimeout(() => generateDynamicPivot(window.globalExcelData), 50); // Timeout para maka-render muna sa mobile bago ipasok ang table
        }
    } else if (activeTabStr === 'graphs') {
        tabGraphs.classList.remove(...inactiveTabClasses); tabGraphs.classList.add(...activeTabClasses); secGraphs.classList.remove('hidden');
        if(window.globalExcelData.length > 0) {
            setTimeout(() => renderGraphs(), 50); // Timeout para hindi mag-collapse sa 0 height ang canvas sa mobile
        }
    } else if (activeTabStr === 'masterlist') {
        tabMasterlist.classList.remove(...inactiveGreenClasses); tabMasterlist.classList.add(...activeGreenClasses); secMasterlist.classList.remove('hidden');
    }
}

tabLookup.addEventListener('click', () => switchTab('lookup'));
tabPivot.addEventListener('click', () => switchTab('pivot'));
tabGraphs.addEventListener('click', () => switchTab('graphs'));
tabMasterlist.addEventListener('click', () => switchTab('masterlist'));

// ================= EXCEL UPLOAD =================
fileInput.addEventListener('click', function(e) {
    e.target.value = null; 
});

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (uploadFileName) {
        uploadFileName.textContent = "Selected: " + file.name;
        uploadFileName.classList.remove('hidden');
    }

    uploadStatus.innerHTML = `Reading file, please wait...`;
    uploadStatus.className = "mt-1 sm:mt-2 text-blue-600 font-semibold text-[9px] sm:text-sm";

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // STRICT TAB NAME REQUIREMENT
            const sheetName = 'IC003CAB OCTOBER - FINAL';
            
            if(!workbook.SheetNames.includes(sheetName)) {
                uploadStatus.innerHTML = `Error: Sheet not found. <br><span class="text-red-700">Make sure the exact tab name is <b>"IC003CAB OCTOBER - FINAL"</b>.</span>`;
                uploadStatus.className = "mt-1 sm:mt-2 text-red-600 font-bold text-[9px] sm:text-sm";
                return;
            }
            
            let rawParsedData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            
            // NORMALIZER
            let parsedData = rawParsedData.map(row => {
                let normalizedRow = {};
                for (let key in row) {
                    let compressedKey = String(key).trim().toUpperCase().replace(/\s/g, '');
                    
                    if (compressedKey === 'CITY') {
                        normalizedRow['CITY'] = row[key]; 
                    } else if (compressedKey === 'CUSTOMERNAME') {
                        normalizedRow['Customer Name'] = row[key];
                    } else if (compressedKey === 'ACCOUNT') {
                        normalizedRow['Account'] = row[key];
                    } else if (compressedKey === 'CUSTOMERCODE') {
                        normalizedRow['CustomerCode'] = String(row[key]);
                    } else if (compressedKey === 'POSITIONCODE') {
                        normalizedRow['PositionCode'] = row[key];
                    } else {
                        normalizedRow[key] = row[key];
                    }
                }
                return normalizedRow;
            });

            let hasValidRow = parsedData.some(row => row['Customer Name'] || row['Account'] || row['CustomerCode']);
            if (!hasValidRow) {
                uploadStatus.innerHTML = `Error: Invalid data format. <br><span class="text-red-700">Missing <b>Customer Name</b> or <b>Account</b> columns.</span>`;
                uploadStatus.className = "mt-1 sm:mt-2 text-red-600 font-bold text-[9px] sm:text-sm";
                window.globalExcelData = [];
                return;
            }

            window.globalExcelData = parsedData;
            uploadStatus.innerHTML = `Success! File data loaded. Analytics and Lookup are now unlocked.`;
            uploadStatus.className = "mt-1 sm:mt-2 text-green-600 font-semibold text-[9px] sm:text-sm";

            daySelector.innerHTML = '<option value="">-- Select --</option>';
            window.allDays.forEach(day => {
                const hasData = window.globalExcelData.some(row => window.isValidCell(row[day]));
                if(hasData) {
                    let dayPrefix = day.substring(0, 3);
                    let weekNum = day.substring(3);
                    let fullDayName = (window.dayNamesMap[dayPrefix] || dayPrefix) + ' ' + weekNum + ' (' + day + ')';
                    daySelector.innerHTML += `<option value="${day}">${fullDayName}</option>`;
                }
            });

            daySelector.disabled = false; graphWeekSelector.disabled = false; graphCategorySelector.disabled = false;
            
            [tabPivot, tabGraphs].forEach(btn => {
                btn.classList.remove('hidden');
                btn.classList.add('fade-in-tab');
            });

            lookupContentWrapper.classList.remove('hidden');
            lookupContentWrapper.classList.add('fade-in-tab');

            if(!daySelector.value) {
                resultTableBody.innerHTML = `<tr><td colspan="5" class="py-4 sm:py-6 text-center text-gray-500 font-medium">Please select Day/Week.</td></tr>`;
            } else {
                performSearch();
            }

            if(!secPivot.classList.contains('hidden')) setTimeout(() => generateDynamicPivot(window.globalExcelData), 50);
            if(!secGraphs.classList.contains('hidden')) setTimeout(() => renderGraphs(), 50);
        } catch (error) {
            console.error(error);
            uploadStatus.innerHTML = `Error reading Excel file. <br><span class="text-red-700">Make sure it's a valid Excel (.xlsx) file.</span>`;
            uploadStatus.className = "mt-1 sm:mt-2 text-red-600 font-bold text-[9px] sm:text-sm";
        }
    };
    reader.readAsArrayBuffer(file);
});

// ================= LOOKUP ROUTE LOGIC =================
function performSearch() {
    const selectedDay = daySelector.value;
    const btnDownloadImage = document.getElementById('btnDownloadImage');

    if(!selectedDay) {
        totalCount.classList.add('hidden');
        if(btnDownloadImage) btnDownloadImage.classList.add('hidden');
        
        if(window.globalExcelData.length > 0) {
            resultTableBody.innerHTML = `<tr><td colspan="5" class="py-4 sm:py-6 text-center text-gray-500 font-medium">Please select Day/Week.</td></tr>`;
        } else {
            resultTableBody.innerHTML = `<tr><td colspan="5" class="py-4 sm:py-6 text-center text-gray-500 font-medium">Please upload a file and select a day.</td></tr>`;
        }
        return;
    }

    let filteredData = window.globalExcelData.filter(row => window.isValidCell(row[selectedDay]));
    filteredData.sort((a, b) => parseFloat(a[selectedDay]) - parseFloat(b[selectedDay]));

    let dayPrefix = selectedDay.substring(0, 3);
    let weekNum = selectedDay.substring(3);
    let fullDayName = window.dayNamesMap[dayPrefix] || dayPrefix;

    totalCount.innerHTML = `
        <div class="inline-flex items-center justify-center bg-white border border-gray-200 shadow-sm rounded-full px-3 py-1.5 text-[9px] sm:text-xs font-bold text-gray-700 w-auto">
            <span class="text-blue-600 uppercase tracking-wide">Week ${weekNum}</span>
            <span class="mx-3 text-gray-300">|</span>
            <span class="text-gray-800">${fullDayName}</span>
            <span class="mx-3 text-gray-300">|</span>
            <span class="bg-gray-100 px-3 py-0.5 rounded-full border border-gray-200 text-gray-700">${filteredData.length} Accounts</span>
        </div>
    `;
    totalCount.classList.remove('hidden');

    resultTableBody.innerHTML = '';
    
    if(filteredData.length === 0) {
        if(btnDownloadImage) btnDownloadImage.classList.add('hidden');
        resultTableBody.innerHTML = `<tr><td colspan="5" class="py-4 sm:py-6 text-center text-gray-500">No schedule found for this day.</td></tr>`; 
        return;
    }
    
    if(btnDownloadImage) btnDownloadImage.classList.remove('hidden');

    filteredData.forEach(row => {
        const accountDisplay = window.getAccountLogo(row['Account'] || '-');
        const customerCode = row['CustomerCode'] || '-';
        let codeHTML = customerCode;
        
        if(customerCode !== '-') {
            codeHTML = `<span class="cursor-pointer text-blue-600 hover:text-blue-800 hover:underline transition" onclick="openCustomerModal('${customerCode}')">${customerCode}</span>`;
        }

        resultTableBody.innerHTML += `
        <tr class="hover:bg-blue-50 transition border-b border-gray-100">
            <td class="font-semibold text-gray-800 text-center py-1.5 px-1 sm:px-2 text-[9px] sm:text-[11px] whitespace-nowrap">${row[selectedDay]}</td>
            <td class="font-mono font-bold text-center py-1.5 px-1 sm:px-2 text-[9px] sm:text-[11px] whitespace-nowrap">${codeHTML}</td>
            <td class="text-gray-700 font-bold leading-tight text-center sm:text-left py-1.5 px-1 sm:px-2 text-[9px] sm:text-[11px] min-w-[100px]">${row['Customer Name'] || '-'}</td>
            <td class="text-center py-1.5 px-1 sm:px-2 text-[9px] sm:text-[11px] whitespace-nowrap">${accountDisplay}</td>
            <td class="text-gray-500 font-semibold text-center py-1.5 px-1 sm:px-2 text-[9px] sm:text-[11px] whitespace-nowrap">${row['CITY'] || '-'}</td>
        </tr>`;
    });
}

daySelector.addEventListener('change', performSearch);

// ================= DOWNLOAD IMAGE LOGIC =================
window.downloadLookupImage = function() {
    const captureArea = document.getElementById('lookupCaptureArea');
    const btn = document.getElementById('btnDownloadImage');
    const daySelectEl = document.getElementById('daySelector');
    
    if (!captureArea || !btn) return;
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating...';
    btn.disabled = true;

    // Kunin ang filename + Date Today
    let selectedDayText = 'Schedule';
    if (daySelectEl && daySelectEl.selectedIndex > 0) {
        selectedDayText = daySelectEl.options[daySelectEl.selectedIndex].text.split(' (')[0];
    }
    
    const today = new Date();
    const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-${today.getFullYear()}`;
    const fileName = `${selectedDayText} - ${dateStr}.png`;

    // FIX PARA SA MOBILE VIEW: Force expansion ng elements
    const originalWidth = captureArea.style.width;
    const originalMaxWidth = captureArea.style.maxWidth;
    const originalOverflow = captureArea.style.overflow;

    // Para hindi ma-cut sa mobile, i-wewiden natin pansamantala
    captureArea.style.width = captureArea.scrollWidth + 'px';
    captureArea.style.maxWidth = 'none';
    captureArea.style.overflow = 'visible';
    
    const tableWrapper = captureArea.querySelector('.overflow-hidden');
    let tableWrapperOriginalOverflow = '';
    if (tableWrapper) {
        tableWrapperOriginalOverflow = tableWrapper.style.overflow;
        tableWrapper.style.overflow = 'visible';
    }

    setTimeout(() => {
        html2canvas(captureArea, { 
            scale: window.devicePixelRatio > 1 ? 2 : 1, // High res for mobile
            backgroundColor: '#ffffff', 
            logging: false,
            useCORS: true
        }).then(canvas => {
            // Restore styles
            captureArea.style.width = originalWidth;
            captureArea.style.maxWidth = originalMaxWidth;
            captureArea.style.overflow = originalOverflow;
            if (tableWrapper) tableWrapper.style.overflow = tableWrapperOriginalOverflow;
            
            const dataUrl = canvas.toDataURL('image/png');
            
            // MOBILE / IN-APP BROWSER FALLBACK
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            
            if (isMobile) {
                // Gumawa ng overlay modal kung saan ididisplay ang picture para ma-long press ng user
                const overlay = document.createElement('div');
                overlay.className = 'fixed inset-0 bg-gray-900 bg-opacity-95 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-sm transition-opacity';
                overlay.onclick = function(e) { if(e.target === overlay) document.body.removeChild(overlay); };
                
                const closeBtn = document.createElement('button');
                closeBtn.className = 'absolute top-4 right-4 text-white font-bold bg-gray-700 hover:bg-gray-600 rounded-full w-10 h-10 flex items-center justify-center text-lg shadow-lg';
                closeBtn.innerHTML = '✕';
                closeBtn.onclick = () => document.body.removeChild(overlay);

                const instructionContainer = document.createElement('div');
                instructionContainer.className = 'bg-blue-600 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-full mb-4 shadow-lg text-center';
                instructionContainer.innerText = '📸 Long press the image below and select "Save Image"';

                const imgContainer = document.createElement('div');
                imgContainer.className = 'overflow-auto max-h-[75vh] w-full flex justify-center bg-white rounded-lg shadow-2xl p-1';
                
                const img = document.createElement('img');
                img.src = dataUrl;
                img.className = 'max-w-full h-auto object-contain block';

                imgContainer.appendChild(img);
                overlay.appendChild(closeBtn);
                overlay.appendChild(instructionContainer);
                overlay.appendChild(imgContainer);
                document.body.appendChild(overlay);
            } else {
                // Regular download para sa Desktop
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
            }
            
            btn.innerHTML = originalText;
            btn.disabled = false;
        }).catch(err => {
            console.error("Error generating image:", err);
            captureArea.style.width = originalWidth;
            captureArea.style.maxWidth = originalMaxWidth;
            captureArea.style.overflow = originalOverflow;
            if (tableWrapper) tableWrapper.style.overflow = tableWrapperOriginalOverflow;
            
            alert("Failed to download image. Please try again.");
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
    }, 500); 
};

window.openCustomerModal = function(code) {
    const rowData = window.globalExcelData.find(r => String(r['CustomerCode']) === String(code));
    if(!rowData) return;

    let scheduleList = [];
    window.allDays.forEach(day => {
        if (window.isValidCell(rowData[day])) scheduleList.push(day.replace(/(\D+)(\d+)/, '$1 $2'));
    });

    let custName = rowData['Customer Name'] || '-';
    let accName = rowData['Account'] || '-';
    let custCode = rowData['CustomerCode'] || '-';
    let posCode = rowData['PositionCode'] || '-';

    modalContent.innerHTML = `
        <div class="flex flex-col space-y-2 text-left px-2 sm:px-4 border-b border-gray-100 pb-3">
            <div class="flex flex-col">
                <span class="text-gray-500 font-bold text-[9px] sm:text-xs uppercase tracking-wide">Customer Name</span>
                <span class="font-semibold text-gray-800 text-[10px] sm:text-sm break-words mt-0.5">${custName}</span>
            </div>
            <div class="flex flex-col">
                <span class="text-gray-500 font-bold text-[9px] sm:text-xs uppercase tracking-wide">Account</span>
                <span class="font-semibold text-gray-700 text-[10px] sm:text-sm mt-0.5">${accName}</span>
            </div>
            <div class="flex flex-col">
                <span class="text-gray-500 font-bold text-[9px] sm:text-xs uppercase tracking-wide">Code</span>
                <span class="font-mono font-bold text-blue-600 text-[10px] sm:text-sm mt-0.5">${custCode}</span>
            </div>
            <div class="flex flex-col">
                <span class="text-gray-500 font-bold text-[9px] sm:text-xs uppercase tracking-wide">Position Code</span>
                <span class="font-semibold text-gray-700 text-[10px] sm:text-sm mt-0.5">${posCode}</span>
            </div>
        </div>

        <div class="flex flex-col pt-3 text-center px-2 sm:px-4">
            <span class="text-gray-500 font-bold text-[9px] sm:text-xs mb-1.5">Schedule / Frequency:</span>
            <span class="bg-blue-50 text-blue-800 p-1.5 rounded-md font-bold text-[9px] sm:text-xs leading-relaxed border border-blue-100">${scheduleList.length > 0 ? scheduleList.join(', ') : 'None'}</span>
        </div>
    `;
    customerModal.classList.remove('hidden');
    window.disableScroll();
};

const hideModal = () => { customerModal.classList.add('hidden'); window.checkBodyScroll(); };
closeModalBtn.addEventListener('click', hideModal);
closeModalBtnBottom.addEventListener('click', hideModal);
customerModal.addEventListener('click', (e) => { if (e.target === customerModal) hideModal(); });

// ================= DYNAMIC PIVOT =================
window.openWeeklyModal = function(weekId) {
    const weeksConfig = {
        1: { titleBg: 'bg-emerald-500', headBg: 'bg-emerald-100', days: ['Mon1', 'Tue1', 'Wed1', 'Thu1', 'Fri1'] },
        2: { titleBg: 'bg-rose-500', headBg: 'bg-rose-100', days: ['Mon2', 'Tue2', 'Wed2', 'Thu2', 'Fri2'] },
        3: { titleBg: 'bg-amber-500', headBg: 'bg-amber-100', days: ['Mon3', 'Tue3', 'Wed3', 'Thu3', 'Fri3'] },
        4: { titleBg: 'bg-cyan-500', headBg: 'bg-cyan-100', days: ['Mon4', 'Tue4', 'Wed4', 'Thu4', 'Fri4'] }
    };
    const w = weeksConfig[weekId];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    weeklyModalHeader.className = `rounded-t-xl px-4 py-3 sm:px-5 sm:py-4 flex justify-between items-center transition-colors ${w.titleBg}`;
    weeklyModalTitle.textContent = `Week ${weekId} Details`;

    let contentHTML = '';

    w.days.forEach((dayCode, index) => {
        const dayData = window.globalExcelData.filter(row => window.isValidCell(row[dayCode])).sort((a,b) => parseFloat(a[dayCode]) - parseFloat(b[dayCode]));
        const count = dayData.length;

        let gridRows = '';
        if(count === 0) {
            gridRows = `<div class="col-span-2 text-center text-gray-500 py-3 italic text-xs sm:text-sm">No schedule available</div>`;
        } else {
            dayData.forEach(r => {
                let custName = r['Customer Name'] || '-';
                let accName = r['Account'] || '-';
                gridRows += `
                    <div class="py-2 border-b border-gray-100 text-gray-700 font-medium text-center break-words flex items-center justify-center">${custName}</div>
                    <div class="py-2 border-b border-gray-100 text-gray-600 text-center px-2 whitespace-nowrap flex items-center justify-center">${accName}</div>
                `;
            });
        }

        contentHTML += `
        <details class="bg-white border border-gray-200 rounded-lg shadow-sm group weekly-accordion">
            <summary class="${w.headBg} cursor-pointer px-4 py-3 font-semibold text-gray-800 rounded-lg group-open:rounded-b-none outline-none select-none flex justify-between items-center transition text-sm sm:text-base">
                <span class="flex items-center font-bold">
                    ${dayNames[index]} 
                    <span class="bg-white px-2 py-0.5 rounded-full text-xs ml-3 shadow-sm border border-gray-200 font-bold">${count} accounts</span>
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform transition-transform group-open:rotate-180 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
            </summary>
            <div class="p-3 sm:p-4 bg-white rounded-b-lg overflow-x-auto">
                <div class="grid grid-cols-[1fr_auto] gap-x-4 text-xs sm:text-sm min-w-full">
                    <div class="font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-1 uppercase tracking-wide text-[10px] sm:text-xs text-center flex items-center justify-center">Customer Name</div>
                    <div class="font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-1 uppercase tracking-wide text-[10px] sm:text-xs text-center flex items-center justify-center">Account</div>
                    ${gridRows}
                </div>
            </div>
        </details>
        `;
    });

    weeklyModalContent.innerHTML = contentHTML;
    weeklyModal.classList.remove('hidden');
    window.disableScroll();

    const accordions = weeklyModalContent.querySelectorAll('.weekly-accordion');
    accordions.forEach(acc => {
        acc.addEventListener('toggle', function() {
            if (this.open) {
                accordions.forEach(otherAcc => {
                    if (otherAcc !== this && otherAcc.open) otherAcc.open = false;
                });
            }
        });
    });
};

const hideWeeklyModal = () => { weeklyModal.classList.add('hidden'); window.checkBodyScroll(); };
closeWeeklyModalBtn.addEventListener('click', hideWeeklyModal);
closeWeeklyModalBtnBottom.addEventListener('click', hideWeeklyModal);
weeklyModal.addEventListener('click', (e) => { if (e.target === weeklyModal) hideWeeklyModal(); });

function generateDynamicPivot(rawData) {
    const data = rawData.filter(row => row['Customer Name'] || row['Account'] || row['CustomerCode']);
    document.getElementById('pivot-total-accounts').textContent = data.length;

    let positionCodes = [...new Set(data.map(r => r['PositionCode']).filter(Boolean))];
    if (positionCodes.length === 0) positionCodes = ['UNKNOWN'];

    const weeksData = [
        { id: 1, titleBg: 'bg-emerald-500', headBg: 'bg-emerald-100', textBtn: 'text-emerald-700', days: ['Mon1', 'Tue1', 'Wed1', 'Thu1', 'Fri1'] },
        { id: 2, titleBg: 'bg-rose-500', headBg: 'bg-rose-100', textBtn: 'text-rose-700', days: ['Mon2', 'Tue2', 'Wed2', 'Thu2', 'Fri2'] },
        { id: 3, titleBg: 'bg-amber-500', headBg: 'bg-amber-100', textBtn: 'text-amber-700', days: ['Mon3', 'Tue3', 'Wed3', 'Thu3', 'Fri3'] },
        { id: 4, titleBg: 'bg-cyan-500', headBg: 'bg-cyan-100', textBtn: 'text-cyan-700', days: ['Mon4', 'Tue4', 'Wed4', 'Thu4', 'Fri4'] }
    ];

    let weeklyHTML = '';
    weeksData.forEach(w => {
        weeklyHTML += `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden w-full">
            <table class="auto-table text-center w-full text-[8px] sm:text-xs">
                <thead>
                    <tr>
                        <th colspan="3" class="${w.titleBg} text-white font-bold py-1.5 sm:py-2 text-left pl-3 sm:pl-4">Week ${w.id}</th>
                        <th colspan="4" class="${w.titleBg} text-right pr-2 sm:pr-3">
                            <button onclick="openWeeklyModal(${w.id})" class="bg-white ${w.textBtn} px-2 py-1 text-[8px] sm:text-[10px] rounded shadow-sm hover:bg-gray-50 transition font-bold whitespace-nowrap">More Details</button>
                        </th>
                    </tr>
                    <tr class="${w.headBg} text-gray-700 border-b border-gray-300">
                        <th class="w-auto text-center font-bold px-1.5 py-0.5 sm:py-1">Position</th>
                        <th class="w-[12%] sm:w-[10%] text-center font-bold py-0.5 sm:py-1">Mon</th>
                        <th class="w-[12%] sm:w-[10%] text-center font-bold py-0.5 sm:py-1">Tue</th>
                        <th class="w-[12%] sm:w-[10%] text-center font-bold py-0.5 sm:py-1">Wed</th>
                        <th class="w-[12%] sm:w-[10%] text-center font-bold py-0.5 sm:py-1">Thu</th>
                        <th class="w-[12%] sm:w-[10%] text-center font-bold py-0.5 sm:py-1">Fri</th>
                        <th class="w-[15%] sm:w-[12%] text-center font-bold px-1 py-0.5 sm:py-1">Avg</th>
                    </tr>
                </thead>
                <tbody class="bg-white">`;

        positionCodes.forEach(pc => {
            const pcData = data.filter(r => (r['PositionCode'] || 'UNKNOWN') === pc);
            const counts = w.days.map(d => pcData.filter(r => window.isValidCell(r[d])).length);
            const total = counts.reduce((a, b) => a + b, 0);
            const avg = (total / 5).toFixed(1);

            weeklyHTML += `
                <tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td class="font-bold text-gray-700 text-left px-2 py-0.5 sm:py-1">${pc}</td>
                    ${counts.map((c) => `<td class="text-gray-600 font-semibold text-center py-0.5 sm:py-1">${c > 0 ? c : '-'}</td>`).join('')}
                    <td class="font-bold text-gray-800 bg-gray-50 text-center py-0.5 sm:py-1">${avg}</td>
                </tr>`;
        });
        weeklyHTML += `</tbody></table></div>`;
    });
    document.getElementById('pivot-weekly-tables').innerHTML = weeklyHTML;

    let freqData = {};
    let visitData = {};

    data.forEach(row => {
        let acc = row['Account'] || 'UNKNOWN';
        let freq = row['Frequency'];

        if(!freqData[acc]) freqData[acc] = {1:0, 2:0, 3:0, 4:0, total:0};
        if(!visitData[acc]) visitData[acc] = {1:0, 2:0, 3:0, 4:0, total:0};
        if([1,2,3,4].includes(freq)) { freqData[acc][freq]++; freqData[acc].total++; }

        let w1Visits = ['Mon1','Tue1','Wed1','Thu1','Fri1','Sat1','Sun1'].filter(d => window.isValidCell(row[d])).length;
        let w2Visits = ['Mon2','Tue2','Wed2','Thu2','Fri2','Sat2','Sun2'].filter(d => window.isValidCell(row[d])).length;
        let w3Visits = ['Mon3','Tue3','Wed3','Thu3','Fri3','Sat3','Sun3'].filter(d => window.isValidCell(row[d])).length;
        let w4Visits = ['Mon4','Tue4','Wed4','Thu4','Fri4','Sat4','Sun4'].filter(d => window.isValidCell(row[d])).length;

        visitData[acc][1] += w1Visits; visitData[acc][2] += w2Visits; visitData[acc][3] += w3Visits; visitData[acc][4] += w4Visits;
        visitData[acc].total += (w1Visits + w2Visits + w3Visits + w4Visits);
    });

    let freqHTML = ''; let freqGrandTotal = {1:0, 2:0, 3:0, 4:0, total:0};
    Object.keys(freqData).forEach(acc => {
        let d = freqData[acc];
        freqGrandTotal[1] += d[1]; freqGrandTotal[2] += d[2]; freqGrandTotal[3] += d[3]; freqGrandTotal[4] += d[4]; freqGrandTotal.total += d.total;
        freqHTML += `<tr class="border-b border-gray-100 hover:bg-gray-50">
                     <td class="text-left font-bold text-gray-700 px-2 py-0.5 sm:py-1 w-auto whitespace-nowrap">${acc}</td>
                     <td class="text-gray-600 font-semibold text-center py-0.5 sm:py-1">${d[1] || '-'}</td>
                     <td class="text-gray-600 font-semibold text-center py-0.5 sm:py-1">${d[2] || '-'}</td>
                     <td class="text-gray-600 font-semibold text-center py-0.5 sm:py-1">${d[3] || '-'}</td>
                     <td class="text-gray-600 font-semibold text-center py-0.5 sm:py-1">${d[4] || '-'}</td>
                     <td class="font-bold bg-blue-50 text-blue-800 text-center py-0.5 sm:py-1">${d.total || '0'}</td></tr>`;
    });
    freqHTML += `<tr class="bg-blue-100 font-bold">
                 <td class="text-left text-blue-900 px-2 py-1">Total</td>
                 <td class="text-center py-1">${freqGrandTotal[1]}</td>
                 <td class="text-center py-1">${freqGrandTotal[2]}</td>
                 <td class="text-center py-1">${freqGrandTotal[3]}</td>
                 <td class="text-center py-1">${freqGrandTotal[4]}</td>
                 <td class="text-center py-1">${freqGrandTotal.total}</td></tr>`;
    document.getElementById('pivot-freq-body').innerHTML = freqHTML;

    let visitHTML = ''; let visitGrandTotal = {1:0, 2:0, 3:0, 4:0, total:0};
    Object.keys(visitData).forEach(acc => {
        let d = visitData[acc];
        visitGrandTotal[1] += d[1]; visitGrandTotal[2] += d[2]; visitGrandTotal[3] += d[3]; visitGrandTotal[4] += d[4]; visitGrandTotal.total += d.total;
        visitHTML += `<tr class="border-b border-gray-100 hover:bg-gray-50">
                     <td class="text-left font-bold text-gray-700 px-2 py-0.5 sm:py-1 w-auto whitespace-nowrap">${acc}</td>
                     <td class="text-gray-600 font-semibold text-center py-0.5 sm:py-1">${d[1] || '-'}</td>
                     <td class="text-gray-600 font-semibold text-center py-0.5 sm:py-1">${d[2] || '-'}</td>
                     <td class="text-gray-600 font-semibold text-center py-0.5 sm:py-1">${d[3] || '-'}</td>
                     <td class="text-gray-600 font-semibold text-center py-0.5 sm:py-1">${d[4] || '-'}</td>
                     <td class="font-bold bg-gray-100 text-gray-800 text-center py-0.5 sm:py-1">${d.total || '0'}</td></tr>`;
    });
    visitHTML += `<tr class="bg-gray-200 font-bold">
                 <td class="text-left text-gray-900 px-2 py-1">Overall</td>
                 <td class="text-center py-1">${visitGrandTotal[1]}</td>
                 <td class="text-center py-1">${visitGrandTotal[2]}</td>
                 <td class="text-center py-1">${visitGrandTotal[3]}</td>
                 <td class="text-center py-1">${visitGrandTotal[4]}</td>
                 <td class="text-center py-1">${visitGrandTotal.total}</td></tr>`;
    document.getElementById('pivot-visit-body').innerHTML = visitHTML;
}

// ================= GRAPHS =================
window.openGraphModalList = function(categoryName) {
    const categoryCol = graphCategorySelector.value;
    const weekId = graphWeekSelector.value;
    let displayList = []; 

    const daysConfig = [
        { code: `Mon${weekId}`, name: 'Monday' },
        { code: `Tue${weekId}`, name: 'Tuesday' },
        { code: `Wed${weekId}`, name: 'Wednesday' },
        { code: `Thu${weekId}`, name: 'Thursday' },
        { code: `Fri${weekId}`, name: 'Friday' }
    ];
    
    window.globalExcelData.forEach(row => {
        if (String(row[categoryCol] || 'Unknown') === categoryName) {
            daysConfig.forEach(d => {
                if(window.isValidCell(row[d.code])) {
                    displayList.push({
                        code: row['CustomerCode'] || '-',
                        name: row['Customer Name'] || '-',
                        day: d.name
                    });
                }
            });
        }
    });
    
    graphModalTitle.innerHTML = `WEEK ${weekId} Total - <span class="text-blue-600">${categoryName}</span> - <span class="bg-gray-200 text-gray-800 px-2 py-0.5 rounded ml-1">${displayList.length}</span>`;

    let gridHtml = `
        <div class="font-bold text-gray-800 text-center border-b-2 border-gray-200 pb-2 mb-2 uppercase text-[10px] sm:text-xs">Code</div>
        <div class="font-bold text-gray-800 text-center border-b-2 border-gray-200 pb-2 mb-2 uppercase text-[10px] sm:text-xs">Customer Name</div>
    `;

    if(displayList.length === 0) {
        gridHtml += `<div class="col-span-2 text-center py-4 text-gray-500 italic">No records found.</div>`;
    } else {
        displayList.forEach(item => {
            let extraInfo = `<span class="text-[9px] sm:text-[10px] text-gray-400 ml-1 block sm:inline">(${item.day})</span>`;
            gridHtml += `
                <div class="py-2 border-b border-gray-100 text-center font-mono text-blue-600 font-bold flex items-center justify-center px-1 sm:px-2">${item.code}</div>
                <div class="py-2 border-b border-gray-100 text-right text-gray-700 font-bold">${item.name} ${extraInfo}</div>
            `;
        });
    }

    graphModalContent.innerHTML = gridHtml;
    graphModal.classList.remove('hidden');
    window.disableScroll();
}

const hideGraphModal = () => { graphModal.classList.add('hidden'); window.checkBodyScroll(); };
closeGraphModalBtn.addEventListener('click', hideGraphModal);
closeGraphModalBtnBottom.addEventListener('click', hideGraphModal);
graphModal.addEventListener('click', (e) => { if (e.target === graphModal) hideGraphModal(); });

function renderGraphs() {
    if (window.globalExcelData.length === 0) return;

    const weekId = graphWeekSelector.value;
    const category = graphCategorySelector.value;
    
    const dayCodes = [`Mon${weekId}`, `Tue${weekId}`, `Wed${weekId}`, `Thu${weekId}`, `Fri${weekId}`];
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    let catCountTotal = {}; 
    let catCountPerDay = {};

    window.globalExcelData.forEach(row => {
        let hasVisitThisWeek = false;
        dayCodes.forEach(d => { if(window.isValidCell(row[d])) hasVisitThisWeek = true; });
        
        if(hasVisitThisWeek) {
            let catName = String(row[category] || 'Unknown');
            if(!catCountTotal[catName]) catCountTotal[catName] = 0;
            if(!catCountPerDay[catName]) catCountPerDay[catName] = [0,0,0,0,0];

            dayCodes.forEach((d, i) => {
                if(window.isValidCell(row[d])) {
                    catCountTotal[catName]++;
                    catCountPerDay[catName][i]++;
                }
            });
        }
    });

    const categories = Object.keys(catCountTotal);
    
    let dailyTotals = [0, 0, 0, 0, 0];
    categories.forEach(cat => { catCountPerDay[cat].forEach((val, i) => { dailyTotals[i] += val; }); });
    
    let totalWeekVisits = dailyTotals.reduce((a, b) => a + b, 0);
    
    if (totalWeekVisits > 0) {
        let maxVal = Math.max(...dailyTotals);
        let minVal = Math.min(...dailyTotals);
        let maxDayNames = dailyTotals.map((val, idx) => val === maxVal ? dayLabels[idx] : null).filter(v => v !== null);
        let minDayNames = dailyTotals.map((val, idx) => val === minVal ? dayLabels[idx] : null).filter(v => v !== null);

        barChartAnalysis.innerHTML = `<b>💡 Insight:</b> The highest number of schedules for Week ${weekId} is on <b>${maxDayNames.join(' and ')}</b> with <b>${maxVal}</b> visits. The lowest is on <b>${minDayNames.join(' and ')}</b> with <b>${minVal}</b> visits.`;
        barChartAnalysis.classList.remove('hidden');
    } else {
        barChartAnalysis.innerHTML = `<b>💡 Insight:</b> No schedules found for this week.`;
        barChartAnalysis.classList.remove('hidden');
    }

    let sortedCategories = categories.map(c => ({ name: c, count: catCountTotal[c] })).sort((a, b) => b.count - a.count);
    if (sortedCategories.length > 0 && totalWeekVisits > 0) {
        let topCat = sortedCategories[0];
        let percent = ((topCat.count / totalWeekVisits) * 100).toFixed(1);
        doughnutChartAnalysis.innerHTML = `<b>💡 Insight:</b> This week, <b>${topCat.name}</b> has the highest number of scheduled visits, making up <b>${percent}%</b> (${topCat.count} visits) of your total route for Week ${weekId}.`;
        doughnutChartAnalysis.classList.remove('hidden');
    } else {
        doughnutChartAnalysis.innerHTML = `<b>💡 Insight:</b> No data available for this category.`;
        doughnutChartAnalysis.classList.remove('hidden');
    }

    const doughnutLabels = categories;
    const doughnutDataVals = categories.map(c => catCountTotal[c]);

    const barDatasets = categories.map((cat, i) => {
        return {
            label: cat,
            data: catCountPerDay[cat],
            backgroundColor: window.chartColors[i % window.chartColors.length], 
            borderRadius: 0, 
            borderWidth: 0 
        };
    });

    if (myBarChart) myBarChart.destroy();
    const ctxBar = document.getElementById('barChart').getContext('2d');
    myBarChart = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: dayLabels, datasets: barDatasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false }, 
            plugins: { 
                legend: { position: 'top', align: 'center', labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'rect', font: {weight: 'bold'} } },
                tooltip: { backgroundColor: '#1f2937', titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 }, padding: 12, cornerRadius: 4 }
            },
            scales: { 
                x: { stacked: true, grid: { display: false }, ticks: { font: { weight: 'bold' } } }, 
                y: { stacked: true, beginAtZero: true, ticks: { precision: 0, font: { weight: 'bold' } }, border: { display: false }, grid: { color: '#e5e7eb', drawTicks: false } } 
            }
        }
    });

    if (myDoughnutChart) myDoughnutChart.destroy();
    const ctxDoughnut = document.getElementById('doughnutChart').getContext('2d');
    myDoughnutChart = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: doughnutLabels,
            datasets: [{
                data: doughnutDataVals,
                backgroundColor: window.chartColors.slice(0, categories.length),
                borderWidth: 2, borderColor: '#ffffff',
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '60%',
            plugins: { 
                legend: { position: 'top', align: 'center', labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle', font: {weight: 'bold'} } },
                tooltip: { backgroundColor: '#1f2937', titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 }, padding: 12, cornerRadius: 4 }
            },
            onClick: (e, activeEls) => {
                const currentTime = new Date().getTime();
                let lastClickTime = window.lastClickTime || 0;
                if (currentTime - lastClickTime < 400 && activeEls.length > 0) {
                    const index = activeEls[0].index;
                    const catName = doughnutLabels[index];
                    window.openGraphModalList(catName); 
                }
                window.lastClickTime = currentTime;
            }
        }
    });
}

graphWeekSelector.addEventListener('change', renderGraphs);
graphCategorySelector.addEventListener('change', renderGraphs);