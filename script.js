const CIRCUMFERENCE = 2 * Math.PI * 96;

const durations = { pomodoro: 25, short: 5, long: 15 };
const modeLabels = {
  pomodoro: 'Focus Time',
  short: 'Short Break',
  long: 'Long Break'
};
const modeColors = {
  pomodoro: '#7c3aed',
  short: '#10b981',
  long: '#3b82f6'
};

let currentMode = 'pomodoro';
let timeLeft = durations.pomodoro * 60;
let totalTime = durations.pomodoro * 60;
let isRunning = false;
let interval = null;
let pomCount = 0;
let totalFocusSecs = 0;
let activeTaskId = null;

let tasks = JSON.parse(localStorage.getItem('pom-tasks') || '[]');
let filter = 'all';

function saveTasks() {
  localStorage.setItem('pom-tasks', JSON.stringify(tasks));
}

// ===== TIMER =====
function switchMode(mode) {
  if (isRunning) stopTimer();
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-${mode}`).classList.add('active');
  timeLeft = durations[mode] * 60;
  totalTime = timeLeft;
  updateDisplay();
  updateRing();
  document.getElementById('timerMode').textContent = modeLabels[mode];
}

function toggleTimer() {
  isRunning ? stopTimer() : startTimer();
}

function startTimer() {
  isRunning = true;
  const btn = document.getElementById('startBtn');
  btn.textContent = 'Pause';
  btn.classList.add('running');
  interval = setInterval(() => {
    timeLeft--;
    if (currentMode === 'pomodoro') totalFocusSecs++;
    updateDisplay();
    updateRing();
    updateFocusStats();
    if (timeLeft <= 0) sessionComplete();
  }, 1000);
}

function stopTimer() {
  isRunning = false;
  clearInterval(interval);
  const btn = document.getElementById('startBtn');
  btn.textContent = 'Start';
  btn.classList.remove('running');
}

function resetTimer() {
  stopTimer();
  timeLeft = durations[currentMode] * 60;
  totalTime = timeLeft;
  updateDisplay();
  updateRing();
}

function skipSession() {
  stopTimer();
  sessionComplete();
}

function sessionComplete() {
  stopTimer();
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const taskName = activeTaskId
    ? tasks.find(t => t.id === activeTaskId)?.title || 'Unknown task'
    : 'No task';

  if (currentMode === 'pomodoro') {
    pomCount++;
    if (activeTaskId) {
      const task = tasks.find(t => t.id === activeTaskId);
      if (task) { task.poms = (task.poms || 0) + 1; saveTasks(); renderTasks(); }
    }
    addLog(`🍅 Pomodoro #${pomCount} — ${taskName}`, time, 'pomodoro');
    switchMode(pomCount % 4 === 0 ? 'long' : 'short');
  } else {
    addLog(`☕ ${modeLabels[currentMode]} done`, time, 'break');
    switchMode('pomodoro');
  }

  updateFocusStats();
  playBeep();
}

function addLog(text, time, cls) {
  const ul = document.getElementById('sessionLog');
  ul.querySelectorAll('.log-empty').forEach(e => e.remove());
  const li = document.createElement('li');
  li.className = `log-item ${cls}`;
  li.innerHTML = `<span>${text}</span><span class="log-time">${time}</span>`;
  ul.insertBefore(li, ul.firstChild);
}

function updateDisplay() {
  const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const s = String(timeLeft % 60).padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;
  document.title = `${m}:${s} — Pomodoro`;
}

function updateRing() {
  const progress = timeLeft / totalTime;
  const offset = CIRCUMFERENCE * (1 - progress);
  const ring = document.getElementById('ringProgress');
  ring.style.strokeDashoffset = offset;
  ring.style.strokeDasharray = CIRCUMFERENCE;
  ring.style.stroke = modeColors[currentMode];
}

function updateFocusStats() {
  document.getElementById('pomCount').textContent = pomCount;
  document.getElementById('focusTime').textContent =
    `${Math.floor(totalFocusSecs / 60)}m`;
  document.getElementById('tasksCompleted').textContent =
    tasks.filter(t => t.completed).length;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch(e) {}
}

// ===== TASKS =====
function addTask() {
  const title = document.getElementById('taskInput').value.trim();
  const priority = document.getElementById('taskPriority').value;
  if (!title) return;
  tasks.unshift({ id: Date.now(), title, priority, completed: false, poms: 0 });
  document.getElementById('taskInput').value = '';
  saveTasks();
  renderTasks();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    if (task.completed && activeTaskId === id) setActiveTask(null);
    saveTasks();
    renderTasks();
    updateFocusStats();
  }
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  if (activeTaskId === id) setActiveTask(null);
  saveTasks();
  renderTasks();
  updateFocusStats();
}

function setActiveTask(id) {
  activeTaskId = id;
  const task = tasks.find(t => t.id === id);
  document.getElementById('currentTaskName').textContent =
    task ? task.title : 'No task selected';
  renderTasks();
}

function setFilter(f, btn) {
  filter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('tasksList');
  let filtered = tasks;
  if (filter === 'active') filtered = tasks.filter(t => !t.completed);
  if (filter === 'completed') filtered = tasks.filter(t => t.completed);

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-tasks">No tasks here — add one above! ✨</div>';
  } else {
    list.innerHTML = filtered.map(t => `
      <div class="task-item ${t.completed ? 'completed' : ''} ${t.priority}
                             ${t.id === activeTaskId ? 'active-task' : ''}">
        <div class="task-check ${t.completed ? 'checked' : ''}"
             onclick="toggleTask(${t.id})">
          ${t.completed ? '✓' : ''}
        </div>
        <div class="task-info">
          <div class="task-title">${t.title}</div>
          <div class="task-poms">🍅 ${t.poms || 0} pomodoro${t.poms !== 1 ? 's' : ''}</div>
        </div>
        <div class="task-actions">
          ${!t.completed ? `
            <button class="btn-focus ${t.id === activeTaskId ? 'focused' : ''}"
                    onclick="setActiveTask(${t.id === activeTaskId ? null : t.id})">
              ${t.id === activeTaskId ? '✓ Focusing' : '▶ Focus'}
            </button>` : ''}
          <button class="btn-del" onclick="deleteTask(${t.id})">✕</button>
        </div>
      </div>`).join('');
  }

  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  document.getElementById('progressText').textContent = `${done} / ${total} tasks completed`;
  document.getElementById('progressPct').textContent = `${pct}%`;
  document.getElementById('progressBar').style.width = `${pct}%`;
}

window.onload = () => {
  updateDisplay();
  updateRing();
  renderTasks();
  updateFocusStats();
};