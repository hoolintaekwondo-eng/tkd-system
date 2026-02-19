/**
 * MODEL: Logic_Layer
 * VERSION: V.4.2.0
 * DESCRIPTION: SaaS Dialog Engine, Delete/Reset Action Group Fix
 */

const app = {
    state: {
        currentDate: new Date(),
        students: [],
        attendance: {},
        selectedStudentIds: new Set(),
        pendingDates: {}, 
        pendingLeaves: {},
        isEditMode: false,
        actionMarks: {}, // { stuId: 'delete' | 'reset' }
        editingNoteStuId: null,
        tempSelectingDate: null,
        isCalendarCollapsed: false
    },

    ui: {
        alert: function(msg, type='info', title='系統提示') {
            return new Promise(resolve => this.showDialog(msg, type, title, false, resolve));
        },
        confirm: function(msg, type='warning', title='請確認') {
            return new Promise(resolve => this.showDialog(msg, type, title, true, resolve));
        },
        showDialog: function(msg, type, title, showCancel, resolve) {
            const overlay = document.getElementById('sysDialog');
            const icon = document.getElementById('sysDialogIcon');
            const titleEl = document.getElementById('sysDialogTitle');
            const msgEl = document.getElementById('sysDialogMsg');
            const btnCancel = document.getElementById('sysDialogCancel');
            const btnConfirm = document.getElementById('sysDialogConfirm');

            titleEl.innerText = title; msgEl.innerText = msg;
            
            if(type === 'warning') {
                icon.innerHTML = '<i class="ph-fill ph-warning"></i>'; icon.className = 'sys-dialog-icon warning';
                btnConfirm.className = 'btn-dialog-primary'; btnConfirm.style.background = 'var(--warning)';
            } else if(type === 'danger') {
                icon.innerHTML = '<i class="ph-fill ph-warning-circle"></i>'; icon.className = 'sys-dialog-icon danger';
                btnConfirm.className = 'btn-dialog-danger'; btnConfirm.style.background = 'var(--danger)';
            } else if(type === 'success') {
                icon.innerHTML = '<i class="ph-fill ph-check-circle"></i>'; icon.className = 'sys-dialog-icon'; icon.style.color = 'var(--success)';
                btnConfirm.className = 'btn-dialog-primary'; btnConfirm.style.background = 'var(--success)';
            } else {
                icon.innerHTML = '<i class="ph-fill ph-info"></i>'; icon.className = 'sys-dialog-icon'; icon.style.color = 'var(--primary)';
                btnConfirm.className = 'btn-dialog-primary'; btnConfirm.style.background = 'var(--primary)';
            }

            btnCancel.style.display = showCancel ? 'block' : 'none';
            btnConfirm.onclick = () => { overlay.classList.remove('open'); resolve(true); };
            btnCancel.onclick = () => { overlay.classList.remove('open'); resolve(false); };
            overlay.classList.add('open');
        }
    },

    init: function() {
        TKD_DATA.init(); this.loadData(); this.renderCalendar(); this.renderStudentList();
        this.populateDatalist(); this.initResizers(); this.renderPlanCards('add'); this.renderPlanCards('batch');
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
            const firstPlan = (existing.activePlans && existing.activePlans.length > 0) ? existing.activePlans[0] : 'p_single';
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
        const summary = document.getElementById('batchPriceSummary'); if(summary) summary.innerText = `預估單人收費：$${(mPrice + tPrice).toLocaleString()}`;
    },

    handleStudentSubmit: async function(e) {
        e.preventDefault(); const name = document.getElementById('addNameInput').value.trim(); if(!name) return;
        const mainId = document.getElementById('mainPlan_add').value;
        if(!mainId) { const proceed = await this.ui.confirm('未選擇主方案，將視為無額度。確定儲存嗎？', 'warning'); if(!proceed) return; }

        const trainId = document.getElementById('trainingPlan_add').value || 't_none';
        const mainPlan = TKD_DATA.PRICING.MAIN.find(p => p.id === mainId) || { sessions: 0 };
        const existing = this.state.students.find(s => s.name === name);

        if(existing) { 
            const override = await this.ui.confirm(`此姓名已存在。\n確定覆蓋更新 [${name}] 的方案與聯絡資料嗎？`, 'warning', '覆蓋確認');
            if(override) {
                existing.phone = document.getElementById('addPhoneInput').value; existing.emergency = document.getElementById('addEmergencyInput').value;
                existing.activePlans = mainId ? [mainId] : ['p_single']; existing.trainingId = trainId;
                existing.balance = mainPlan.sessions > 1 ? mainPlan.sessions : 0; existing.accumulated = 0; 
                await this.ui.alert(`✅ 已更新會員 [${name}]`, 'success');
            } else return;
        } else {
            const newStudent = { id: 'stu_' + Date.now(), name: name, phone: document.getElementById('addPhoneInput').value, emergency: document.getElementById('addEmergencyInput').value, activePlans: mainId ? [mainId] : ['p_single'], trainingId: trainId, balance: mainPlan.sessions > 1 ? mainPlan.sessions : 0, accumulated: 0, globalNote: '', active: true };
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
        if (this.state.selectedStudentIds.size === 0) { await this.ui.alert('💡 請先在下方勾選學員'); return; }
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
    },
    closeCourseModal: function() { document.getElementById('courseModal').classList.remove('open'); this.state.tempSelectingDate = null; },

    toggleEditMode: function() {
        this.state.isEditMode = !this.state.isEditMode;
        const btnMain = document.getElementById('editBtnMain'); const btnDel = document.getElementById('btnMarkDelete'); const btnRes = document.getElementById('btnMarkReset');
        if(this.state.isEditMode) {
            btnMain.style.display = 'none'; btnDel.style.display = 'flex'; btnRes.style.display = 'flex';
            this.ui.alert('🛠️ 請勾選學員，點擊「刪除」或「重置」來設定標記。\n完成後按最左側 [確定] 執行。', 'info', '編輯模式');
        } else {
            btnMain.style.display = 'flex'; btnDel.style.display = 'none'; btnRes.style.display = 'none'; this.state.actionMarks = {}; 
        }
        this.renderStudentList();
    },

    markAction: async function(type) {
        if(this.state.selectedStudentIds.size === 0) { await this.ui.alert('請先勾選要處理的學員', 'warning'); return; }
        const label = type === 'delete' ? '刪除' : '重置';
        const msg = type === 'delete' ? `將 ${this.state.selectedStudentIds.size} 人標記為「刪除」。\n(按確定後無法復原)` : `將 ${this.state.selectedStudentIds.size} 人標記為「重置」。\n(清空方案與點數，保留姓名電話)`;
        const proceed = await this.ui.confirm(msg, type === 'delete'?'danger':'warning', `標記${label}`);
        if(!proceed) return;

        this.state.selectedStudentIds.forEach(id => { this.state.actionMarks[id] = type; });
        this.state.selectedStudentIds.clear(); this.renderStudentList();
    },

    renderStudentList: function() {
        const container = document.getElementById('studentList'); container.innerHTML = '';
        const query = document.getElementById('searchInput').value.toLowerCase(); let sortedStudents = [...this.state.students];
        if (query) sortedStudents.sort((a,b) => a.name.toLowerCase().includes(query) ? -1 : 1);

        const nameTitle = document.getElementById('nameColTitle');
        if (nameTitle) nameTitle.innerHTML = `姓名 <span style="font-size:0.75rem; color:var(--primary);">(${sortedStudents.length}人)</span>`;

        const year = this.state.currentDate.getFullYear(); const month = this.state.currentDate.getMonth();
        const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;

        sortedStudents.forEach(stu => {
            if (query && !stu.name.toLowerCase().includes(query)) return;
            if (this.state.pendingLeaves[stu.id] !== undefined && !this.state.isEditMode) this.state.selectedStudentIds.add(stu.id);

            const isChecked = this.state.selectedStudentIds.has(stu.id);
            const markType = this.state.actionMarks[stu.id]; 
            
            let planHtml = ''; let isMonthly = false;
            if(stu.activePlans && Array.isArray(stu.activePlans)) {
                stu.activePlans.forEach(pid => {
                    const pd = TKD_DATA.PRICING.MAIN.find(p => p.id === pid);
                    if(pd) { planHtml += `<div class="plan-tag">${pd.name}</div>`; if(pd.sessions === 1) isMonthly = true; }
                });
            } else { planHtml = `<div class="plan-tag">單堂(無額度)</div>`; }

            const training = TKD_DATA.PRICING.TRAINING.find(t => t.id === stu.trainingId) || TKD_DATA.PRICING.TRAINING[0];
            if(training.id !== 't_none') planHtml += `<div class="training-tag">${training.name}</div>`;

            let balanceHtml = isMonthly ? `<span class="val-monthly">${stu.accumulated}次</span>` : `<span class="${stu.balance<=2?'val-low':'val-session'}">${stu.balance}堂</span>`;

            let scheduledDays = [];
            Object.keys(this.state.attendance).forEach(k => {
                if(k.startsWith(monthPrefix) && this.state.attendance[k][stu.id] && this.state.attendance[k][stu.id].status !== 'none') {
                    scheduledDays.push(parseInt(k.split('_')[0].split('-')[2], 10));
                }
            });
            if(isChecked) {
                Object.keys(this.state.pendingDates).forEach(dKey => {
                    if(dKey.startsWith(monthPrefix)) scheduledDays.push(parseInt(dKey.split('-')[2], 10));
                });
            }
            scheduledDays = [...new Set(scheduledDays)].sort((a,b) => a-b);
            const courseStr = scheduledDays.length > 0 ? `<span style="color:var(--success); font-weight:bold;">✅ ${scheduledDays.join('、')}</span>` : '-';

            const nameHtml = stu.phone ? `<span class="has-phone" onclick="app.openContactModal('${stu.id}')">${stu.name}</span>` : `<span>${stu.name}</span>`;
            const noteClass = stu.globalNote ? 'has-note' : '';
            const currentLeave = this.state.pendingLeaves[stu.id] || 0;
            let leaveOptions = '';
            for(let i=0; i<=8; i++) leaveOptions += `<option value="${i}" ${currentLeave == i ? 'selected' : ''}>${i==0 ? '無' : i+'天'}</option>`;

            let rowClass = `student-row ${isChecked ? 'selected-row' : ''} ${currentLeave > 0 ? 'leave-mode' : ''}`;
            if(markType === 'delete') rowClass += ' delete-mode';
            if(markType === 'reset') rowClass += ' reset-mode';

            const checkStyle = markType === 'delete' ? 'danger-check' : (markType === 'reset' ? 'warning-check' : '');
            const checkIcon = markType === 'delete' ? '<i class="ph-bold ph-trash"></i>' : (markType === 'reset' ? '<i class="ph-bold ph-arrows-clockwise"></i>' : '<i class="ph-bold ph-check"></i>');

            const row = document.createElement('div'); row.className = rowClass;
            row.innerHTML = `
                <div class="col-check"><div class="custom-check ${isChecked||markType ? 'checked '+checkStyle : ''}" onclick="app.toggleStudentSelect('${stu.id}')">${isChecked||markType ? checkIcon : ''}</div></div>
                <div class="col-name">${nameHtml}</div>
                <div class="col-course">${courseStr}</div>
                <div class="col-bal">${balanceHtml}</div>
                <div class="col-plan">${planHtml}</div>
                <div class="col-leave"><select onchange="app.handleLeaveChange('${stu.id}', this.value)" ${markType?'disabled':''}>${leaveOptions}</select></div>
                <div class="col-note"><button class="note-btn ${noteClass}" onclick="app.openNoteModal('${stu.id}')"><i class="ph-fill ph-chat-text"></i></button></div>
            `;
            container.appendChild(row);
        });
    },

    toggleStudentSelect: function(stuId) {
        if(this.state.actionMarks[stuId]) { delete this.state.actionMarks[stuId]; } 
        else {
            if (this.state.selectedStudentIds.has(stuId)) { this.state.selectedStudentIds.delete(stuId); delete this.state.pendingLeaves[stuId]; } 
            else { this.state.selectedStudentIds.add(stuId); }
        }
        this.renderStudentList();
    },
    handleLeaveChange: function(stuId, days) {
        if(this.state.isEditMode) return;
        const val = parseInt(days);
        if (val > 0) { this.state.pendingLeaves[stuId] = val; this.state.selectedStudentIds.add(stuId); } else { delete this.state.pendingLeaves[stuId]; }
        this.renderStudentList();
    },

    commitBatch: async function() {
        // 1. 處理編輯狀態機
        const markedIds = Object.keys(this.state.actionMarks);
        if (markedIds.length > 0) {
            const proceed = await this.ui.confirm(`⚠️ 確定執行這 ${markedIds.length} 筆學員的變更嗎？`, 'danger');
            if(!proceed) return;
            
            markedIds.forEach(id => {
                const act = this.state.actionMarks[id];
                if(act === 'delete') {
                    this.state.students = this.state.students.filter(s => s.id !== id);
                } else if (act === 'reset') {
                    const stu = this.state.students.find(s => s.id === id);
                    if(stu) {
                        stu.activePlans = ['p_single']; 
                        stu.trainingId = 't_none';
                        stu.balance = 0;
                        stu.accumulated = 0;
                    }
                }
            });
            this.state.actionMarks = {}; this.saveData(); this.toggleEditMode(); this.populateDatalist();
            await this.ui.alert('✅ 操作已成功寫入', 'success'); return;
        }

        // 2. 常規排課寫入
        if (this.state.selectedStudentIds.size === 0) { await this.ui.alert('💡 請先勾選學員，或排定課程'); return; }
        const dateKeys = Object.keys(this.state.pendingDates);
        const hasLeaves = Object.keys(this.state.pendingLeaves).length > 0;
        
        if (dateKeys.length === 0 && !hasLeaves) { await this.ui.alert('請先點選日期排課，或設定請假天數。', 'warning'); return; }
        
        let msg = `確認執行以下操作？\n`;
        if (dateKeys.length > 0) msg += `▶ 排入 ${dateKeys.length} 天課程 (將扣除堂數)\n`;
        if (hasLeaves) msg += `▶ 寫入請假紀錄 (保留回補)\n`;
        const proceed = await this.ui.confirm(msg, 'info', '寫入確認');
        if(!proceed) return;

        this.state.selectedStudentIds.forEach(stuId => {
            const student = this.state.students.find(s => s.id === stuId);
            let isMonthly = true;
            if(student.activePlans && student.activePlans.length>0) {
                const firstP = TKD_DATA.PRICING.MAIN.find(p => p.id === student.activePlans[0]);
                if(firstP && firstP.sessions > 1) isMonthly = false;
            }
            const leaveDays = this.state.pendingLeaves[stuId] || 0;

            dateKeys.forEach(dKey => {
                const cId = this.state.pendingDates[dKey]; const recordKey = `${dKey}_${cId}`;
                if (!this.state.attendance[recordKey]) this.state.attendance[recordKey] = {};
                const existingStatus = this.state.attendance[recordKey][stuId]?.status;
                
                if (leaveDays > 0) {
                    if (existingStatus === 'attend') { if (!isMonthly) student.balance++; else student.accumulated--; }
                    this.state.attendance[recordKey][stuId] = { status: 'leave', note: student.globalNote || '', leaveDays: leaveDays };
                } else if (existingStatus !== 'attend') {
                    this.state.attendance[recordKey][stuId] = { status: 'attend', note: student.globalNote || '', leaveDays: 0 };
                    if (!isMonthly) student.balance = Math.max(0, student.balance - 1); else student.accumulated++;
                }
            });
        });

        this.saveData(); this.state.selectedStudentIds.clear(); this.state.pendingDates = {}; this.state.pendingLeaves = {};
        this.renderCalendar(); this.renderStudentList(); await this.ui.alert('✅ 排程與請假已寫入', 'success');
    },

    discardBatch: async function() {
        if (Object.keys(this.state.actionMarks).length > 0) { this.state.actionMarks = {}; this.renderStudentList(); return; }
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
        
        if(!mainId && updateMode === 'overwrite') { const proceed1 = await this.ui.confirm('未選方案且使用「覆蓋」，將清空學員舊方案。確定嗎？', 'danger'); if(!proceed1) return; }

        const proceed2 = await this.ui.confirm(`確定為 ${this.state.selectedStudentIds.size} 人更新方案嗎？\n模式：[${updateMode === 'stack' ? '疊加保留舊堂數' : '覆蓋重置新堂數'}]`, 'warning');
        if(!proceed2) return;

        this.state.selectedStudentIds.forEach(stuId => {
            const student = this.state.students.find(s => s.id === stuId);
            if(!student.activePlans) student.activePlans = [];
            if (updateMode === 'overwrite') {
                student.activePlans = mainId ? [mainId] : ['p_single'];
                student.balance = (mainPlan && mainPlan.sessions > 1) ? mainPlan.sessions : 0;
                student.accumulated = 0;
            } else if (updateMode === 'stack') {
                if(mainId && !student.activePlans.includes(mainId)) student.activePlans.push(mainId);
                if(mainPlan && mainPlan.sessions > 1) student.balance += mainPlan.sessions;
            }
            if(trainId !== 't_none') student.trainingId = trainId;
        });
        this.saveData(); this.closeModal('batchPlanModal'); this.renderStudentList(); await this.ui.alert('✅ 方案更新成功！', 'success');
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
    openModal: function(mode) { if(mode === 'add') { document.getElementById('addNameInput').value = ''; document.getElementById('addPhoneInput').value = ''; document.getElementById('addEmergencyInput').value = ''; document.querySelectorAll('#planGrid_add .plan-card').forEach(c => c.classList.remove('active')); document.getElementById('mainPlan_add').value = ''; this.toggleTrainingUI('add', false); document.getElementById('toggleTraining_add').checked = false; } document.getElementById('studentModal').classList.add('open'); },
    closeModal: function(mId) { document.getElementById(mId).classList.remove('open'); }
};
document.addEventListener('DOMContentLoaded', () => { app.init(); });
