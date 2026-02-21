/**
 * MODEL: Logic_Layer
 * VERSION: V.4.9.0
 * DESCRIPTION: Hitbox Expansion, Absolute Zero State Fix, Unified Output
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
        filterGroups: new Set() 
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
    formatDate: (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; },

    toggleSettings: function(e) {
        if(e) e.stopPropagation();
        this.state.settingsOpen = !this.state.settingsOpen;
        const dropdown = document.getElementById('settingsDropdown');
        if (this.state.settingsOpen) dropdown.classList.add('open'); else dropdown.classList.remove('open');
    },

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

    renderPlanCards: function(context) {
        document.getElementById(`planGrid_${context}`).innerHTML = TKD_DATA.PRICING.MAIN.map(plan => `<div class="plan-card" id="card_${context}_${plan.id}" onclick="app.selectPlan('${context}', '${plan.id}', 'main')"><div class="plan-title">${plan.name}</div><div class="plan-price">$${plan.price.toLocaleString()}</div></div>`).join('');
        document.getElementById(`trainingGrid_${context}`).innerHTML = TKD_DATA.PRICING.TRAINING.filter(t => t.id !== 't_none').map(plan => `<div class="plan-card" id="card_${context}_${plan.id}" onclick="app.selectPlan('${context}', '${plan.id}', 'training')"><div class="plan-title">${plan.name}</div><div class="plan-price">+$${plan.price.toLocaleString()} / 月</div></div>`).join('');
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
        if(isEnabled) {
            optionsDiv.style.display = 'block'; const firstT = TKD_DATA.PRICING.TRAINING.find(t => t.id !== 't_none');
            inputHidden.value = firstT.id; this.selectPlan(context, firstT.id, 'training', true);
        } else {
            optionsDiv.style.display = 'none'; inputHidden.value = 't_none';
            document.getElementById(`trainingGrid_${context}`).querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
        }
        if(context === 'batch') this.updateBatchPriceSummary();
    },
    updateBatchPriceSummary: function() {
        const mainId = document.getElementById('mainPlan_batch').value; const trainId = document.getElementById('trainingPlan_batch').value;
        const mPrice = mainId ? (TKD_DATA.PRICING.MAIN.find(p => p.id === mainId)?.price || 0) : 0;
        const tPrice = (trainId && trainId !== 't_none') ? (TKD_DATA.PRICING.TRAINING.find(p => p.id === trainId)?.price || 0) : 0;
        const summary = document.getElementById('batchPriceSummary'); if(summary) summary.innerText = `預估單次收費：$${(mPrice + tPrice).toLocaleString()}`;
    },

    handleStudentSubmit: async function(e) {
        e.preventDefault(); const name = document.getElementById('addNameInput').value.trim(); if(!name) return;
        const mainId = document.getElementById('mainPlan_add').value;
        if(!mainId) { const proceed = await this.ui.confirm('未選擇主方案，將視為無額度會員。確定儲存嗎？', 'warning'); if(!proceed) return; }

        const trainId = document.getElementById('trainingPlan_add').value || 't_none';
        const groupId = document.querySelector('input[name="studentGroup"]:checked').value;
        const mainPlan = TKD_DATA.PRICING.MAIN.find(p => p.id === mainId) || { sessions: 0 };
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
    handleDateClick: async function(dateKey, dayOfWeek) {
        if (this.state.selectedStudentIds.size === 0) { await this.ui.alert('💡 請先在下方名單勾選學員'); return; }
        const courses = TKD_DATA.SCHEDULE[dayOfWeek] || [];
        if (courses.length === 0) { await this.ui.alert('此日沒有排定課程'); return; }

        this.state.tempSelectingDate = dateKey; document.getElementById('courseModalTitle').innerText = `排課 - ${dateKey}`;
        document.getElementById('courseRadioList').innerHTML = courses.map(c => `<label class="course-radio-item"><input type="radio" name="tempCourse" value="${c.id}"><div><div style="font-weight:bold; color:var(--primary);">${c.time}</div><div style="font-size:0.85rem; color:var(--text-light);">${c.name}</div></div></label>`).join('');
        document.getElementById('courseModal').classList.add('open');
    },
    confirmDateCourse: async function() {
        const selected = document.querySelector('input[name="tempCourse"]:checked');
        if (!selected) { await this.ui.alert('請選擇課程', 'warning'); return; }
        this.state.pendingDates[this.state.tempSelectingDate] = selected.value;
        this.closeCourseModal(); this.renderCalendar(); this.renderStudentList();
        this.openBatchPlanModal(); 
    },
    closeCourseModal: function() { document.getElementById('courseModal').classList.remove('open'); this.state.tempSelectingDate = null; },

    deleteSelected: async function() {
        if(this.state.selectedStudentIds.size === 0) { await this.ui.alert('請先在列表勾選要刪除的學員', 'warning'); return; }
        const proceed = await this.ui.confirm(`確定要刪除這 ${this.state.selectedStudentIds.size} 名學員嗎？\n(注意：刪除後資料將無法復原)`, 'danger', '刪除確認');
        if(proceed) {
            this.state.selectedStudentIds.forEach(id => { this.state.students = this.state.students.filter(s => s.id !== id); });
            this.state.selectedStudentIds.clear(); this.saveData(); this.renderStudentList(); this.populateDatalist();
            await this.ui.alert('✅ 學員已成功刪除', 'success');
        }
    },

    resetSelected: async function() {
        if(this.state.selectedStudentIds.size === 0) { await this.ui.alert('請先在列表勾選要重置的學員', 'warning'); return; }
        const proceed = await this.ui.confirm(`確定重置這 ${this.state.selectedStudentIds.size} 名學員嗎？\n(將徹底清空方案、歸零費用與堂數，保留姓名與群組)`, 'warning', '重置確認');
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
            });
            this.state.selectedStudentIds.clear(); this.saveData(); this.renderStudentList();
            await this.ui.alert('✅ 學員狀態已徹底歸零重置', 'success');
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

    renderStudentList: function() {
        const container = document.getElementById('studentList'); container.innerHTML = '';
        const query = document.getElementById('searchInput').value.toLowerCase(); 
        let sortedStudents = [...this.state.students];
        
        if (this.state.filterGroups.size > 0) { sortedStudents = sortedStudents.filter(s => this.state.filterGroups.has(s.groupId)); }

        const year = this.state.currentDate.getFullYear(); const month = this.state.currentDate.getMonth();
        const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;
        const todayStr = this.formatDate(new Date());

        sortedStudents.forEach(stu => {
            let scheduledDays = []; let futureDbCount = 0;
            
            Object.keys(this.state.attendance).forEach(k => {
                const recDate = k.split('_')[0];
                if(k.startsWith(monthPrefix) && this.state.attendance[k][stu.id] && this.state.attendance[k][stu.id].status !== 'none') { 
                    scheduledDays.push(parseInt(recDate.split('-')[2], 10)); 
                }
                if (recDate > todayStr && this.state.attendance[k][stu.id] && this.state.attendance[k][stu.id].status === 'attend') { futureDbCount++; }
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
            
           // V4.9 修復：徹底移除預設 +800 單堂，真實呈現 0 元
            if(stu.activePlans && Array.isArray(stu.activePlans) && stu.activePlans.length > 0) {
                stu.activePlans.forEach(pid => {
                    const pd = TKD_DATA.PRICING.MAIN.find(p => p.id === pid);
                    if(pd) { planSessions += pd.sessions; totalFee += pd.price; }
                });
            }
            
            const training = TKD_DATA.PRICING.TRAINING.find(t => t.id === stu.trainingId);
            if(training && training.id !== 't_none') totalFee += training.price;
            
            stu._totalFee = totalFee; stu._planSessions = planSessions; stu._leaveDays = this.state.pendingLeaves[stu.id] || 0;

            let displayRemaining = stu.balance + futureDbCount - pendingPastOrTodayCount;
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
            // V4.9 乾淨的未設定顯示
            if(stu.activePlans && Array.isArray(stu.activePlans) && stu.activePlans.length > 0) {
                stu.activePlans.forEach(pid => { const pd = TKD_DATA.PRICING.MAIN.find(p => p.id === pid); if(pd) planHtml += `<div class="plan-tag">${pd.name}</div>`; });
            } else { 
                planHtml = `<div class="plan-tag empty">未設定</div>`; 
            }

            const training = TKD_DATA.PRICING.TRAINING.find(t => t.id === stu.trainingId) || TKD_DATA.PRICING.TRAINING[0];
            if(training.id !== 't_none') planHtml += `<div class="training-tag">${training.name}</div>`;

            let balanceHtml = '';
            // V4.9 絕對防呆 N/A 顯示：只要沒方案，一律顯示 N/A
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

            const row = document.createElement('div'); row.className = rowClass;
            
            // V4.9 修復：將 onclick 綁定在整個 col-check 上，極大幅度增加點擊感應區
            row.innerHTML = `
                <div class="col-check" onclick="app.toggleStudentSelect('${stu.id}')" style="cursor:pointer; width:100%; height:100%;">
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

    toggleStudentSelect: function(stuId) {
        if (this.state.selectedStudentIds.has(stuId)) { this.state.selectedStudentIds.delete(stuId); delete this.state.pendingLeaves[stuId]; } 
        else { this.state.selectedStudentIds.add(stuId); }
        this.renderStudentList();
    },
    handleLeaveChange: function(stuId, days) {
        const val = parseInt(days);
        if (val > 0) { this.state.pendingLeaves[stuId] = val; this.state.selectedStudentIds.add(stuId); } else { delete this.state.pendingLeaves[stuId]; }
        this.renderStudentList();
    },

    commitBatch: async function() {
        if (this.state.selectedStudentIds.size === 0) { await this.ui.alert('💡 請先在列表勾選學員，設定排課或請假'); return; }
        const dateKeys = Object.keys(this.state.pendingDates);
        const hasLeaves = Object.keys(this.state.pendingLeaves).length > 0;
        
        if (dateKeys.length === 0 && !hasLeaves) { await this.ui.alert('請先點選日期排課，或在列表設定請假天數。', 'warning'); return; }
        
        let msg = `確認執行以下操作？\n`;
        if (dateKeys.length > 0) msg += `▶ 排入 ${dateKeys.length} 天課程\n`;
        if (hasLeaves) msg += `▶ 寫入請假紀錄 (保留回補)\n`;
        const proceed = await this.ui.confirm(msg, 'info', '寫入確認');
        if(!proceed) return;

        this.state.selectedStudentIds.forEach(stuId => {
            const student = this.state.students.find(s => s.id === stuId);
            const leaveDays = this.state.pendingLeaves[stuId] || 0;

            dateKeys.forEach(dKey => {
                const cId = this.state.pendingDates[dKey]; const recordKey = `${dKey}_${cId}`;
                if (!this.state.attendance[recordKey]) this.state.attendance[recordKey] = {};
                const existingStatus = this.state.attendance[recordKey][stuId]?.status;
                
                if (leaveDays > 0) {
                    if (existingStatus === 'attend') { student.balance++; } 
                    this.state.attendance[recordKey][stuId] = { status: 'leave', note: student.globalNote || '', leaveDays: leaveDays };
                } else if (existingStatus !== 'attend') {
                    this.state.attendance[recordKey][stuId] = { status: 'attend', note: student.globalNote || '', leaveDays: 0 };
                    student.balance = Math.max(0, student.balance - 1); 
                }
            });
        });

        this.saveData(); this.state.selectedStudentIds.clear(); this.state.pendingDates = {}; this.state.pendingLeaves = {};
        this.renderCalendar(); this.renderStudentList(); await this.ui.alert('✅ 排程與請假已寫入資料庫', 'success');
    },

discardBatch: async function() {
        if(this.state.selectedStudentIds.size === 0 && Object.keys(this.state.pendingDates).length === 0) return;
        const proceed = await this.ui.confirm('確定放棄所有的勾選、排程與請假嗎？', 'warning');
        if(proceed) { this.state.selectedStudentIds.clear(); this.state.pendingDates = {}; this.state.pendingLeaves = {}; this.renderCalendar(); this.renderStudentList(); }
    },

    openBatchPlanModal: async function() {
        if(this.state.selectedStudentIds.size === 0) { await this.ui.alert('請先在列表勾選學員'); return; }
        document.querySelectorAll('#planGrid_batch .plan-card').forEach(c => c.classList.remove('active'));
        document.getElementById('mainPlan_batch').value = '';
        this.toggleTrainingUI('batch', false); document.getElementById('toggleTraining_batch').checked = false;
        document.querySelector('input[name="planUpdateMode"][value="stack"]').checked = true;
        this.updateBatchPriceSummary(); document.getElementById('batchPlanModal').classList.add('open');
    },

    confirmBatchPlan: async function() {
        const mainId = document.getElementById('mainPlan_batch').value;
        const trainId = document.getElementById('trainingPlan_batch').value;
        const updateMode = document.querySelector('input[name="planUpdateMode"]:checked').value;
        const mainPlan = TKD_DATA.PRICING.MAIN.find(p => p.id === mainId);
        
        if(!mainId && updateMode === 'overwrite') { 
            const proceed1 = await this.ui.confirm('未選擇任何主方案，將會【清空該學員現有方案】，確定嗎？', 'danger'); 
            if(!proceed1) return; 
        } else if (mainId) {
            const proceed2 = await this.ui.confirm(`確定為 ${this.state.selectedStudentIds.size} 人更新方案嗎？\n模式：[${updateMode === 'stack' ? '疊加保留舊堂數' : '覆蓋重置新堂數'}]`, 'warning');
            if(!proceed2) return;
        }

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
        this.saveData(); this.closeModal('batchPlanModal'); this.renderStudentList(); await this.ui.alert('✅ 方案更新成功！', 'success');
    },

    exportExcel: async function() {
        this.toggleSettings(); 
        if(this.state.students.length === 0) return await this.ui.alert('資料庫無學員可匯出', 'warning');
        
        let csv = '\uFEFF'; 
        csv += '姓名,群組,電話,緊急聯絡人,本月排定日期,剩餘堂數 / 總堂數,付費項目,當前總費用,請假暫存天數,備註\n';
        
        const year = this.state.currentDate.getFullYear(); const month = this.state.currentDate.getMonth();
        const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;
        const todayStr = this.formatDate(new Date());

        this.state.students.forEach(stu => {
            let scheduledDays = []; let futureDbCount = 0;
            Object.keys(this.state.attendance).forEach(k => {
                const recDate = k.split('_')[0];
                if(k.startsWith(monthPrefix) && this.state.attendance[k][stu.id] && this.state.attendance[k][stu.id].status !== 'none') { scheduledDays.push(parseInt(recDate.split('-')[2], 10)); }
                if (recDate > todayStr && this.state.attendance[k][stu.id] && this.state.attendance[k][stu.id].status === 'attend') { futureDbCount++; }
            });
            scheduledDays = [...new Set(scheduledDays)].sort((a,b) => a-b).join('、');

            let planNames = []; let planSessions = 0; let totalFee = 0;
            if(stu.activePlans && Array.isArray(stu.activePlans) && stu.activePlans.length > 0) {
                stu.activePlans.forEach(pid => { const pd = TKD_DATA.PRICING.MAIN.find(p => p.id === pid); if(pd) { planNames.push(pd.name); totalFee += pd.price; planSessions += pd.sessions; } });
            }
            
            const training = TKD_DATA.PRICING.TRAINING.find(t => t.id === stu.trainingId);
            if(training && training.id !== 't_none') { planNames.push(training.name); totalFee += training.price; }
            
            const planStr = planNames.length > 0 ? planNames.join(' + ') : '未設定';
            const groupStr = stu.groupId || '-';
            
            let balStr = 'N/A';
            if(planSessions > 0 || (stu.activePlans && stu.activePlans.length > 0)) { 
                let displayRemaining = Math.max(0, stu.balance + futureDbCount); 
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

        this.state.selectedStudentIds.forEach(id => {
            const stu = this.state.students.find(s => s.id === id);
            let planNames = []; let totalSessions = 0;
            if(stu.activePlans && Array.isArray(stu.activePlans) && stu.activePlans.length > 0) {
                stu.activePlans.forEach(pid => { const p = TKD_DATA.PRICING.MAIN.find(x => x.id === pid); if(p) { planNames.push(`[${p.name}]`); if(p.sessions > 0) totalSessions += p.sessions; } });
            }
            const tr = TKD_DATA.PRICING.TRAINING.find(t => t.id === stu.trainingId);
            if(tr && tr.id !== 't_none') { planNames.push(`[${tr.name}]`); }
            
            const planDisplay = planNames.length > 0 ? planNames.join(' + ') : '未設定';
            const sessionDisplay = totalSessions > 0 ? `${totalSessions} 堂` : 'N/A (無額度)';

            html += `
                <div class="receipt-slip">
                    <div class="receipt-header"><h2>道館繳費收據</h2><p style="font-size:14px; margin:0; color:#555;">列印日期：${todayStr}</p></div>
                    <div class="receipt-body">
                        <div class="receipt-row" style="font-size:20px;"><strong>學員姓名：</strong><span>${stu.name}</span></div>
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
        const recordKeys = Object.keys(this.state.attendance).filter(k => k.startsWith(prefix)).sort();

        recordKeys.forEach(rk => {
            const records = this.state.attendance[rk]; const [dateStr, courseId] = rk.split('_');
            const attendees = []; const leaves = [];
            Object.keys(records).forEach(sid => {
                const stu = this.state.students.find(s => s.id === sid); if(!stu) return;
                if(records[sid].status === 'attend') attendees.push(stu.name);
                if(records[sid].status === 'leave') leaves.push(`${stu.name}(請假)`);
            });
            if(attendees.length > 0 || leaves.length > 0) {
                monthHasData = true; const [yyyy, mm, dd] = dateStr.split('-'); const dObj = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
                const courseInfo = (TKD_DATA.SCHEDULE[dObj.getDay()] || []).find(c => c.id === courseId) || {time:'', name:'未知課程'};
                html += `<div class="summary-item-card"><div class="sc-header"><span class="sc-date">${dateStr}</span><span class="sc-course">${courseInfo.time} ${courseInfo.name}</span></div><div class="sc-attendees">出席：${attendees.length > 0 ? attendees.join(', ') : '無'}</div>${leaves.length > 0 ? `<div class="sc-leaves">未到：${leaves.join(', ')}</div>` : ''}</div>`;
            }
        });
        if (!monthHasData) html = '<div style="text-align:center; padding:40px; color:#9CA3AF; font-weight:bold;">本月尚無排程</div>';
        content.innerHTML = html; document.getElementById('monthSummaryModal').classList.add('open');
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