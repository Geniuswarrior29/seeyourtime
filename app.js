// --- CONFIGURATION ---
// Set your Google Apps Script Web App URL here after deploying
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwX1BTruvfRuDQndCSTkjAF9vatYnBrpqADr6TrJFOkRacuvPvyphlr2ShfhU9VJzoHSQ/exec"; 

// Fallback to localStorage if API URL is not set
const USE_MOCK_DB = !GOOGLE_SHEET_API_URL;

// --- STATE ---
let currentUser = null;
let studySessions = [];
let messages = [];
let chartInstance = null;
const currentDate = new Date(); // Today

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Check login
    const savedUser = localStorage.getItem('studyBattle_user');
    if (savedUser) {
        currentUser = savedUser;
        showScreen('dashboard-screen');
        await loadDashboardData();
    } else {
        showScreen('login-screen');
    }

    setupEventListeners();
    
    // Set dynamic current date text
    updateDateDisplay();
}

function updateDateDisplay() {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-GB', options);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Profile
    document.getElementById('profile-btn').addEventListener('click', () => toggleModal('profile-modal', true));
    document.getElementById('close-profile-modal').addEventListener('click', () => toggleModal('profile-modal', false));
    
    // Add Session Modal
    document.getElementById('add-session-btn').addEventListener('click', openAddSessionModal);
    document.getElementById('close-session-modal').addEventListener('click', () => toggleModal('add-session-modal', false));
    
    // Duration Calculation in form
    document.getElementById('start-time').addEventListener('input', calculateDurationPreview);
    document.getElementById('end-time').addEventListener('input', calculateDurationPreview);
    document.getElementById('manual-hours').addEventListener('input', clearTimeInputs);
    document.getElementById('manual-mins').addEventListener('input', clearTimeInputs);
    
    // Save Session
    document.getElementById('add-session-form').addEventListener('submit', handleSaveSession);
    
    // Delete Session
    document.getElementById('delete-session-btn').addEventListener('click', handleDeleteSession);
    
    // Filters
    document.getElementById('user-filter').addEventListener('change', renderTimeline);
    document.getElementById('history-date').addEventListener('change', loadHistoryDate);
    
    // Chat
    document.getElementById('custom-msg-form').addEventListener('submit', handleSendCustomMessage);
    
    // Populate Quick Messages
    populateQuickMessages();
}

// --- UI HELPERS ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'hidden'));
    document.querySelectorAll('.screen').forEach(s => {
        if(s.id === screenId) {
            s.classList.add('active');
            s.classList.remove('hidden');
        } else {
            s.classList.add('hidden');
        }
    });
}

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (show) {
        modal.classList.add('active');
        modal.classList.remove('hidden');
    } else {
        modal.classList.remove('active');
        modal.classList.add('hidden'); // Delay for animation if needed
    }
}

function showToast(message, emoji = '🔔') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span style="font-size: 1.5rem">${emoji}</span> <div>${message}</div>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function showGlobalLoader(show) {
    const loader = document.getElementById('global-loader');
    if (show) {
        loader.classList.remove('hidden');
        loader.classList.add('active'); // Re-uses modal-overlay styles
    } else {
        loader.classList.add('hidden');
        loader.classList.remove('active');
    }
}

// --- AUTHENTICATION ---
function handleLogin(e) {
    e.preventDefault();
    const name = document.querySelector('input[name="username"]:checked').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    
    const valid = (name === 'Dev' && password === '@Dev29') || (name === 'Arpita' && password === '@Arpita16');
    
    if (valid) {
        errorEl.classList.add('hidden');
        currentUser = name;
        localStorage.setItem('studyBattle_user', name);
        showScreen('dashboard-screen');
        loadDashboardData();
    } else {
        errorEl.classList.remove('hidden');
        // trigger reflow for animation
        errorEl.style.animation = 'none';
        errorEl.offsetHeight; 
        errorEl.style.animation = 'shake 0.5s';
    }
}

function handleLogout() {
    localStorage.removeItem('studyBattle_user');
    currentUser = null;
    toggleModal('profile-modal', false);
    showScreen('login-screen');
    document.getElementById('password').value = '';
}

