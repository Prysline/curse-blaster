import { localDayKey, totalAllTime } from './storage.js';

function startOfRange(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

export function getFilteredDayEntries(state, range) {
  const entries = Object.entries(state.dailyStats)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (range === 'all') return entries;

  const cutoff = localDayKey(startOfRange(Number(range)));
  return entries.filter(([dayKey]) => dayKey >= cutoff);
}

function incrementCounter(obj, key, amount = 1) {
  obj[key] = (obj[key] || 0) + amount;
}

export function aggregate(entries) {
  const result = {
    total: 0,
    hours: Array(24).fill(0),
    phrases: {},
    topics: {}
  };

  for (const [, day] of entries) {
    result.total += day.total || 0;

    for (const [hour, count] of Object.entries(day.hours || {})) {
      const idx = Number(hour);
      if (Number.isInteger(idx) && idx >= 0 && idx < 24) {
        result.hours[idx] += count || 0;
      }
    }

    for (const [phrase, count] of Object.entries(day.phrases || {})) {
      incrementCounter(result.phrases, phrase, count || 0);
    }

    for (const [topic, topicData] of Object.entries(day.topics || {})) {
      incrementCounter(result.topics, topic, topicData.total || 0);
    }
  }

  return result;
}

export function sortedCounter(obj) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
}

export function topName(items) {
  return items.length ? items[0][0] : '—';
}

export function renderStatsView({ state, range, elements }) {
  const entries = getFilteredDayEntries(state, range);
  const agg = aggregate(entries);
  const phraseItems = sortedCounter(agg.phrases);
  const topicItems = sortedCounter(agg.topics);

  elements.statTotal.textContent = totalAllTime(state);
  elements.statToday.textContent = state.dailyStats[localDayKey()]?.total || 0;
  elements.statTopPhrase.textContent = topName(phraseItems);
  elements.statTopTopic.textContent = topName(topicItems);
  elements.chartLabel.textContent = range === 'all' ? 'LATEST 60 DAYS' : `LAST ${range} DAYS`;

  renderTrend(entries, range, elements.trendChart);
  renderHours(agg.hours, elements.hoursGrid);
  renderBars(elements.phraseBars, phraseItems);
  renderBars(elements.topicBars, topicItems);
  renderReports(entries, elements.recentList);
}

export function renderBars(root, items) {
  root.innerHTML = '';

  if (!items.length) {
    root.innerHTML = '<div class="empty">這段期間還沒有資料。</div>';
    return;
  }

  const max = items[0][1] || 1;

  items.slice(0, 10).forEach(([name, count]) => {
    const row = document.createElement('div');
    row.className = 'bar-row';

    const n = document.createElement('div');
    n.className = 'bar-name';
    n.textContent = name;

    const c = document.createElement('div');
    c.className = 'bar-count';
    c.textContent = count;

    const track = document.createElement('div');
    track.className = 'bar-track';

    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = `${Math.max(2, count / max * 100)}%`;

    track.appendChild(fill);
    row.append(n, c, track);
    root.appendChild(row);
  });
}

export function renderHours(hours, root) {
  root.innerHTML = '';
  const max = Math.max(1, ...hours);

  hours.forEach((count, h) => {
    const cell = document.createElement('div');
    cell.className = 'hour';

    const alpha = .10 + (count / max) * .72;
    cell.style.background = `color-mix(in srgb,var(--accent) ${Math.round(alpha * 100)}%,var(--surface-2))`;
    cell.style.color = count / max > .5 ? 'white' : 'var(--muted)';
    cell.title = `${String(h).padStart(2, '0')}:00－${String((h + 1) % 24).padStart(2, '0')}:00：${count} 下`;
    cell.textContent = h;

    root.appendChild(cell);
  });
}

export function renderTrend(entries, range, canvas) {
  const cssW = Math.max(280, canvas.clientWidth || 600);
  const cssH = 240;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const style = getComputedStyle(document.documentElement);
  const muted = style.getPropertyValue('--muted').trim();
  const line = style.getPropertyValue('--line').trim();
  const accent = style.getPropertyValue('--accent').trim();

  ctx.clearRect(0, 0, cssW, cssH);

  const days = range === 'all' ? 60 : Number(range);
  const byDay = new Map(entries.map(([key, day]) => [key, day.total || 0]));
  const labels = [];
  const values = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);

    const key = localDayKey(d);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    values.push(byDay.get(key) || 0);
  }

  const pad = { l: 38, r: 14, t: 18, b: 34 };
  const w = cssW - pad.l - pad.r;
  const h = cssH - pad.t - pad.b;
  const max = Math.max(1, ...values);

  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.fillStyle = muted;
  ctx.font = '11px system-ui';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 4; i++) {
    const y = pad.t + h * (i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(cssW - pad.r, y);
    ctx.stroke();
    ctx.fillText(Math.round(max * (1 - i / 4)), pad.l - 8, y + 4);
  }

  const xAt = i => labels.length === 1 ? pad.l + w / 2 : pad.l + w * (i / (labels.length - 1));
  const yAt = v => pad.t + h - (v / max) * h;

  if (values.length) {
    ctx.beginPath();

    values.forEach((v, i) => {
      const x = xAt(i);
      const y = yAt(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = accent;
    values.forEach((v, i) => {
      if (labels.length <= 14 || i % Math.ceil(labels.length / 12) === 0 || i === labels.length - 1) {
        ctx.beginPath();
        ctx.arc(xAt(i), yAt(v), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  ctx.fillStyle = muted;
  ctx.textAlign = 'center';

  const every = Math.max(1, Math.ceil(labels.length / 6));
  labels.forEach((lab, i) => {
    if (i % every === 0 || i === labels.length - 1) {
      ctx.fillText(lab, xAt(i), cssH - 10);
    }
  });
}

export function renderReports(entries, root) {
  root.innerHTML = '';

  if (!entries.length) {
    root.innerHTML = '<div class="empty">還沒有紀錄。去點幾下。</div>';
    return;
  }

  const latest = [...entries]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14);

  latest.forEach(([dayKey, day]) => {
    const topicEntries = Object.entries(day.topics || {})
      .sort((a, b) => (b[1].total || 0) - (a[1].total || 0));

    if (!topicEntries.length) {
      const row = document.createElement('div');
      row.className = 'recent-row';

      const left = document.createElement('div');
      const title = document.createElement('b');
      title.textContent = dayKey;

      const small = document.createElement('small');
      small.textContent = `${day.total || 0} 下`;

      left.append(title, small);
      row.append(left);
      root.appendChild(row);
      return;
    }

    topicEntries.forEach(([topic, topicData], index) => {
      const row = document.createElement('div');
      row.className = 'recent-row';
      const left = document.createElement('div');

      const title = document.createElement('b');
      title.textContent = topic;

      const topPhrases = Object.entries(topicData.phrases || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([phrase, count]) => `${phrase} ×${count}`)
        .join(' ・ ');

      const small = document.createElement('small');
      small.textContent = topPhrases || '—';

      left.append(title, small);

      const right = document.createElement('small');
      right.textContent = `${index === 0 ? `${dayKey} ・ ` : ''}${topicData.total || 0} 下`;

      row.append(left, right);
      root.appendChild(row);
    });
  });
}
