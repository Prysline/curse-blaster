import {
  loadState,
  saveState,
  recordClick,
  getTodayCount,
  localDayKey
} from './storage.js';
import {
  getFilteredDayEntries,
  renderStatsView,
  renderTrend
} from './stats.js';

let state = loadState();
let sessionCount = 0;
let statRange = '7';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const statsElements = {
  statTotal: $('#statTotal'),
  statToday: $('#statToday'),
  statTopPhrase: $('#statTopPhrase'),
  statTopTopic: $('#statTopTopic'),
  chartLabel: $('#chartLabel'),
  trendChart: $('#trendChart'),
  hoursGrid: $('#hoursGrid'),
  phraseBars: $('#phraseBars'),
  topicBars: $('#topicBars'),
  recentList: $('#recentList')
};

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $('#themeBtn').textContent = state.theme === 'dark' ? '☀' : '☾';

  const meta = $('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', state.theme === 'dark' ? '#11100f' : '#f5f1ea');
  }
}

function activePhrases() {
  return state.phrases.filter(p => p.enabled && p.text.trim());
}

function renderHome() {
  $('#topicDisplay').textContent = state.currentTopic;
  $('#topicInput').value = state.currentTopic;
  $('#sessionCount').textContent = sessionCount;
  $('#activePhraseCount').textContent = activePhrases().length;
  $('#todayCount').textContent = getTodayCount(state);
}

function renderPhrases() {
  const root = $('#phraseList');
  root.innerHTML = '';

  if (!state.phrases.length) {
    root.innerHTML = '<div class="empty">還沒有咒罵字眼。先加一句。</div>';
    return;
  }

  state.phrases.forEach(p => {
    const row = document.createElement('div');
    row.className = 'phrase-row';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'check';
    check.checked = !!p.enabled;
    check.setAttribute('aria-label', `啟用 ${p.text}`);
    check.addEventListener('change', () => {
      p.enabled = check.checked;
      saveState(state);
      renderHome();
    });

    const text = document.createElement('div');
    text.className = 'phrase-text';
    text.textContent = p.text;

    const del = document.createElement('button');
    del.className = 'delete';
    del.textContent = '✕';
    del.title = '刪除';
    del.addEventListener('click', () => {
      state.phrases = state.phrases.filter(x => x.id !== p.id);
      saveState(state);
      renderPhrases();
      renderHome();
    });

    row.append(check, text, del);
    root.appendChild(row);
  });
}

function renderStats() {
  renderStatsView({ state, range: statRange, elements: statsElements });
}

function setTopic() {
  const value = $('#topicInput').value.trim() || '未命名對象';
  state.currentTopic = value;
  saveState(state);
  renderHome();
}

function addPhrase() {
  const input = $('#phraseInput');
  const text = input.value.trim();

  if (!text) return;

  if (state.phrases.some(p => p.text === text)) {
    input.select();
    return;
  }

  state.phrases.push({ id: createId(), text, enabled: true });
  input.value = '';

  saveState(state);
  renderPhrases();
  renderHome();
  input.focus();
}

function showBurst(text, e) {
  const area = $('#blaster');
  const rect = area.getBoundingClientRect();

  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    x = rect.width / 2;
    y = rect.height / 2;
  }

  x = Math.max(70, Math.min(rect.width - 70, x));
  y = Math.max(70, Math.min(rect.height - 70, y));

  const el = document.createElement('div');
  el.className = 'burst';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.fontSize = `clamp(34px, ${Math.min(11, 5 + text.length * .55)}vw, 82px)`;
  el.style.setProperty('--rot', `${(Math.random() * 12 - 6).toFixed(1)}deg`);

  area.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function blast(e) {
  const phrases = activePhrases();

  if (!phrases.length) {
    go('phrases');
    requestAnimationFrame(() => $('#phraseInput').focus());
    return;
  }

  const picked = phrases[Math.floor(Math.random() * phrases.length)];
  const topic = state.currentTopic || '未命名對象';

  recordClick(state, topic, picked.text);
  saveState(state);

  sessionCount += 1;
  renderHome();
  showBurst(picked.text, e);
}