// --- DASHBOARD DATA LOADING ---
async function loadDashboardData() {
    // Set UI for current user
    document.getElementById('greeting').textContent = `Good Morning, ${currentUser} 👋`;
    document.getElementById('user-avatar').textContent = currentUser.charAt(0);
    
    const root = document.documentElement;
    if (currentUser === 'Dev') {
        root.style.setProperty('--primary', 'var(--accent-dev)');
        root.style.setProperty('--primary-hover', '#2563EB');
    } else {
        root.style.setProperty('--primary', 'var(--accent-arpita)');
        root.style.setProperty('--primary-hover', '#DB2777');
    }
    
    await fetchAllData();
    updateDashboardUI();
    
    // Auto refresh every minute
    setInterval(updateDateAndCheckReset, 60000);
}

function updateDateAndCheckReset() {
    const today = new Date();
    if (today.getDate() !== currentDate.getDate()) {
        // It's a new day! Refresh page or just reload data
        location.reload();
    }
}

// --- DATABASE SIMULATION / API FETCH ---
async function fetchAllData() {
    if (USE_MOCK_DB) {
        studySessions = JSON.parse(localStorage.getItem('studyBattle_sessions') || '[]');
        messages = JSON.parse(localStorage.getItem('studyBattle_messages') || '[]');
    } else {
        // Fetch from API
        try {
            const res = await fetch(`${GOOGLE_SHEET_API_URL}?action=getData&t=${Date.now()}`);
            const data = await res.json();
            
            studySessions = data.sessions || [];
            // Google Sheets returns dates as ISO strings. Normalize to YYYY-MM-DD
            studySessions.forEach(s => {
                if (s.date && s.date.includes('T')) {
                    const d = new Date(s.date);
                    s.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }
                s.duration_minutes = parseInt(s.duration_minutes, 10) || 0;
            });
            
            messages = data.messages || [];
        } catch (e) {
            console.error("API Error", e);
            showToast("Failed to connect to database.", "❌");
        }
    }
}

async function saveSessionToDB(session) {
    // Optimistic UI Update for speed
    const index = studySessions.findIndex(s => s.id === session.id);
    if (index > -1) {
        studySessions[index] = session;
    } else {
        studySessions.push(session);
    }
    updateDashboardUI();

    if (USE_MOCK_DB) {
        localStorage.setItem('studyBattle_sessions', JSON.stringify(studySessions));
    } else {
        showGlobalLoader(true);
        try {
            await fetch(`${GOOGLE_SHEET_API_URL}?action=addSession`, {
                method: 'POST',
                body: JSON.stringify(session)
            });
            await fetchAllData();
        } catch(e) { console.error(e); }
        showGlobalLoader(false);
    }
}

async function deleteSessionFromDB(id) {
    studySessions = studySessions.filter(s => s.id !== id);
    updateDashboardUI();

    if (USE_MOCK_DB) {
        localStorage.setItem('studyBattle_sessions', JSON.stringify(studySessions));
    } else {
        showGlobalLoader(true);
        try {
            await fetch(`${GOOGLE_SHEET_API_URL}?action=deleteSession`, {
                method: 'POST',
                body: JSON.stringify({id})
            });
            await fetchAllData();
        } catch(e) { console.error(e); }
        showGlobalLoader(false);
    }
}

async function saveMessageToDB(msg) {
    messages.push(msg);
    renderChat();

    if (USE_MOCK_DB) {
        localStorage.setItem('studyBattle_messages', JSON.stringify(messages));
    } else {
        showGlobalLoader(true);
        try {
            await fetch(`${GOOGLE_SHEET_API_URL}?action=addMessage`, {
                method: 'POST',
                body: JSON.stringify(msg)
            });
            await fetchAllData();
        } catch(e) { console.error(e); }
        showGlobalLoader(false);
    }
}


