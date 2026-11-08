const STORAGE_KEY = 'sport-habits-v1';

const HABITS = {
  morning: { name: 'Утренняя зарядка (10 минут)', desc: 'Лёгкая зарядка после пробуждения.' },
  steps: { name: '10 000 шагов', desc: 'Прогуляйся или побегай, набери 10 000 шагов за день.' },
  plank: { name: 'Планка (сегодня)', desc: 'Стой в планке максимально долго, фиксируй время.' },
  water: { name: 'Вода 1,5–2 литра', desc: 'Пей воду в течение дня, норма 1,5–2 литра.' },
  sleep: { name: 'Сон 8 часов', desc: 'Спи 8 часов, ложись и вставай в одно время.' },
  workout: { name: 'Тренировка / спортивная секция', desc: 'Посети тренировку или занимайся спортом.' },
};

const state = { habits: {} };
let monthlyChartInstance = null;

// Локальная дата в формате YYYY-MM-DD без toISOString (чтобы не сдвигать день по часовому поясу)
function getTodayKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function initHabits() {
  const habits = {};
  Object.keys(HABITS).forEach(key => {
    habits[key] = { logs: {} };
  });
  return habits;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.habits = initHabits();
      hideCorruptError();
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.habits || typeof parsed.habits !== 'object') {
      throw new Error('Неверная структура данных');
    }
    const habits = {};
    Object.keys(HABITS).forEach(key => {
      const saved = parsed.habits[key] || {};
      const logs = saved.logs && typeof saved.logs === 'object' ? saved.logs : {};
      habits[key] = { logs };
    });
    state.habits = habits;
    saveData();
    hideCorruptError();
  } catch (e) {
    state.habits = initHabits();
    showCorruptError();
  }
}

