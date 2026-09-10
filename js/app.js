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
let chaosMode = false;

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
  $('#blasterTopicDisplay').textContent = state.currentTopic;
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

function pickPhrase() {
  const phrases = activePhrases();
  if (!phrases.length) return null;
  return phrases[Math.floor(Math.random() * phrases.length)];
}

function getBurstMetrics(text, area) {
  const length = [...text].length;
  const rect = area.getBoundingClientRect();
  const longSide = Math.max(rect.width, rect.height);
  const availableWidth = Math.max(160, Math.min(rect.width * 0.86, 460));

  let ratio;
  let min;
  let max;

  if (length <= 3) {
    ratio = 0.18;
    min = 64;
    max = 86;
  } else if (length <= 5) {
    ratio = 0.15;
    min = 56;
    max = 76;
  } else if (length <= 8) {
    ratio = 0.135;
    min = 50;
    max = 70;
  } else if (length <= 12) {
    ratio = 0.115;
    min = 44;
    max = 62;
  } else {
    ratio = 0.10;
    min = 38;
    max = 54;
  }

  const fontSize = Math.max(min, Math.min(max, longSide * ratio));

  return {
    fontSize: Math.round(fontSize),
    maxWidth: Math.round(availableWidth)
  };
}

function getBurstLayout(text, metrics) {
  const length = [...text].length;
  const roll = Math.random();

  // 15%: keep the whole phrase on one line when it can stay legible.
  if (roll < 0.15) {
    const estimatedWidth = metrics.fontSize * Math.max(length * 0.96, 1);
    const fitScale = Math.min(1, metrics.maxWidth / estimatedWidth);

    if (fitScale >= 0.55) {
      return {
        mode: 'nowrap',
        fontSize: Math.round(metrics.fontSize * fitScale),
        width: null
      };
    }
  }

  // Another 15% for 1–3 characters: true upright vertical writing.
  if (length <= 3 && roll < 0.30) {
    return {
      mode: 'vertical',
      fontSize: metrics.fontSize,
      width: Math.round(metrics.fontSize * 1.18)
    };
  }

  // Otherwise choose one of three widths and let the browser wrap naturally.
  const widthRatios = [0.36, 0.52, 0.72];
  const ratio = widthRatios[Math.floor(Math.random() * widthRatios.length)];
  const targetChars = Math.max(1, length * ratio);
  const width = Math.min(
    metrics.maxWidth,
    Math.max(metrics.fontSize * 1.05, metrics.fontSize * targetChars)
  );

  return {
    mode: 'wrap',
    fontSize: metrics.fontSize,
    width: Math.round(width)
  };
}

function showBurst(text, x, y, area = $('#blaster')) {
  const metrics = getBurstMetrics(text, area);
  const layout = getBurstLayout(text, metrics);
  const el = document.createElement('div');
  el.className = 'burst';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.fontSize = `${layout.fontSize}px`;
  el.style.setProperty('--rot', `${(Math.random() * 12 - 6).toFixed(1)}deg`);

  if (layout.mode === 'vertical') {
    el.style.width = `${layout.width}px`;
    el.style.maxWidth = `${layout.width}px`;
    el.style.writingMode = 'vertical-rl';
    el.style.textOrientation = 'upright';
    el.style.whiteSpace = 'nowrap';
    el.style.letterSpacing = '.08em';
    el.style.lineHeight = '1';
  } else if (layout.mode === 'nowrap') {
    el.style.maxWidth = 'none';
    el.style.whiteSpace = 'nowrap';
  } else {
    el.style.width = `${layout.width}px`;
    el.style.maxWidth = `${layout.width}px`;
    el.style.whiteSpace = 'normal';
    el.style.wordBreak = 'break-all';
    el.style.overflowWrap = 'anywhere';
    el.style.textAlign = 'center';
  }

  area.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function fireCurseAt(x, y, area = $('#blaster')) {
  const picked = pickPhrase();

  if (!picked) {
    go('phrases');
    requestAnimationFrame(() => $('#phraseInput').focus());
    return;
  }

  const topic = state.currentTopic || '未命名對象';
  recordClick(state, topic, picked.text);
  saveState(state);

  sessionCount += 1;
  renderHome();
  showBurst(picked.text, x, y, area);
}

function blast(e) {
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
  fireCurseAt(x, y, area);
}

function renderChaosMode() {
  const btn = $('#chaosToggle');
  const capture = $('#chaosCaptureLayer');
  const blastPageActive = $('.page[data-page="blast"]').classList.contains('active');
  const active = chaosMode && blastPageActive;

  btn.classList.toggle('is-on', chaosMode);
  capture.classList.toggle('is-on', active);
  document.body.classList.toggle('chaos-active', active);
  btn.setAttribute('aria-pressed', chaosMode ? 'true' : 'false');
  $('#chaosState').textContent = chaosMode ? 'ON' : 'OFF';
}

function handleChaosPointer(e) {
  if (!chaosMode) return;
  fireCurseAt(e.clientX, e.clientY, $('#pageBurstLayer'));
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

  renderChaosMode();
  window.scrollTo(0, 0);
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
$('#chaosToggle').addEventListener('click', () => {
  chaosMode = !chaosMode;
  renderChaosMode();
});
$('#chaosCaptureLayer').addEventListener('pointerdown', handleChaosPointer);

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
renderChaosMode();