// --- CORE LOGIC & CALCULATION ---
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDuration(minutes) {
    if (!minutes || minutes < 0) return "0m";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function getTodaySessions() {
    const today = getTodayString();
    return studySessions.filter(s => s.date === today);
}

function getStatsByDate(dateStr) {
    const sessions = studySessions.filter(s => s.date === dateStr);
    
    let devMins = 0;
    let arpitaMins = 0;
    
    sessions.forEach(s => {
        if (s.user === 'Dev') devMins += s.duration_minutes;
        if (s.user === 'Arpita') arpitaMins += s.duration_minutes;
    });
    
    return { devMins, arpitaMins, sessions };
}

// --- UI UPDATES ---
function updateDashboardUI() {
    const todayStr = getTodayString();
    const { devMins, arpitaMins, sessions } = getStatsByDate(todayStr);
    
    // Update Battle Score
    document.getElementById('dev-today-time').textContent = formatDuration(devMins);
    document.getElementById('arpita-today-time').textContent = formatDuration(arpitaMins);
    
    // Update Lead Indicator
    updateLeadIndicator(devMins, arpitaMins);
    
    // Update Widgets & Notifications
    updateCornerWidget(devMins, arpitaMins);
    updateMotivationalQuote();
    
    // Update Total Stats
    updateGeneralStats(sessions, devMins, arpitaMins);
    
    // Render Timeline
    renderTimeline();
    
    // Render Chart
    renderChart(sessions);
    
    // Render Leaderboard
    renderLeaderboard(devMins, arpitaMins);
    
    // Render Profile
    updateProfileStats(devMins, arpitaMins);
    
    // Render Chat
    renderChat();
    
    // Render Weekly
    renderWeeklyStats();
}

function updateLeadIndicator(devMins, arpitaMins) {
    const heroLead = document.getElementById('hero-lead-indicator');
    heroLead.className = 'lead-indicator';
    
    const diff = Math.abs(devMins - arpitaMins);
    const diffStr = formatDuration(diff);
    
    if (devMins === 0 && arpitaMins === 0) {
        heroLead.innerHTML = `Let the battle begin! ⚔️`;
        heroLead.classList.add('lead-draw');
    } else if (devMins > arpitaMins) {
        heroLead.innerHTML = `🏆 DEV LEADS BY ${diffStr.toUpperCase()} 🔥`;
        heroLead.classList.add('lead-dev');
    } else if (arpitaMins > devMins) {
        heroLead.innerHTML = `🏆 ARPITA LEADS BY ${diffStr.toUpperCase()} 🔥`;
        heroLead.classList.add('lead-arpita');
    } else {
        heroLead.innerHTML = `🤝 IT'S A DRAW!`;
        heroLead.classList.add('lead-draw');
    }
}

function updateCornerWidget(devMins, arpitaMins) {
    const widget = document.getElementById('corner-widget');
    widget.classList.remove('hidden');
    
    const myMins = currentUser === 'Dev' ? devMins : arpitaMins;
    const theirMins = currentUser === 'Dev' ? arpitaMins : devMins;
    
    const diff = Math.abs(myMins - theirMins);
    const diffStr = formatDuration(diff);
    
    if (myMins === 0 && theirMins === 0) {
        widget.classList.add('hidden');
        return;
    }
    
    if (myMins > theirMins) {
        widget.innerHTML = `🏆 <span>You're leading by ${diffStr}!</span>`;
        widget.style.borderColor = 'var(--success)';
        widget.style.color = 'var(--success)';
    } else if (theirMins > myMins) {
        widget.innerHTML = `😈 <span>You're behind by ${diffStr}!</span>`;
        widget.style.borderColor = 'var(--danger)';
        widget.style.color = 'var(--danger)';
    } else {
        widget.innerHTML = `🤝 <span>It's a draw!</span>`;
        widget.style.borderColor = 'var(--text-main)';
        widget.style.color = 'var(--text-main)';
    }
}

function updateMotivationalQuote() {
    const quotes = [
        "Bas ek aur session. Phir break. 😤",
        "Consistency > Motivation.",
        "Aaj ka target complete karo.",
        "Phone side mein rakho. 📵",
        "Future you will thank you.",
        "Competition friendly hai, excuses nahi. 😂",
        "Ek chapter aur. Let's go.",
        "Kal se nahi. Aaj se."
    ];
    const todayStr = getTodayString();
    // Deterministic daily random based on date
    const idx = parseInt(todayStr.replace(/-/g, '')) % quotes.length;
    document.getElementById('motivational-quote').textContent = `"${quotes[idx]}"`;
}

function updateGeneralStats(sessions, devMins, arpitaMins) {
    const myMins = currentUser === 'Dev' ? devMins : arpitaMins;
    document.getElementById('stat-total-time').textContent = formatDuration(myMins);
    
    const mySessions = sessions.filter(s => s.user === currentUser);
    document.getElementById('stat-sessions').textContent = mySessions.length;
    
    const subjects = new Set(mySessions.map(s => s.subject));
    document.getElementById('stat-subjects').textContent = subjects.size;
    
    let leader = "-";
    if (devMins > arpitaMins) leader = "Dev";
    if (arpitaMins > devMins) leader = "Arpita";
    if (devMins > 0 && devMins === arpitaMins) leader = "Draw";
    document.getElementById('stat-leader').textContent = leader;
}

function renderTimeline() {
    const filter = document.getElementById('user-filter').value;
    const container = document.getElementById('timeline-container');
    
    let sessions = getTodaySessions();
    if (filter !== 'all') {
        sessions = sessions.filter(s => s.user === filter);
    }
    
    // Sort chronologically
    sessions.sort((a, b) => {
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return a.start_time.localeCompare(b.start_time);
    });
    
    container.innerHTML = '';
    
    if (sessions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h4>No study sessions yet.</h4>
                <p>Who's going to start the battle? 👀</p>
            </div>
        `;
        return;
    }
    
    sessions.forEach(s => {
        const card = document.createElement('div');
        card.className = `timeline-card ${s.user === 'Dev' ? 'is-dev' : 'is-arpita'}`;
        
        let timeStr = s.start_time && s.end_time ? `${formatTime(s.start_time)} — ${formatTime(s.end_time)}` : 'Manual Entry';
        
        card.innerHTML = `
            <div class="timeline-header">
                <span class="timeline-time">${s.user === currentUser ? '🕒' : (s.user === 'Dev' ? '📘' : '🎀')} ${timeStr}</span>
                <span class="timeline-duration">${formatDuration(s.duration_minutes)}</span>
            </div>
            <div class="timeline-subject">📚 ${s.subject} <span style="font-size: 0.8rem; font-weight: normal; color: #94A3B8; margin-left: auto;">${s.user}</span></div>
            <div class="timeline-topic">${s.topic}</div>
            
            ${s.user === currentUser ? `
                <div class="timeline-actions">
                    <button class="action-btn" onclick="editSession('${s.id}')">Edit</button>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

function formatTime(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${String(hours).padStart(2, '0')}:${m} ${ampm}`;
}

function renderChart(sessions) {
    const ctx = document.getElementById('subjectChart').getContext('2d');
    
    const mySessions = sessions.filter(s => s.user === currentUser);
    
    const subjectMap = {};
    mySessions.forEach(s => {
        subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.duration_minutes;
    });
    
    const labels = Object.keys(subjectMap);
    const data = Object.values(subjectMap).map(m => (m/60).toFixed(2));
    
    // Nice colors
    const colors = [
        'rgba(59, 130, 246, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(239, 68, 68, 0.8)'
    ];
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    if (labels.length === 0) {
        // Empty chart
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['No Data'],
                datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.1)'] }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                cutout: '70%'
            }
        });
        return;
    }
    
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94A3B8', font: { family: "'Outfit', sans-serif" } }
                }
            },
            cutout: '70%'
        }
    });
}