function saveData() {
  const payload = { habits: {} };
  Object.keys(state.habits).forEach(key => {
    payload.habits[key] = { logs: state.habits[key].logs };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function toggleToday(habitKey) {
  const today = getTodayKey();
  const habit = state.habits[habitKey];
  const currentlyDone = habit.logs[today] === true;

  // Если снимаем отметку сегодня — спрашиваем подтверждение, так как серия сбросится в 0
  if (currentlyDone) {
    if (!confirm('Снять отметку за сегодня? Серия сбросится в 0.')) {
      return;
    }
  }

  habit.logs[today] = !currentlyDone;
  saveData();
  render();
}

function resetHabit(habitKey) {
  if (!confirm('Сбросить прогресс по привычке «' + HABITS[habitKey].name + '»?')) {
    return;
  }
  state.habits[habitKey].logs = {};
  saveData();
  render();
}

// Серия считается от сегодня назад: сегодня true → 1, растёт пока предыдущие дни тоже true;
// если сегодня false или отметки нет — серия 0.
function calculateStreak(habitKey) {
  const logs = state.habits[habitKey].logs;
  const today = getTodayKey();
  if (logs[today] !== true) {
    return 0;
  }
  let streak = 0;
  let date = new Date();
  while (true) {
    const key = getDateKey(date);
    if (logs[key] === true) {
      streak++;
      date.setDate(date.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function renderWeekStrip(habitKey) {
  const logs = state.habits[habitKey].logs;
  const container = document.getElementById('week-' + habitKey);
  if (!container) return;
  container.textContent = '';
  const today = new Date();
  // 7 дней: от сегодня и 6 предыдущих
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = getDateKey(d);
    const square = document.createElement('span');
    square.className = 'day-square ' + (logs[key] === true ? 'done' : 'empty');
    square.setAttribute('aria-label', key + ': ' + (logs[key] === true ? 'выполнено' : 'не выполнено/нет данных'));
    container.appendChild(square);
  }
}

function render() {
  const today = getTodayKey();
  let doneToday = 0;
  let bestStreak = 0;
  Object.keys(HABITS).forEach(key => {
    if (state.habits[key].logs[today] === true) {
      doneToday++;
    }
    const s = calculateStreak(key);
    if (s > bestStreak) {
      bestStreak = s;
    }
  });

  const doneEl = document.getElementById('done-today');
  const totalEl = document.getElementById('total-habits');
  const bestEl = document.getElementById('best-streak');
  const fillEl = document.getElementById('progress-fill');
  if (doneEl) doneEl.textContent = doneToday;
  if (totalEl) totalEl.textContent = Object.keys(HABITS).length;
  if (bestEl) bestEl.textContent = bestStreak;
  if (fillEl) {
    const total = Object.keys(HABITS).length;
    // const pct = total > 0 ? Math.round((doneToday / total) * 100) : 0;
    const pct = total > 0 ? Math.round((doneToday / total) * 100) : 0;
    fillEl.style.width = pct + '%';
  }

  const list = document.getElementById('habits-list');
  if (!list) return;
  list.textContent = '';

  Object.keys(HABITS).forEach(key => {
    const h = HABITS[key];
    const habit = state.habits[key];
    const done = habit.logs[today] === true;

    const card = document.createElement('article');
    card.className = 'habit-card ' + (done ? 'card-done' : '');

    const name = document.createElement('h3');
    name.className = 'habit-name';
    name.textContent = h.name;
    card.appendChild(name);

    const desc = document.createElement('p');
    desc.className = 'habit-desc';
    desc.textContent = h.desc;
    card.appendChild(desc);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toggle-btn ' + (done ? 'active' : '');
    btn.textContent = done ? 'Сегодня: выполнено' : 'Сегодня: не выполнено';
    btn.setAttribute('aria-pressed', done ? 'true' : 'false');
    btn.addEventListener('click', () => toggleToday(key));
    card.appendChild(btn);

    const streak = document.createElement('div');
    streak.className = 'streak';
    streak.textContent = 'Серия: ' + calculateStreak(key) + ' дн.';
    card.appendChild(streak);

    const week = document.createElement('div');
    week.className = 'week';
    const weekLabel = document.createElement('span');
    weekLabel.className = 'week-label';
    weekLabel.textContent = 'Последние 7 дней';
    week.appendChild(weekLabel);
    const strip = document.createElement('div');
    strip.className = 'strip';
    strip.id = 'week-' + key;
    week.appendChild(strip);
    card.appendChild(week);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'reset-btn';
    reset.textContent = 'Сбросить прогресс';
    reset.addEventListener('click', () => resetHabit(key));
    card.appendChild(reset);

    list.appendChild(card);
    renderWeekStrip(key);
  });

  const empty = document.getElementById('empty-state');
  const hasAnyLog = Object.keys(HABITS).some(key => {
    return Object.keys(state.habits[key].logs).length > 0;
  });
  if (empty) {
    empty.hidden = hasAnyLog;
  }

  renderMonthlyChart();
}

function renderMonthlyChart() {
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  const labels = [];
  const data = [];
  const today = new Date();

  // Собираем данные за последние 7 дней
  for (let i = 7; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = getDateKey(d);

    // Формат даты для графика (например, "05.11")
    const dayStr = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
    labels.push(dayStr);

    // Считаем, сколько привычек выполнено в этот день
    let doneCount = 0;
    Object.keys(state.habits).forEach(habitKey => {
      if (state.habits[habitKey].logs[key] === true) {
        doneCount++;
      }
    });
    data.push(doneCount);
  }

  monthlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Выполнено привычек',
        data: data,
        backgroundColor: '#5E7892',
        borderRadius: 4,
        maxBarThickness: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 6,
          ticks: { stepSize: 1, color: '#4A5A6A' },
          grid: { color: '#E2DDD1' }
        },
        x: {
          ticks: { color: '#4A5A6A', maxRotation: 45, minRotation: 45 },
          grid: { display: false }
        }
      }
    }
  });
}

function showCorruptError() {
  const box = document.getElementById('corrupt-box');
  if (box) box.style.display = 'block';
  const list = document.getElementById('habits-list');
  if (list) list.style.display = 'none';
}

function hideCorruptError() {
  const box = document.getElementById('corrupt-box');
  if (box) box.style.display = 'none';
  const list = document.getElementById('habits-list');
  if (list) list.style.display = '';
}

function resetAllData() {
  if (!confirm('Сбросить все данные трекера? Это нельзя отменить.')) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  state.habits = initHabits();
  hideCorruptError();
  render();
}

window.addEventListener('DOMContentLoaded', () => {
  const firstRun = !localStorage.getItem(STORAGE_KEY);
  const hintShown = localStorage.getItem('hint-shown') === '1';

  loadData();
  render();

  const hint = document.getElementById('first-hint');
  if (hint && firstRun && !hintShown) {
    hint.hidden = false;
  }
  const hintClose = document.getElementById('hint-close');
  if (hintClose) {
    hintClose.addEventListener('click', () => {
      hint.hidden = true;
      localStorage.setItem('hint-shown', '1');
    });
  }
  const btn = document.getElementById('reset-all-btn');
  if (btn) {
    btn.addEventListener('click', resetAllData);
  }
});
