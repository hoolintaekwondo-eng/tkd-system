const SUPABASE_URL = 'https://ddgiebiqfdimllxypgqo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2McIHvaAnOMZLtpFxDuKxg_qGbFlFWY';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
/**
 * MODEL: Logic_Layer
 * VERSION: V.4.11.0
 * DESCRIPTION: SaaS Dynamic Settings Engine, Hitbox Fix, DB Sweeper (Empty Shell Destroy)
 */

const app = {
    state: {
        currentDate: new Date(),
        students: [],
        attendance: {},
        selectedStudentIds: new Set(),
        pendingDates: {}, 
        pendingLeaves: {},
        editingNoteStuId: null,
        tempSelectingDate: null,
        isCalendarCollapsed: false,
        settingsOpen: false,
        sortCol: null,
        sortAsc: true,
        filterGroups: new Set(),
        settingsDay: 1, // V4.11 新增：後台課表管理的當前選取星期 (預設週一)
    },

    ui: {
        alert: function(msg, type='info', title='系統提示') { return new Promise(resolve => this.showDialog(msg, type, title, false, resolve)); },
        confirm: function(msg, type='warning', title='請確認') { return new Promise(resolve => this.showDialog(msg, type, title, true, resolve)); },
        showDialog: function(msg, type, title, showCancel, resolve) {
            const overlay = document.getElementById('sysDialog'); const icon = document.getElementById('sysDialogIcon');
            document.getElementById('sysDialogTitle').innerText = title; document.getElementById('sysDialogMsg').innerText = msg;
            const btnConfirm = document.getElementById('sysDialogConfirm'); const btnCancel = document.getElementById('sysDialogCancel');
            
            if(type === 'warning') { icon.innerHTML = '<i class="ph-fill ph-warning"></i>'; icon.className = 'sys-dialog-icon warning'; btnConfirm.className = 'btn-dialog-primary'; btnConfirm.style.background = 'var(--warning)'; } 
            else if(type === 'danger') { icon.innerHTML = '<i class="ph-fill ph-warning-circle"></i>'; icon.className = 'sys-dialog-icon danger'; btnConfirm.className = 'btn-dialog-danger'; btnConfirm.style.background = 'var(--danger)'; } 
            else if(type === 'success') { icon.innerHTML = '<i class="ph-fill ph-check-circle"></i>'; icon.className = 'sys-dialog-icon'; icon.style.color = 'var(--success)'; btnConfirm.className = 'btn-dialog-primary'; btnConfirm.style.background = 'var(--success)'; } 
            else { icon.innerHTML = '<i class="ph-fill ph-info"></i>'; icon.className = 'sys-dialog-icon'; icon.style.color = 'var(--primary)'; btnConfirm.className = 'btn-dialog-primary'; btnConfirm.style.background = 'var(--primary)'; }

            btnCancel.style.display = showCancel ? 'block' : 'none';
            btnConfirm.onclick = () => { overlay.classList.remove('open'); resolve(true); };
            btnCancel.onclick = () => { overlay.classList.remove('open'); resolve(false); };
            overlay.classList.add('open');
        }
    },

    init: function() {
        TKD_DATA.init(); this.loadData(); this.renderCalendar(); this.renderStudentList();
        this.populateDatalist(); this.initResizers(); this.renderPlanCards('add'); this.renderPlanCards('batch');
        
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('settingsDropdown'); const btn = document.getElementById('settingsBtn');
            if (this.state.settingsOpen && dropdown && !dropdown.contains(e.target) && !btn.contains(e.target)) { this.toggleSettings(); }
        });
    },

    loadData: function() {
        this.state.students = JSON.parse(localStorage.getItem('tkd_db_students')) || [];
        this.state.attendance = JSON.parse(localStorage.getItem('tkd_db_attendance')) || {};
    },
    saveData: function() {
        localStorage.setItem('tkd_db_students', JSON.stringify(this.state.students));
        localStorage.setItem('tkd_db_attendance', JSON.stringify(this.state.attendance));
    },
    
    // V4.11 動態設定庫獲取與儲存
    getSettings: function() { return TKD_DATA.getSettings(); },
    saveSettings: function(newSettings) {
        localStorage.setItem('tkd_db_settings', JSON.stringify(newSettings));
        // 保存設定後，全域介面瞬間重新渲染以保持同步
        this.renderPlanCards('add');
        this.renderPlanCards('batch');
        this.renderStudentList();
        this.updateBatchPriceSummary();
    },

    formatDate: (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; },

    // v4.11+ 防呆：attendance recordKey 解析（避免 courseId 內含 '_' 被 split 截斷）
    parseRecordKey: (rk) => {
        const i = (rk || '').indexOf('_');
        if(i === -1) return { dateStr: rk || '', courseId: '' };
        return { dateStr: rk.slice(0, i), courseId: rk.slice(i + 1) };
    },


    toggleSettings: function(e) {
        if(e) e.stopPropagation();
        this.state.settingsOpen = !this.state.settingsOpen;
        const dropdown = document.getElementById('settingsDropdown');
        if (this.state.settingsOpen) dropdown.classList.add('open'); else dropdown.classList.remove('open');
    },

    // =========================================================================
    // V4.11: 系統進階設定面板 (SaaS Dynamic Config Engine)
    // =========================================================================
    openSettingsConfigModal: function() {
        this.toggleSettings(); // 關閉下拉選單
        this.switchSettingsTab('plan');
        document.getElementById('settingsConfigModal').classList.add('open');
    },
    switchSettingsTab: function(tabName) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        if (tabName === 'plan') {
            document.getElementById('tabBtnPlan').classList.add('active');
            document.getElementById('tabPanePlan').classList.add('active');
            this.renderSettingsPlans();
        } else {
            document.getElementById('tabBtnCourse').classList.add('active');
            document.getElementById('tabPaneCourse').classList.add('active');
            this.renderSettingsDaySelector();
            this.renderSettingsCourses();
        }
    },

    // --- 方案管理系統 ---
    renderSettingsPlans: function() {
        const container = document.getElementById('settingsPlanList');
        const settings = this.getSettings();
        let html = '';
        
        settings.PRICING.MAIN.forEach(p => {
            html += `
                <div class="config-item">
                    <div class="config-info">
                        <div class="config-title">${p.name} <span class="badge-main">主方案</span></div>
                        <div class="config-meta">堂數：${p.sessions} 堂 | 金額：$${p.price.toLocaleString()}</div>
                    </div>
                    <button class="btn-del-config" onclick="app.deletePlan('MAIN', '${p.id}', '${p.name}')"><i class="ph-bold ph-trash"></i></button>
                </div>`;
        });
        settings.PRICING.TRAINING.forEach(p => {
            if (p.id === 't_none') return; // 基礎無集訓不可刪除
            html += `
                <div class="config-item">
                    <div class="config-info">
                        <div class="config-title">${p.name} <span class="badge-addon">集訓加購</span></div>
                        <div class="config-meta">金額：+$${p.price.toLocaleString()} / 月</div>
                    </div>
                    <button class="btn-del-config" onclick="app.deletePlan('TRAINING', '${p.id}', '${p.name}')"><i class="ph-bold ph-trash"></i></button>
                </div>`;
        });
        container.innerHTML = html;
    },
    openAddPlanModal: function() {
        document.getElementById('newPlanName').value = '';
        document.getElementById('newPlanSessions').value = '10';
        document.getElementById('newPlanPrice').value = '0';
        document.querySelector('input[name="newPlanType"][value="MAIN"]').checked = true;
        this.toggleNewPlanTypeUI();
        document.getElementById('addPlanModal').classList.add('open');
    },
    toggleNewPlanTypeUI: function() {
        const type = document.querySelector('input[name="newPlanType"]:checked').value;
        const sessionsGroup = document.getElementById('newPlanSessionsGroup');
        if (type === 'MAIN') sessionsGroup.style.display = 'block';
        else sessionsGroup.style.display = 'none'; // 加購方案不需要堂數
    },
    submitNewPlan: async function(e) {
        e.preventDefault();
        const type = document.querySelector('input[name="newPlanType"]:checked').value;
        const name = document.getElementById('newPlanName').value.trim();
        const price = parseInt(document.getElementById('newPlanPrice').value) || 0;
        const sessions = type === 'MAIN' ? (parseInt(document.getElementById('newPlanSessions').value) || 1) : 0;
        
        if (!name) return;
        let settings = this.getSettings();
        const newId = (type === 'MAIN' ? 'p_' : 't_') + Date.now();
        
        settings.PRICING[type].push({ id: newId, name: name, sessions: sessions, price: price });
        this.saveSettings(settings);
        
        this.closeModal('addPlanModal');
        this.renderSettingsPlans();
        await this.ui.alert(`✅ 已成功建立 ${type === 'MAIN' ? '主方案' : '加購方案'}：${name}`, 'success');
    },
    deletePlan: async function(type, planId, planName) {
        const proceed = await this.ui.confirm(`確定要刪除「${planName}」嗎？\n(已綁定此方案的舊學員將顯示為未設定，但剩餘堂數不會消失)`, 'danger');
        if (!proceed) return;
        
        let settings = this.getSettings();
        settings.PRICING[type] = settings.PRICING[type].filter(p => p.id !== planId);
        this.saveSettings(settings);
        this.renderSettingsPlans();
    },

    // --- 課表管理系統 ---
    renderSettingsDaySelector: function() {
        const container = document.getElementById('settingsDaySelector');
        const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        let html = '';
        for(let i=0; i<7; i++) {
            // 轉換邏輯：讓週一在最前面，週日在最後 (1,2,3,4,5,6,0)
            const mapDay = (i + 1) % 7;
            const isActive = mapDay === this.state.settingsDay ? 'active' : '';
            html += `<button class="day-btn ${isActive}" onclick="app.selectSettingsDay(${mapDay})">${days[mapDay]}</button>`;
        }
        container.innerHTML = html;
    },
    selectSettingsDay: function(day) {
        this.state.settingsDay = day;
        this.renderSettingsDaySelector();
        this.renderSettingsCourses();
    },
    renderSettingsCourses: function() {
        const container = document.getElementById('settingsCourseList');
        const settings = this.getSettings();
        const courses = settings.SCHEDULE[this.state.settingsDay] || [];
        
        if (courses.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:var(--text-light); padding:20px;">此日尚無排定任何課程</div>`;
            return;
        }

        let html = '';
        courses.forEach(c => {
            html += `
                <div class="config-item">
                    <div class="config-info">
                        <div class="config-title">${c.name}</div>
                        <div class="config-meta">上課時間：${c.time}</div>
                    </div>
                    <button class="btn-del-config" onclick="app.deleteCourse('${c.id}', '${c.name}')"><i class="ph-bold ph-trash"></i></button>
                </div>`;
        });
        container.innerHTML = html;
    },
    openAddCourseModal: function() {
        const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        document.getElementById('addCourseModalTitle').innerText = `新增 ${days[this.state.settingsDay]} 課程`;
        document.getElementById('newCourseTime').value = '';
        document.getElementById('newCourseName').value = '';
        document.getElementById('addCourseModal').classList.add('open');
    },
    submitNewCourse: async function(e) {
        e.preventDefault();
        const time = document.getElementById('newCourseTime').value.trim();
        const name = document.getElementById('newCourseName').value.trim();
        if (!time || !name) return;

        let settings = this.getSettings();
        if (!settings.SCHEDULE[this.state.settingsDay]) settings.SCHEDULE[this.state.settingsDay] = [];
        
        const newId = `c_${this.state.settingsDay}_` + Date.now();
        settings.SCHEDULE[this.state.settingsDay].push({ id: newId, time: time, name: name });
        
        // 自動依照時間字串排序 (例如 18:00 會排在 19:00 前面)
        settings.SCHEDULE[this.state.settingsDay].sort((a,b) => a.time.localeCompare(b.time));
        
        this.saveSettings(settings);
        this.closeModal('addCourseModal');
        this.renderSettingsCourses();
        await this.ui.alert(`✅ 已成功新增課程：${name}`, 'success');
    },
    deleteCourse: async function(courseId, courseName) {
        const proceed = await this.ui.confirm(`確定要刪除課程「${courseName}」嗎？\n(注意：舊有的排課紀錄仍會保留)`, 'danger');
        if (!proceed) return;
        
        let settings = this.getSettings();
        settings.SCHEDULE[this.state.settingsDay] = settings.SCHEDULE[this.state.settingsDay].filter(c => c.id !== courseId);
        this.saveSettings(settings);
        this.renderSettingsCourses();
    },
    // =========================================================================

    populateDatalist: function() {
        const datalist = document.getElementById('dbNamesList');
        const uniqueNames = [...new Set(this.state.students.map(s => s.name))];
        TKD_DATA.RAW_NAMES.forEach(n => { if(!uniqueNames.includes(n)) uniqueNames.push(n); });
        datalist.innerHTML = '';
        uniqueNames.forEach(name => { const opt = document.createElement('option'); opt.value = name; datalist.appendChild(opt); });
    },
    handleNameInputSearch: function(e) {
        const name = e.target.value.trim(); const existing = this.state.students.find(s => s.name === name);
        if (existing) {
            document.getElementById('addPhoneInput').value = existing.phone || ''; document.getElementById('addEmergencyInput').value = existing.emergency || '';
            if(existing.groupId !== undefined) {
                const groupRadio = document.querySelector(`input[name="studentGroup"][value="${existing.groupId}"]`);
                if(groupRadio) groupRadio.checked = true;
            } else { document.querySelector('input[name="studentGroup"][value=""]').checked = true; }

            const firstPlan = (existing.activePlans && existing.activePlans.length > 0) ? existing.activePlans[0] : '';
            this.selectPlan('add', firstPlan, 'main', true);
            if (existing.trainingId && existing.trainingId !== 't_none') { document.getElementById('toggleTraining_add').checked = true; this.toggleTrainingUI('add', true); this.selectPlan('add', existing.trainingId, 'training', true); } 
            else { document.getElementById('toggleTraining_add').checked = false; this.toggleTrainingUI('add', false); }
        }
    },

    // V4.11 動態渲染 UI (改為讀取 this.getSettings())
    renderPlanCards: function(context) {
        const settings = this.getSettings();
        document.getElementById(`planGrid_${context}`).innerHTML = settings.PRICING.MAIN.map(plan => `<div class="plan-card" id="card_${context}_${plan.id}" onclick="app.selectPlan('${context}', '${plan.id}', 'main')"><div class="plan-title">${plan.name}</div><div class="plan-price">$${plan.price.toLocaleString()}</div></div>`).join('');
        document.getElementById(`trainingGrid_${context}`).innerHTML = settings.PRICING.TRAINING.filter(t => t.id !== 't_none').map(plan => `<div class="plan-card" id="card_${context}_${plan.id}" onclick="app.selectPlan('${context}', '${plan.id}', 'training')"><div class="plan-title">${plan.name}</div><div class="plan-price">+$${plan.price.toLocaleString()} / 月</div></div>`).join('');
    },
    selectPlan: function(context, planId, type, forceSelect = false) {
        const container = document.getElementById(type === 'main' ? `planGrid_${context}` : `trainingGrid_${context}`);
        const targetCard = document.getElementById(`card_${context}_${planId}`);
        const inputId = type === 'main' ? `mainPlan_${context}` : `trainingPlan_${context}`;

        if (!forceSelect && targetCard && targetCard.classList.contains('active')) {
            targetCard.classList.remove('active'); document.getElementById(inputId).value = ''; 
        } else {
            container.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
            if(targetCard) targetCard.classList.add('active');
            document.getElementById(inputId).value = planId;
        }
        if(context === 'batch') this.updateBatchPriceSummary();
    },
    toggleTrainingUI: function(context, isEnabled) {
        const optionsDiv = document.getElementById(`trainingOptions_${context}`); const inputHidden = document.getElementById(`trainingPlan_${context}`);
        const settings = this.getSettings();
        if(isEnabled) {
            optionsDiv.style.display = 'block'; const firstT = settings.PRICING.TRAINING.find(t => t.id !== 't_none');
            if(firstT) { inputHidden.value = firstT.id; this.selectPlan(context, firstT.id, 'training', true); }
        } else {
            optionsDiv.style.display = 'none'; inputHidden.value = 't_none';
            document.getElementById(`trainingGrid_${context}`).querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
        }
        if(context === 'batch') this.updateBatchPriceSummary();
    },
    updateBatchPriceSummary: function() {
        const mainId = document.getElementById('mainPlan_batch').value; const trainId = document.getElementById('trainingPlan_batch').value;
        const settings = this.getSettings();
        const mPrice = mainId ? (settings.PRICING.MAIN.find(p => p.id === mainId)?.price || 0) : 0;
        const tPrice = (trainId && trainId !== 't_none') ? (settings.PRICING.TRAINING.find(p => p.id === trainId)?.price || 0) : 0;
        const summary = document.getElementById('batchPriceSummary'); if(summary) summary.innerText = `預估單次收費：$${(mPrice + tPrice).toLocaleString()}`;
    },

    handleStudentSubmit: async function(e) {
        e.preventDefault(); const name = document.getElementById('addNameInput').value.trim(); if(!name) return;
        const mainId = document.getElementById('mainPlan_add').value;
        if(!mainId) { const proceed = await this.ui.confirm('未選擇主方案，將視為無額度會員。確定儲存嗎？', 'warning'); if(!proceed) return; }

        const trainId = document.getElementById('trainingPlan_add').value || 't_none';
        const groupId = document.querySelector('input[name="studentGroup"]:checked').value;
        const settings = this.getSettings();
        const mainPlan = settings.PRICING.MAIN.find(p => p.id === mainId) || { sessions: 0 };
        const existing = this.state.students.find(s => s.name === name);
        const plansToSave = mainId ? [mainId] : []; 

        if(existing) { 
            const override = await this.ui.confirm(`確定覆蓋更新 [${name}] 的方案、群組與聯絡資料嗎？`, 'warning', '覆蓋確認');
            if(override) {
                existing.phone = document.getElementById('addPhoneInput').value; existing.emergency = document.getElementById('addEmergencyInput').value;
                existing.groupId = groupId; existing.activePlans = plansToSave; existing.trainingId = trainId;
                existing.balance = mainPlan.sessions; existing.accumulated = 0; 
                await this.ui.alert(`✅ 已更新會員 [${name}]`, 'success');
            } else return;
        } else {
            const newStudent = { id: 'stu_' + Date.now(), name: name, phone: document.getElementById('addPhoneInput').value, emergency: document.getElementById('addEmergencyInput').value, groupId: groupId, activePlans: plansToSave, trainingId: trainId, balance: mainPlan.sessions, accumulated: 0, globalNote: '', active: true };
            this.state.students.unshift(newStudent); await this.ui.alert(`✅ 已新增會員 [${name}]`, 'success');
        }
        this.saveData(); this.populateDatalist(); this.closeModal('studentModal'); this.renderStudentList();
    },

    toggleCalendar: function() {
        this.state.isCalendarCollapsed = !this.state.isCalendarCollapsed;
        const weekRow = document.getElementById('weekdayRow'); const grid = document.getElementById('calendarGrid');
        if (this.state.isCalendarCollapsed) { weekRow.classList.add('calendar-hidden'); grid.classList.add('calendar-hidden'); } 
        else { weekRow.classList.remove('calendar-hidden'); grid.classList.remove('calendar-hidden'); }
    },
    changeMonth: function(delta) { this.state.currentDate.setMonth(this.state.currentDate.getMonth() + delta); this.renderCalendar(); this.renderStudentList(); },
    renderCalendar: function() {
        const grid = document.getElementById('calendarGrid'); const weekdayRow = document.getElementById('weekdayRow');
        const year = this.state.currentDate.getFullYear(); const month = this.state.currentDate.getMonth();
        document.getElementById('currentMonthLabel').innerText = `${year}年 ${month + 1}月`;
        weekdayRow.innerHTML = ['日','一','二','三','四','五','六'].map((day, idx) => `<span class="${idx===0||idx===6 ? 'weekend-text' : ''}">${day}</span>`).join('');
        const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayKey = this.formatDate(new Date());

        grid.innerHTML = '';
        for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="day-cell empty"></div>`;
        for(let d=1; d<=daysInMonth; d++) {
            const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayOfWeek = new Date(year, month, d).getDay();
            const isToday = (dateKey === todayKey) ? 'today' : '';
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend-text' : '';
            const isPending = this.state.pendingDates[dateKey] ? 'pending-batch' : '';
            const hasData = Object.keys(this.state.attendance).some(k => k.startsWith(dateKey)) ? 'has-data' : '';
            grid.innerHTML += `<div class="day-cell ${isToday} ${isWeekend} ${isPending} ${hasData}" onclick="app.handleDateClick('${dateKey}', ${dayOfWeek})">${d}<div class="dot"></div></div>`;
        }
    },
    
    // V4.11 動態讀取課表：讀取 settings.SCHEDULE
    handleDateClick: async function(dateKey, dayOfWeek) {
        if (this.state.selectedStudentIds.size === 0) { await this.ui.alert('💡 請先在下方名單勾選學員'); return; }
        const todayKey = this.formatDate(new Date());
        if (dateKey < todayKey) { await this.ui.alert('⛔ 不能設定今天以前的日期（可選今天）', 'warning'); return; }
        const settings = this.getSettings();
        const courses = settings.SCHEDULE[dayOfWeek] || [];
        if (courses.length === 0) { await this.ui.alert('此日沒有排定課程，請先至【系統進階設定】中新增。', 'warning'); return; }

        this.state.tempSelectingDate = dateKey; document.getElementById('courseModalTitle').innerText = `排課 - ${dateKey}`;
        document.getElementById('courseRadioList').innerHTML = courses.map(c => `<label class="course-radio-item"><input type="radio" name="tempCourse" value="${c.id}"><div><div style="font-weight:bold; color:var(--primary);">${c.time}</div><div style="font-size:0.85rem; color:var(--text-light);">${c.name}</div></div></label>`).join('');
        document.getElementById('courseModal').classList.add('open');
    },
    confirmDateCourse: async function() {
        const selected = document.querySelector('input[name="tempCourse"]:checked');
        if (!selected) { await this.ui.alert('請選擇課程', 'warning'); return; }
        this.state.pendingDates[this.state.tempSelectingDate] = selected.value;
        this.closeCourseModal(); 
        this.renderCalendar(); 
        this.renderStudentList();
    },
    closeCourseModal: function() { document.getElementById('courseModal').classList.remove('open'); this.state.tempSelectingDate = null; },

    openFinalCommitModal: async function(mode) {
        if (this.state.selectedStudentIds.size === 0) { await this.ui.alert('請先在列表勾選學員'); return; }
        
        const dateKeys = Object.keys(this.state.pendingDates);
        const leaveKeys = Object.keys(this.state.pendingLeaves);
        const summaryText = document.getElementById('commitSummaryText');
        
        if (mode === 'commit') {
            if (dateKeys.length === 0 && leaveKeys.length === 0) { await this.ui.alert('請先點選月曆排課，或在列表設定請假天數。', 'warning'); return; }
            let msg = '';
            if (dateKeys.length > 0) msg += `▶ 即將為 ${this.state.selectedStudentIds.size} 人寫入 ${dateKeys.length} 天排程\n`;
            if (leaveKeys.length > 0) msg += `▶ 即將寫入請假紀錄\n`;
            summaryText.innerText = msg;
            summaryText.style.display = 'block';
            document.querySelector('input[name="planUpdateMode"][value="none"]').checked = true; 
        } else {
            summaryText.style.display = 'none';
            document.querySelector('input[name="planUpdateMode"][value="stack"]').checked = true; 
        }

        document.querySelectorAll('#planGrid_batch .plan-card').forEach(c => c.classList.remove('active'));
        document.getElementById('mainPlan_batch').value = '';
        this.toggleTrainingUI('batch', false); document.getElementById('toggleTraining_batch').checked = false;
        
        this.updateBatchPriceSummary(); 
        this.togglePlanMode();
        document.getElementById('batchPlanModal').classList.add('open');
    },

    togglePlanMode: function() {
        const mode = document.querySelector('input[name="planUpdateMode"]:checked').value;
        const area = document.getElementById('planSelectionArea');
        if(mode === 'none') { area.style.display = 'none'; } 
        else { area.style.display = 'block'; }
    },

    // V4.11 統一排程與動態方案結帳
    executeFinalCommit: async function() {
        const updateMode = document.querySelector('input[name="planUpdateMode"]:checked').value;
        const mainId = document.getElementById('mainPlan_batch').value;
        const trainId = document.getElementById('trainingPlan_batch').value;
        const settings = this.getSettings();
        const mainPlan = settings.PRICING.MAIN.find(p => p.id === mainId);
        const dateKeys = Object.keys(this.state.pendingDates);
        const hasLeaves = Object.keys(this.state.pendingLeaves).length > 0;

        if (updateMode !== 'none') {
            if(!mainId && updateMode === 'overwrite') { 
                const proceed1 = await this.ui.confirm('未選擇任何主方案，將會【清空該學員現有方案】，確定嗎？', 'danger'); 
                if(!proceed1) return; 
            }
        }

        if (dateKeys.length > 0 || hasLeaves) {
            this.state.selectedStudentIds.forEach(stuId => {
                const student = this.state.students.find(s => s.id === stuId);
                const leaveDays = this.state.pendingLeaves[stuId] || 0;
                dateKeys.forEach(dKey => {
                    const cId = this.state.pendingDates[dKey]; const recordKey = `${dKey}_${cId}`;
                    if (!this.state.attendance[recordKey]) this.state.attendance[recordKey] = {};
                    const existingStatus = this.state.attendance[recordKey][stuId]?.status;
                    if (leaveDays > 0) {
                        if (existingStatus === 'attend') student.balance++;
                        this.state.attendance[recordKey][stuId] = { status: 'leave', note: student.globalNote || '', leaveDays: leaveDays };
                    } else if (existingStatus !== 'attend') {
                        this.state.attendance[recordKey][stuId] = { status: 'attend', note: student.globalNote || '', leaveDays: 0 };
                        student.balance = Math.max(0, student.balance - 1); 
                    }
                });
            });
        }

        if (updateMode !== 'none') {
            this.state.selectedStudentIds.forEach(stuId => {
                const student = this.state.students.find(s => s.id === stuId);
                if(!student.activePlans) student.activePlans = [];
                if (updateMode === 'overwrite') {
                    student.activePlans = mainId ? [mainId] : [];
                    student.balance = (mainPlan && mainPlan.sessions > 0) ? mainPlan.sessions : 0;
                    student.accumulated = 0;
                } else if (updateMode === 'stack') {
                    if(mainId) student.activePlans.push(mainId);
                    if(mainPlan && mainPlan.sessions > 0) student.balance += mainPlan.sessions;
                }
                if(trainId !== 't_none') student.trainingId = trainId;
            });
        }

        this.saveData(); 
        this.state.selectedStudentIds.clear(); 
        this.state.pendingDates = {}; 
        this.state.pendingLeaves = {};
        this.closeModal('batchPlanModal'); 
        this.renderCalendar(); 
        this.renderStudentList(); 
        await this.ui.alert('✅ 操作已成功寫入資料庫', 'success');
    },

    discardBatch: async function() {
        if(this.state.selectedStudentIds.size === 0 && Object.keys(this.state.pendingDates).length === 0) return;
        const proceed = await this.ui.confirm('確定放棄所有的勾選、排程與請假嗎？', 'warning');
        if(proceed) { this.state.selectedStudentIds.clear(); this.state.pendingDates = {}; this.state.pendingLeaves = {}; this.renderCalendar(); this.renderStudentList(); }
    },

    deleteSelected: async function() {
        if(this.state.selectedStudentIds.size === 0) { await this.ui.alert('請先在列表勾選要刪除的學員', 'warning'); return; }
        const proceed = await this.ui.confirm(`確定要刪除這 ${this.state.selectedStudentIds.size} 名學員嗎？\n(注意：刪除後資料將無法復原)`, 'danger', '刪除確認');
        if(proceed) {
            this.state.selectedStudentIds.forEach(id => { this.state.students = this.state.students.filter(s => s.id !== id); });
            this.state.selectedStudentIds.clear(); this.saveData(); this.renderStudentList(); this.populateDatalist();
            await this.ui.alert('✅ 學員已成功刪除', 'success');
        }
    },

    // V4.11 終極 DB Sweeper：徹底清空包含空殼的資料節點
    resetSelected: async function() {
        if(this.state.selectedStudentIds.size === 0) { await this.ui.alert('請先在列表勾選要重置的學員', 'warning'); return; }
        const proceed = await this.ui.confirm(`確定重置這 ${this.state.selectedStudentIds.size} 名學員嗎？\n(將徹底清空方案、費用、堂數，並將歷史與未來的所有排課紀錄連根拔除)`, 'warning', '重置確認');
        if(proceed) {
            this.state.selectedStudentIds.forEach(id => {
                const stu = this.state.students.find(s => s.id === id);
                if(stu) { 
                    stu.activePlans = []; 
                    stu.trainingId = 't_none'; 
                    stu.balance = 0; 
                    stu.accumulated = 0; 
                    stu.globalNote = ''; 
                }
                
                Object.keys(this.state.attendance).forEach(recordKey => {
                    if (this.state.attendance[recordKey] && this.state.attendance[recordKey][id]) {
                        delete this.state.attendance[recordKey][id];
                    }
                    // V4.11: 銷毀空殼邏輯，如果這堂課沒人了，把整個 recordKey 刪除，避免報表出現幽靈資料
                    if (Object.keys(this.state.attendance[recordKey]).length === 0) {
                        delete this.state.attendance[recordKey];
                    }
                });
            });
            this.state.selectedStudentIds.clear(); this.saveData(); this.renderStudentList(); this.renderCalendar();
            await this.ui.alert('✅ 學員狀態與所有課程日期已徹底歸零重置', 'success');
        }
    },

    changeGroup: function(stuId, newGroup) {
        const stu = this.state.students.find(s => s.id === stuId);
        if(stu) { stu.groupId = newGroup; this.saveData(); this.renderStudentList(); }
    },

    toggleGroupFilter: function(grp) {
        const btn = document.getElementById(`filterBtn_${grp}`);
        if (this.state.filterGroups.has(grp)) { this.state.filterGroups.delete(grp); btn.classList.remove('active'); } 
        else { this.state.filterGroups.add(grp); btn.classList.add('active'); }
        this.renderStudentList();
    },

    sortBy: function(col) {
        if (this.state.sortCol === col) { this.state.sortAsc = !this.state.sortAsc; } 
        else { this.state.sortCol = col; this.state.sortAsc = (col === 'bal' || col === 'plan' || col === 'leave' || col === 'fee') ? false : true; }
        document.querySelectorAll('.sort-icon').forEach(el => { el.className = 'ph-bold ph-caret-up-down sort-icon'; el.classList.remove('active'); });
        const targetIcon = document.getElementById(`sort-icon-${col}`);
        if(targetIcon) { targetIcon.classList.add('active'); targetIcon.className = `ph-bold ph-caret-${this.state.sortAsc ? 'up' : 'down'} sort-icon active`; }
        this.renderStudentList();
    },

    // V4.11 動態計算引擎
    renderStudentList: function() {
        const container = document.getElementById('studentList'); container.innerHTML = '';
        const query = document.getElementById('searchInput').value.toLowerCase(); 
        let sortedStudents = [...this.state.students];
        const settings = this.getSettings(); // 獲取最新設定
        
        if (this.state.filterGroups.size > 0) { sortedStudents = sortedStudents.filter(s => this.state.filterGroups.has(s.groupId)); }

        const year = this.state.currentDate.getFullYear(); const month = this.state.currentDate.getMonth();
        const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;
        const todayStr = this.formatDate(new Date());

        sortedStudents.forEach(stu => {
            let scheduledDays = []; let usedPastOrTodayDbCount = 0;
            
            Object.keys(this.state.attendance).forEach(k => {
                const recDate = this.parseRecordKey(k).dateStr;
                if(k.startsWith(monthPrefix) && this.state.attendance[k][stu.id] && this.state.attendance[k][stu.id].status !== 'none') { 
                    scheduledDays.push(parseInt(recDate.split('-')[2], 10)); 
                }
                if (recDate <= todayStr && this.state.attendance[k][stu.id] && this.state.attendance[k][stu.id].status === 'attend') { usedPastOrTodayDbCount++; }
            });

            let pendingPastOrTodayCount = 0; 
            if(this.state.selectedStudentIds.has(stu.id)) {
                Object.keys(this.state.pendingDates).forEach(dKey => { 
                    if(dKey.startsWith(monthPrefix)) scheduledDays.push(parseInt(dKey.split('-')[2], 10)); 
                    if(dKey <= todayStr && (this.state.pendingLeaves[stu.id] || 0) === 0) { pendingPastOrTodayCount++; }
                });
            }
            
            stu._scheduledDays = [...new Set(scheduledDays)].sort((a,b) => a-b);
            stu._firstCourse = stu._scheduledDays.length > 0 ? stu._scheduledDays[0] : (this.state.sortAsc ? Infinity : -Infinity);

            let totalFee = 0; let planSessions = 0;
            if(stu.activePlans && Array.isArray(stu.activePlans) && stu.activePlans.length > 0) {
                stu.activePlans.forEach(pid => {
                    const pd = settings.PRICING.MAIN.find(p => p.id === pid);
                    if(pd) { planSessions += pd.sessions; totalFee += pd.price; }
                });
            }
            
            const training = settings.PRICING.TRAINING.find(t => t.id === stu.trainingId);
            if(training && training.id !== 't_none') totalFee += training.price;
            
            stu._totalFee = totalFee; stu._planSessions = planSessions; stu._leaveDays = this.state.pendingLeaves[stu.id] || 0;
            let displayRemaining = (stu._planSessions || 0) - usedPastOrTodayDbCount - pendingPastOrTodayCount;
            stu._displayRemaining = Math.max(0, displayRemaining);
        });

        if (this.state.sortCol) {
            sortedStudents.sort((a, b) => {
                let valA, valB;
                switch(this.state.sortCol) {
                    case 'name': return this.state.sortAsc ? a.name.localeCompare(b.name, 'zh-TW') : b.name.localeCompare(a.name, 'zh-TW');
                    case 'group': valA = a.groupId || ''; valB = b.groupId || ''; return this.state.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    case 'course': valA = a._firstCourse; valB = b._firstCourse; break;
                    case 'bal': valA = a._displayRemaining; valB = b._displayRemaining; break;
                    case 'plan': valA = a._planSessions; valB = b._planSessions; break;
                    case 'fee': valA = a._totalFee; valB = b._totalFee; break;
                    case 'leave': valA = a._leaveDays; valB = b._leaveDays; break;
                }
                if (valA < valB) return this.state.sortAsc ? -1 : 1;
                if (valA > valB) return this.state.sortAsc ? 1 : -1;
                return 0;
            });
        }

        if (query) sortedStudents = sortedStudents.filter(s => s.name.toLowerCase().includes(query));

        const nameTitle = document.getElementById('nameColTitle');
        if (nameTitle) nameTitle.innerHTML = `姓名 <span style="font-size:0.75rem; color:var(--primary);">(${sortedStudents.length}人)</span>`;

        sortedStudents.forEach(stu => {
            const isChecked = this.state.selectedStudentIds.has(stu.id);
            
            const groups = ['', 'A', 'B', 'C', 'D'];
            let groupOptions = groups.map(g => `<option value="${g}" ${stu.groupId === g ? 'selected' : ''}>${g === '' ? '-' : g}</option>`).join('');
            const groupHtml = `<select onchange="app.changeGroup('${stu.id}', this.value)">${groupOptions}</select>`;

            let planHtml = ''; 
            if(stu.activePlans && Array.isArray(stu.activePlans) && stu.activePlans.length > 0) {
                stu.activePlans.forEach(pid => { 
                    const pd = settings.PRICING.MAIN.find(p => p.id === pid); 
                    if(pd) { planHtml += `<div class="plan-tag">${pd.name}</div>`; }
                    else { planHtml += `<div class="plan-tag empty">[已停用方案]</div>`; } // 防呆機制
                });
            } else { planHtml = `<div class="plan-tag empty">未設定</div>`; }

            const training = settings.PRICING.TRAINING.find(t => t.id === stu.trainingId) || settings.PRICING.TRAINING[0];
            if(training.id !== 't_none') planHtml += `<div class="training-tag">${training.name}</div>`;

            let balanceHtml = '';
            if (!stu.activePlans || stu.activePlans.length === 0) {
                balanceHtml = `<div class="val-na" style="font-weight:bold;">N/A</div>`;
            } else {
                const styleCls = stu._displayRemaining <= 2 ? 'val-low' : 'val-session';
                balanceHtml = `<div class="bal-main ${styleCls}">${stu._displayRemaining}</div><div class="bal-sub">/ ${stu._planSessions}</div>`;
            }

            const courseStr = stu._scheduledDays.length > 0 ? `<span style="color:var(--success); font-weight:bold;">✅ ${stu._scheduledDays.join('、')}</span>` : '-';
            const nameHtml = stu.phone ? `<span class="has-phone" onclick="event.stopPropagation(); app.openContactModal('${stu.id}')">${stu.name}</span>` : `<span>${stu.name}</span>`;
            const noteClass = stu.globalNote ? 'has-note' : '';
            const currentLeave = stu._leaveDays;
            let leaveOptions = '';
            for(let i=0; i<=8; i++) leaveOptions += `<option value="${i}" ${currentLeave == i ? 'selected' : ''}>${i==0 ? '無' : i+'天'}</option>`;

                                    let rowClass = `student-row ${isChecked ? 'selected-row' : ''} ${currentLeave > 0 ? 'leave-mode' : ''}`;

            const row = document.createElement('div'); 
            row.className = rowClass;

            // 完全對齊 v4.3.1 寫法：將 onclick 直接綁定在 custom-check 上，並強制開啟 pointer-events
            row.innerHTML = `
                <div class="col-check" onclick="app.toggleStudentSelect('${stu.id}')" style="cursor:pointer;">
                    <div class="custom-check ${isChecked ? 'checked' : ''}">${isChecked ? '<i class="ph-bold ph-check"></i>' : ''}</div>
                </div>
                <div class="col-name">${nameHtml}</div>
                <div class="col-group">${groupHtml}</div>
                <div class="col-course">${courseStr}</div>
                <div class="col-bal">${balanceHtml}</div>
                <div class="col-plan">${planHtml}</div>
                <div class="col-fee ${stu._totalFee === 0 ? 'val-na' : ''}">$${stu._totalFee.toLocaleString()}</div>
                <div class="col-leave"><select onchange="app.handleLeaveChange('${stu.id}', this.value)">${leaveOptions}</select></div>
                <div class="col-note"><button class="note-btn ${noteClass}" onclick="app.openNoteModal('${stu.id}')"><i class="ph-fill ph-chat-text"></i></button></div>
            `;
            container.appendChild(row);
                        
            
                                                            
        });
    },

    // 勾選列：僅影響 selectedStudentIds（不動 UI）
    toggleStudentSelect: function(stuId) {
        if(!stuId) return;
        if(this.state.selectedStudentIds.has(stuId)) this.state.selectedStudentIds.delete(stuId);
        else this.state.selectedStudentIds.add(stuId);
        // 只更新資料與渲染，不改版面
        this.renderStudentList();
        if(typeof this.updateBatchPriceSummary === 'function') this.updateBatchPriceSummary();
        if(typeof this.togglePlanMode === 'function') this.togglePlanMode();
    },

    exportExcel: async function() {
        this.toggleSettings(); 
        if(this.state.students.length === 0) return await this.ui.alert('資料庫無學員可匯出', 'warning');
        
        let csv = '\uFEFF'; 
        csv += '姓名,群組,電話,緊急聯絡人,本月排定日期,剩餘堂數 / 總堂數,付費項目,當前總費用,請假暫存天數,備註\n';
        
        const year = this.state.currentDate.getFullYear(); const month = this.state.currentDate.getMonth();
        const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;
        const todayStr = this.formatDate(new Date());
        const settings = this.getSettings();

        this.state.students.forEach(stu => {
            let scheduledDays = []; let usedPastOrTodayDbCount = 0;
            Object.keys(this.state.attendance).forEach(k => {
                const recDate = this.parseRecordKey(k).dateStr;
                if(k.startsWith(monthPrefix) && this.state.attendance[k][stu.id] && this.state.attendance[k][stu.id].status !== 'none') { scheduledDays.push(parseInt(recDate.split('-')[2], 10)); }
                if (recDate <= todayStr && this.state.attendance[k][stu.id] && this.state.attendance[k][stu.id].status === 'attend') { usedPastOrTodayDbCount++; }
            });
            scheduledDays = [...new Set(scheduledDays)].sort((a,b) => a-b).join('、');

            let planNames = []; let planSessions = 0; let totalFee = 0;
            if(stu.activePlans && Array.isArray(stu.activePlans) && stu.activePlans.length > 0) {
                stu.activePlans.forEach(pid => { const pd = settings.PRICING.MAIN.find(p => p.id === pid); if(pd) { planNames.push(pd.name); totalFee += pd.price; planSessions += pd.sessions; } });
            }
            
            const training = settings.PRICING.TRAINING.find(t => t.id === stu.trainingId);
            if(training && training.id !== 't_none') { planNames.push(training.name); totalFee += training.price; }
            
            const planStr = planNames.length > 0 ? planNames.join(' + ') : '未設定';
            const groupStr = stu.groupId || '-';
            
            let balStr = 'N/A';
            if(planSessions > 0 || (stu.activePlans && stu.activePlans.length > 0)) { 
                let displayRemaining = Math.max(0, planSessions - usedPastOrTodayDbCount); 
                balStr = `${displayRemaining} / ${planSessions}`; 
            }

            const leaveStr = this.state.pendingLeaves[stu.id] || 0;
            const noteStr = (stu.globalNote || '').replace(/"/g, '""').replace(/\n/g, ' '); 

            csv += `"${stu.name}","${groupStr}","${stu.phone||''}","${stu.emergency||''}","${scheduledDays}","${balStr}","${planStr}","$${totalFee}","${leaveStr}","${noteStr}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
        link.download = `TKD_學員總表_${monthPrefix}.csv`; link.click();
    },

    printReceipt: async function() {
        this.toggleSettings(); 
        if(this.state.selectedStudentIds.size === 0) return await this.ui.alert('請先在列表勾選要列印收據的學員', 'warning');
        
        const printArea = document.getElementById('receipt-print-area'); let html = '<div class="receipt-page">';
        const todayStr = this.formatDate(new Date());
        const settings = this.getSettings();

        this.state.selectedStudentIds.forEach(id => {
            const stu = this.state.students.find(s => s.id === id);
            let planNames = []; let totalSessions = 0;
            if(stu.activePlans && Array.isArray(stu.activePlans) && stu.activePlans.length > 0) {
                stu.activePlans.forEach(pid => { const p = settings.PRICING.MAIN.find(x => x.id === pid); if(p) { planNames.push(`[${p.name}]`); if(p.sessions > 0) totalSessions += p.sessions; } });
            }
            const tr = settings.PRICING.TRAINING.find(t => t.id === stu.trainingId);
            if(tr && tr.id !== 't_none') { planNames.push(`[${tr.name}]`); }
            
            const planDisplay = planNames.length > 0 ? planNames.join(' + ') : '未設定';
            const sessionDisplay = totalSessions > 0 ? `${totalSessions} 堂` : 'N/A (無額度)';

            html += `
                <div class="receipt-slip">
                    <div class="receipt-header"><h2>道館繳費收據</h2><p style="font-size:14px; margin:0; color:#555;">列印日期：${todayStr}</p></div>
                    <div class="receipt-body">
                        <div class="receipt-row" style="font-size:20px;"><strong>學員姓名：</strong><span>${stu.name}</span></div>
                        <div class="receipt-row" style="font-size:16px; color:#4B5563;"><strong>聯絡電話：</strong><span>${stu.phone || '未提供'}</span></div>
                        <div class="receipt-row" style="font-size:16px; color:#4B5563;"><strong>緊急聯絡：</strong><span>${stu.emergency || '未提供'}</span></div>
                        <hr style="border-top:1px dashed #CCC; margin:10px 0;">
                        <div class="receipt-row"><strong>綁定方案：</strong><span>${planDisplay}</span></div>
                        <div class="receipt-row"><strong>總共堂數：</strong><span>${sessionDisplay}</span></div>
                        <hr style="border-top:2px solid #000; margin:15px 0;">
                        <div class="receipt-row amount-line"><span>本次實收金額：</span><span>$ _________________</span></div>
                    </div>
                    <div class="receipt-footer"><div style="font-weight:bold;">經手人簽名：<div class="signature-line"></div></div></div>
                </div>
            `;
        });
        html += '</div>'; printArea.innerHTML = html;
        setTimeout(() => { window.print(); window.addEventListener('afterprint', () => { printArea.innerHTML = ''; }, {once:true}); setTimeout(() => { printArea.innerHTML = ''; }, 3000); }, 300);
    },

    openMonthSummary: function() {
        const content = document.getElementById('monthSummaryContent');
        const year = this.state.currentDate.getFullYear(); const month = this.state.currentDate.getMonth();
        const prefix = `${year}-${String(month+1).padStart(2,'0')}`;
        let html = ''; let monthHasData = false;
        const settings = this.getSettings();

        // 收集本月所有有出席/請假的紀錄（用 parseRecordKey 防止 courseId 含 '_' 被截斷）
        const entries = [];
        Object.keys(this.state.attendance).forEach(rk => {
            if(!rk.startsWith(prefix)) return;
            const records = this.state.attendance[rk] || {};
            const { dateStr, courseId } = this.parseRecordKey(rk);

            const attendees = []; const leaves = [];
            Object.keys(records).forEach(sid => {
                const stu = this.state.students.find(s => s.id === sid); if(!stu) return;
                if(records[sid].status === 'attend') attendees.push(stu.name);
                if(records[sid].status === 'leave') leaves.push(`${stu.name}(請假)`);
            });
            if(attendees.length === 0 && leaves.length === 0) return;

            monthHasData = true;

            // 依日期取得該日課表資訊
            let courseInfo = { time:'', name:'[舊課表/已刪除]', mode:'' };
            const parts = (dateStr || '').split('-');
            if(parts.length === 3) {
                const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                const dayList = (settings.SCHEDULE[dObj.getDay()] || []);
                courseInfo = dayList.find(c => c.id === courseId) || courseInfo;
            }

            // 同日內排序：依開始時間（無時間則排最後）
            let startMin = 9999;
            if(courseInfo && courseInfo.time) {
                const norm = String(courseInfo.time).replace('–','-').replace('—','-');
                const m = norm.match(/(\d{1,2}):(\d{2})/);
                if(m) startMin = parseInt(m[1],10) * 60 + parseInt(m[2],10);
                courseInfo = Object.assign({}, courseInfo, { time: norm });
            }

            entries.push({ dateStr, courseId, startMin, courseInfo, attendees, leaves });
        });

        // 依日期分組：同一天多堂課合併成同一張卡
        const byDate = {};
        entries.forEach(e => {
            if(!byDate[e.dateStr]) byDate[e.dateStr] = [];
            byDate[e.dateStr].push(e);
        });

        // 最近日期 -> 最遠日期（日期字串為 ISO 格式，可直接用字典序）
        const dateKeys = Object.keys(byDate).sort((a,b) => b.localeCompare(a));

        dateKeys.forEach(dateStr => {
            const list = (byDate[dateStr] || []).sort((a,b) => a.startMin - b.startMin);

            html += `
                <div class="summary-item-card">
                    <div class="sc-header" style="border-bottom:none; margin-bottom:0; padding-bottom:4px; align-items:center;">
                        <span class="sc-date" style="font-size:1.05rem;">${dateStr}</span>
                    </div>
            `;

            list.forEach((e, idx) => {
                const attLine = e.attendees.length > 0 ? e.attendees.join(', ') : '無';
                const leaveLine = e.leaves.length > 0 ? e.leaves.join(', ') : '';
                const timeName = `${(e.courseInfo.time || '').trim()} ${(e.courseInfo.name || '').trim()}${e.courseInfo.mode ? ' ' + e.courseInfo.mode : ''}`.trim();

                html += `
                    <div style="${idx === 0 ? '' : 'margin-top:10px;'} border-top:${idx === 0 ? 'none' : '1px dashed var(--border)'}; padding-top:${idx === 0 ? '0' : '6px'};">
                        <div class="sc-attendees" style="font-size:0.95rem; color:var(--text);">出席：${attLine}</div>
                        <div style="font-size:0.9rem; color:var(--text-light); margin-top:4px;">
                            <span style="font-weight:bold; color:var(--primary);">課程：</span>${timeName || '[舊課表/已刪除]'}
                        </div>
                        ${leaveLine ? `<div class="sc-leaves" style="margin-top:4px;">未到：${leaveLine}</div>` : ``}
                    </div>
                `;
            });

            html += `
                </div>
            `;
        });

        if(!monthHasData) {
            html = `<div style="color:var(--text-light); text-align:center; padding:16px 0;">本月尚無排程紀錄</div>`;
        }

        content.innerHTML = html;
        document.getElementById('monthSummaryModal').classList.add('open');
    },

    openContactModal: function(stuId) { const stu = this.state.students.find(s => s.id === stuId); if(!stu) return; document.getElementById('contactName').innerText = stu.name; const phoneLink = document.getElementById('contactPhoneLink'); phoneLink.innerText = stu.phone || '未提供'; phoneLink.href = stu.phone ? `tel:${stu.phone}` : '#'; document.getElementById('contactEmergency').innerText = stu.emergency || '無緊急聯絡人'; document.getElementById('contactModal').classList.add('open'); },
    openNoteModal: function(stuId) { this.state.editingNoteStuId = stuId; document.getElementById('noteInput').value = this.state.students.find(s => s.id === stuId)?.globalNote || ''; document.getElementById('noteModal').classList.add('open'); },
    saveNote: function() { const stu = this.state.students.find(s => s.id === this.state.editingNoteStuId); if(stu) { stu.globalNote = document.getElementById('noteInput').value; this.saveData(); this.renderStudentList(); } this.closeModal('noteModal'); },
    initResizers: function() { const resizers = document.querySelectorAll('.resizer'); const wrapper = document.getElementById('tableWrapper'); let currentResizer, startX, startWidth; resizers.forEach(r => { r.addEventListener('mousedown', initDrag); r.addEventListener('touchstart', initDrag, {passive: false}); }); function initDrag(e) { e.preventDefault(); currentResizer = e.target; startX = e.clientX || e.touches[0].clientX; startWidth = parseInt(getComputedStyle(wrapper).getPropertyValue(`--w-${currentResizer.getAttribute('data-col')}`)) || 100; document.addEventListener('mousemove', doDrag); document.addEventListener('touchmove', doDrag, {passive: false}); document.addEventListener('mouseup', stopDrag); document.addEventListener('touchend', stopDrag); } function doDrag(e) { if (!currentResizer) return; if(e.cancelable) e.preventDefault(); const diff = (e.clientX || (e.touches ? e.touches[0].clientX : startX)) - startX; wrapper.style.setProperty(`--w-${currentResizer.getAttribute('data-col')}`, `${Math.max(60, startWidth + diff)}px`); } function stopDrag() { currentResizer = null; document.removeEventListener('mousemove', doDrag); document.removeEventListener('touchmove', doDrag); document.removeEventListener('mouseup', stopDrag); document.removeEventListener('touchend', stopDrag); } },
    openModal: function(mode) { if(mode === 'add') { document.getElementById('addNameInput').value = ''; document.getElementById('addPhoneInput').value = ''; document.getElementById('addEmergencyInput').value = ''; document.querySelectorAll('#planGrid_add .plan-card').forEach(c => c.classList.remove('active')); document.getElementById('mainPlan_add').value = ''; this.toggleTrainingUI('add', false); document.getElementById('toggleTraining_add').checked = false; document.querySelector('input[name="studentGroup"][value=""]').checked = true; } document.getElementById('studentModal').classList.add('open'); },
    closeModal: function(mId) { document.getElementById(mId).classList.remove('open'); },
    filterStudents: function() { this.renderStudentList(); }
};
document.addEventListener('DOMContentLoaded', () => { app.init(); });