function renderLeaderboard(devMins, arpitaMins) {
    const container = document.getElementById('leaderboard-container');
    container.innerHTML = '';
    
    const devRank = { name: 'Dev', mins: devMins, icon: '👨‍💻' };
    const arpitaRank = { name: 'Arpita', mins: arpitaMins, icon: '👩‍💻' };
    
    let sorted = [devRank, arpitaRank];
    if (arpitaMins > devMins) {
        sorted = [arpitaRank, devRank];
    }
    
    sorted.forEach((p, idx) => {
        const div = document.createElement('div');
        div.className = `leaderboard-rank ${idx === 0 && p.mins > 0 ? 'winner' : ''}`;
        
        const rankIcon = idx === 0 && p.mins > 0 ? '🥇' : (p.mins > 0 ? '🥈' : '➖');
        
        div.innerHTML = `
            <div class="rank-info">
                <span class="rank-icon">${rankIcon}</span>
                <span>${p.name}</span>
            </div>
            <div class="rank-time" style="color: ${p.name === 'Dev' ? 'var(--accent-dev)' : 'var(--accent-arpita)'}">
                ${formatDuration(p.mins)}
            </div>
        `;
        container.appendChild(div);
    });
    
    const diff = Math.abs(devMins - arpitaMins);
    if (diff > 0) {
        const diffEl = document.createElement('div');
        diffEl.className = 'leaderboard-diff';
        diffEl.textContent = `Difference: ${formatDuration(diff)}`;
        container.appendChild(diffEl);
    }
}