function exportStats() {
  const blob = new Blob([
    JSON.stringify({
      exportedAt: new Date().toISOString(),
      currentTopic: state.currentTopic,
      phrases: state.phrases,
      dailyStats: state.dailyStats
    }, null, 2)
  ], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `curse-blaster-${localDayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportPhraseLibrary() {
  const blob = new Blob([
    JSON.stringify({
      format: 'curse-blaster-phrases-v1',
      exportedAt: new Date().toISOString(),
      phrases: state.phrases.map(({ text, enabled }) => ({ text, enabled }))
    }, null, 2)
  ], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `curse-blaster-phrases-${localDayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function normalizeImportedPhrases(data) {
  if (!data || !Array.isArray(data.phrases)) {
    throw new Error('檔案中找不到 phrases 陣列。');
  }

  const seen = new Set();
  const result = [];

  for (const item of data.phrases) {
    const text = typeof item === 'string'
      ? item.trim()
      : typeof item?.text === 'string'
        ? item.text.trim()
        : '';

    if (!text || seen.has(text)) continue;

    seen.add(text);
    result.push({
      id: createId(),
      text,
      enabled: typeof item === 'object' && item !== null
        ? item.enabled !== false
        : true
    });
  }

  if (!result.length) {
    throw new Error('檔案中沒有可匯入的咒罵字眼。');
  }

  return result;
}

async function importPhraseLibrary(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const imported = normalizeImportedPhrases(data);
  const overwrite = $('#overwriteImport').checked;

  if (overwrite) {
    const ok = confirm(`將以匯入檔的 ${imported.length} 個字眼完全覆蓋目前咒罵庫。確定繼續？`);
    if (!ok) return;
    state.phrases = imported;
  } else {
    const existing = new Set(state.phrases.map(p => p.text));
    const additions = imported.filter(p => !existing.has(p.text));
    state.phrases.push(...additions);
  }

  saveState(state);
  renderPhrases();
  renderHome();
}

function go(page) {
  $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
  $$('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === page));

  if (page === 'stats') requestAnimationFrame(renderStats);
  if (page === 'phrases') renderPhrases();

  window.scrollTo({ top: 0, behavior: 'instant' });
}

$('#themeBtn').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveState(state);
  applyTheme();
  renderStats();
});

$('#saveTopicBtn').addEventListener('click', setTopic);
$('#topicInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    setTopic();
  }
});

$('#blaster').addEventListener('pointerdown', blast);
$('#addPhraseBtn').addEventListener('click', addPhrase);
$('#phraseInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addPhrase();
  }
});

$('#toggleAllBtn').addEventListener('click', () => {
  const shouldEnable = state.phrases.some(p => !p.enabled);
  state.phrases.forEach(p => p.enabled = shouldEnable);
  saveState(state);
  renderPhrases();
  renderHome();
});

$('#rangeTabs').addEventListener('click', e => {
  const btn = e.target.closest('[data-range]');
  if (!btn) return;

  statRange = btn.dataset.range;
  $$('.range-btn').forEach(b => b.classList.toggle('active', b === btn));
  renderStats();
});

$('#clearStatsBtn').addEventListener('click', () => {
  if (!Object.keys(state.dailyStats).length) return;

  const ok = confirm('確定要刪除全部點擊統計嗎？這個動作無法復原。');
  if (!ok) return;

  state.dailyStats = {};
  sessionCount = 0;
  saveState(state);
  renderHome();
  renderStats();
});

$('#exportBtn').addEventListener('click', exportStats);
$('#exportPhrasesBtn').addEventListener('click', exportPhraseLibrary);
$('#importPhrasesBtn').addEventListener('click', () => $('#phraseFileInput').click());
$('#phraseFileInput').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    await importPhraseLibrary(file);
  } catch (error) {
    alert(`匯入失敗：${error.message}`);
  } finally {
    e.target.value = '';
  }
});

$$('.nav button').forEach(btn => {
  btn.addEventListener('click', () => go(btn.dataset.nav));
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if ($('.page[data-page="stats"]').classList.contains('active')) {
      renderTrend(getFilteredDayEntries(state, statRange), statRange, statsElements.trendChart);
    }
  }, 120);
});

applyTheme();
renderHome();
renderPhrases();
renderStats();
