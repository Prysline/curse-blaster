export const STORAGE_KEY = 'curse-blaster-v2';

function createId(fallback) {
  return crypto.randomUUID ? crypto.randomUUID() : fallback;
}

export function createDefaultState() {
  return {
    theme: 'dark',
    currentTopic: '今天到底在搞什麼',
    phrases: [
      { id: createId('p1'), text: '操你媽', enabled: true },
      { id: createId('p2'), text: '幹', enabled: false },
      { id: createId('p3'), text: '到底是在供三小', enabled: false }
    ],
    dailyStats: {}
  };
}

export function loadState() {
  const defaults = createDefaultState();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    const data = JSON.parse(raw);
    return {
      theme: data.theme === 'light' ? 'light' : 'dark',
      currentTopic:
        typeof data.currentTopic === 'string' && data.currentTopic.trim()
          ? data.currentTopic
          : defaults.currentTopic,
      phrases:
        Array.isArray(data.phrases) && data.phrases.length
          ? data.phrases
          : defaults.phrases,
      dailyStats:
        data.dailyStats && typeof data.dailyStats === 'object'
          ? data.dailyStats
          : {}
    };
  } catch {
    return defaults;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function localDayKey(dateOrTs = Date.now()) {
  const d = new Date(dateOrTs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function incrementCounter(obj, key, amount = 1) {
  obj[key] = (obj[key] || 0) + amount;
}

function ensureDay(state, dayKey) {
  if (!state.dailyStats[dayKey]) {
    state.dailyStats[dayKey] = {
      total: 0,
      hours: {},
      phrases: {},
      topics: {}
    };
  }

  return state.dailyStats[dayKey];
}

export function recordClick(state, topic, phrase, ts = Date.now()) {
  const dayKey = localDayKey(ts);
  const hourKey = String(new Date(ts).getHours()).padStart(2, '0');
  const day = ensureDay(state, dayKey);

  day.total += 1;
  incrementCounter(day.hours, hourKey);
  incrementCounter(day.phrases, phrase);

  if (!day.topics[topic]) {
    day.topics[topic] = {
      total: 0,
      phrases: {}
    };
  }

  day.topics[topic].total += 1;
  incrementCounter(day.topics[topic].phrases, phrase);
}

export function getTodayCount(state) {
  return state.dailyStats[localDayKey()]?.total || 0;
}

export function totalAllTime(state) {
  return Object.values(state.dailyStats)
    .reduce((sum, day) => sum + (day.total || 0), 0);
}