function updateProfileStats(devMins, arpitaMins) {
    const myMins = currentUser === 'Dev' ? devMins : arpitaMins;
    
    document.getElementById('profile-big-avatar').textContent = currentUser.charAt(0);
    document.getElementById('profile-name').textContent = currentUser;
    document.getElementById('profile-today').textContent = formatDuration(myMins);
    
    const mySessions = studySessions.filter(s => s.user === currentUser);
    document.getElementById('profile-sessions').textContent = mySessions.length;
    
    // calc weekly (simplified to all time for now if not strictly weekly mapped, but let's do it)
    let totalMins = 0;
    mySessions.forEach(s => totalMins += s.duration_minutes);
    document.getElementById('profile-week').textContent = formatDuration(totalMins);
}


// --- ADD/EDIT SESSION ---
function openAddSessionModal() {
    document.getElementById('add-session-form').reset();
    document.getElementById('edit-session-id').value = '';
    document.getElementById('calculated-duration').innerHTML = `Total Study Duration: <strong>--</strong>`;
    document.getElementById('delete-session-btn').classList.add('hidden');
    
    // Auto set end time to now, start time to 1 hr ago
    const now = new Date();
    const then = new Date(now.getTime() - 60*60*1000);
    
    document.getElementById('end-time').value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    document.getElementById('start-time').value = `${String(then.getHours()).padStart(2,'0')}:${String(then.getMinutes()).padStart(2,'0')}`;
    
    calculateDurationPreview();
    toggleModal('add-session-modal', true);
}

window.editSession = function(id) {
    const session = studySessions.find(s => s.id === id);
    if (!session || session.user !== currentUser) return;
    
    document.getElementById('add-session-form').reset();
    document.getElementById('edit-session-id').value = session.id;
    
    if (session.start_time && session.end_time) {
        document.getElementById('start-time').value = session.start_time;
        document.getElementById('end-time').value = session.end_time;
        calculateDurationPreview();
    } else {
        const h = Math.floor(session.duration_minutes / 60);
        const m = session.duration_minutes % 60;
        document.getElementById('manual-hours').value = h || '';
        document.getElementById('manual-mins').value = m || '';
        document.getElementById('calculated-duration').innerHTML = `Total Study Duration: <strong>${formatDuration(session.duration_minutes)}</strong>`;
    }
    
    document.getElementById('subject').value = session.subject;
    document.getElementById('topic').value = session.topic;
    
    document.getElementById('delete-session-btn').classList.remove('hidden');
    
    toggleModal('add-session-modal', true);
}

function calculateDurationPreview() {
    const st = document.getElementById('start-time').value;
    const et = document.getElementById('end-time').value;
    
    if (st && et) {
        const sTime = new Date(`2000-01-01T${st}:00`);
        const eTime = new Date(`2000-01-01T${et}:00`);
        let diff = (eTime - sTime) / 60000;
        
        if (diff < 0) {
            // crossed midnight
            diff += 24 * 60;
        }
        
        document.getElementById('calculated-duration').innerHTML = `Total Study Duration: <strong>${formatDuration(diff)}</strong>`;
        
        // Clear manual inputs
        document.getElementById('manual-hours').value = '';
        document.getElementById('manual-mins').value = '';
    }
}

function clearTimeInputs() {
    document.getElementById('start-time').value = '';
    document.getElementById('end-time').value = '';
    
    const h = parseInt(document.getElementById('manual-hours').value) || 0;
    const m = parseInt(document.getElementById('manual-mins').value) || 0;
    const total = (h * 60) + m;
    
    document.getElementById('calculated-duration').innerHTML = `Total Study Duration: <strong>${formatDuration(total)}</strong>`;
}

async function handleSaveSession(e) {
    e.preventDefault();
    
    const id = document.getElementById('edit-session-id').value || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const st = document.getElementById('start-time').value;
    const et = document.getElementById('end-time').value;
    const mh = parseInt(document.getElementById('manual-hours').value) || 0;
    const mm = parseInt(document.getElementById('manual-mins').value) || 0;
    const subject = document.getElementById('subject').value;
    const topic = document.getElementById('topic').value;
    
    let duration = 0;
    
    if (st && et) {
        const sTime = new Date(`2000-01-01T${st}:00`);
        const eTime = new Date(`2000-01-01T${et}:00`);
        duration = (eTime - sTime) / 60000;
        if (duration < 0) duration += 24 * 60;
    } else {
        duration = (mh * 60) + mm;
    }
    
    if (duration <= 0) {
        alert("Duration must be greater than 0!");
        return;
    }
    
    const oldSession = studySessions.find(s => s.id === id);
    // Keep original date if editing, otherwise today
    const date = oldSession ? oldSession.date : getTodayString();
    
    const sessionData = {
        id,
        user: currentUser,
        date: date,
        start_time: st,
        end_time: et,
        duration_minutes: duration,
        subject,
        topic,
        created_at: new Date().toISOString()
    };
    
    await saveSessionToDB(sessionData);
    
    toggleModal('add-session-modal', false);
    
    // Nice personalized toast
    if (!oldSession) {
        if (duration > 120) {
            showToast(`${currentUser} is cooking today 🔥`, '🍳');
        } else {
            showToast(`Session saved! Keep going. 🚀`, '✅');
        }
    } else {
        showToast(`Session updated.`, '✏️');
    }
    
    updateDashboardUI();
}

async function handleDeleteSession() {
    const id = document.getElementById('edit-session-id').value;
    if (!id) return;
    
    if (confirm("Delete this study session?")) {
        await deleteSessionFromDB(id);
        toggleModal('add-session-modal', false);
        showToast("Session deleted.", "🗑️");
        updateDashboardUI();
    }
}


// --- HISTORY & WEEKLY ---
function loadHistoryDate() {
    const dateVal = document.getElementById('history-date').value;
    const resultsDiv = document.getElementById('history-results');
    const container = document.getElementById('history-timeline');
    
    if (!dateVal) {
        resultsDiv.classList.add('hidden');
        return;
    }
    
    resultsDiv.classList.remove('hidden');
    const { devMins, arpitaMins, sessions } = getStatsByDate(dateVal);
    
    document.getElementById('hist-dev-time').textContent = formatDuration(devMins);
    document.getElementById('hist-arpita-time').textContent = formatDuration(arpitaMins);
    
    container.innerHTML = '';
    
    if (sessions.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted)">No sessions recorded for this date.</div>`;
        return;
    }
    
    sessions.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    
    sessions.forEach(s => {
        const card = document.createElement('div');
        card.className = `timeline-card ${s.user === 'Dev' ? 'is-dev' : 'is-arpita'}`;
        card.style.marginBottom = '10px';
        card.style.padding = '10px';
        
        let timeStr = s.start_time && s.end_time ? `${formatTime(s.start_time)} - ${formatTime(s.end_time)}` : '';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                <strong>${s.user}</strong>
                <span style="color: var(--primary)">${formatDuration(s.duration_minutes)}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted)">
                ${timeStr} | ${s.subject} - ${s.topic}
            </div>
        `;
        container.appendChild(card);
    });
}

function renderWeeklyStats() {
    // Generate last 7 days including today
    const list = document.getElementById('weekly-list');
    list.innerHTML = '';
    
    let totalDev = 0;
    let totalArpita = 0;
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        const { devMins, arpitaMins } = getStatsByDate(dateStr);
        totalDev += devMins;
        totalArpita += arpitaMins;
        
        const dayName = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
        
        const row = document.createElement('div');
        row.className = 'weekly-day';
        row.innerHTML = `
            <span class="day-name">${dayName}</span>
            <div class="day-scores">
                <span class="dev-time">${formatDuration(devMins)}</span>
                <span class="arpita-time">${formatDuration(arpitaMins)}</span>
            </div>
        `;
        list.appendChild(row);
    }
    
    document.getElementById('week-dev').textContent = formatDuration(totalDev);
    document.getElementById('week-arpita').textContent = formatDuration(totalArpita);
    
    const winEl = document.getElementById('week-winner');
    if (totalDev > totalArpita) {
        winEl.textContent = `🏆 Dev is winning the week!`;
        winEl.style.color = 'var(--accent-dev)';
    } else if (totalArpita > totalDev) {
        winEl.textContent = `🏆 Arpita is winning the week!`;
        winEl.style.color = 'var(--accent-arpita)';
    } else {
        winEl.textContent = `🤝 It's a draw this week!`;
        winEl.style.color = 'var(--text-main)';
    }
}


// --- CHAT SYSTEM ---
function populateQuickMessages() {
    const predefined = [
        "Main aage hu betaaaa 😂🏆",
        "Padhlo thoda sa yaar, kitte piche ho 😭",
        "HATTTTTTTT 😭😂",
        "Bahut busy the yaarrrr 🥲",
        "Bas bas, itna bhi mat padho 😭",
        "Aaj toh tumhari lag gayi 😂",
        "Come on, catch me if you can 😎🔥",
        "Abhi game baaki hai mere dost 😈",
        "Chalo chalo, books kholo 📚😂",
        "Aaj ka winner kaun? 👀"
    ];
    
    const container = document.getElementById('quick-messages');
    container.innerHTML = '';
    
    predefined.forEach(text => {
        const btn = document.createElement('button');
        btn.className = 'quick-msg-btn';
        btn.textContent = text;
        btn.onclick = () => sendChatMessage(text);
        container.appendChild(btn);
    });
}

async function handleSendCustomMessage(e) {
    e.preventDefault();
    const input = document.getElementById('custom-msg-input');
    const text = input.value.trim();
    if (text) {
        await sendChatMessage(text);
        input.value = '';
    }
}

async function sendChatMessage(text) {
    const receiver = currentUser === 'Dev' ? 'Arpita' : 'Dev';
    
    const msg = {
        id: `msg_${Date.now()}`,
        sender: currentUser,
        receiver: receiver,
        text: text,
        timestamp: new Date().toISOString()
    };
    
    await saveMessageToDB(msg);
    renderChat();
    
    // Simulate notification for receiver (if we had real time)
    // For now we just show it in our UI
}

function renderChat() {
    const history = document.getElementById('chat-history');
    history.innerHTML = '';
    
    // Show only today's messages for clean UI, or last 20
    const today = getTodayString();
    const recentMsgs = messages.slice(-30);
    
    if (recentMsgs.length === 0) {
        history.innerHTML = `<div style="text-align:center; color: var(--text-muted); margin-top: auto; margin-bottom: auto;">No messages yet. Send a taunt! 😈</div>`;
        return;
    }
    
    recentMsgs.forEach(m => {
        const isMine = m.sender === currentUser;
        
        const d = new Date(m.timestamp);
        const timeStr = `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2,'0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
        
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isMine ? 'mine' : 'theirs'}`;
        
        bubble.innerHTML = `
            <div class="chat-meta">
                <span>${m.sender}</span>
                <span>${timeStr}</span>
            </div>
            <div class="chat-text">${m.text}</div>
        `;
        history.appendChild(bubble);
    });
    
    // Scroll to bottom
    history.scrollTop = history.scrollHeight;
}
