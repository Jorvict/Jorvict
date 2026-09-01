const fs = require('fs');

const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab.com';
const TOKEN = process.env.GITLAB_TOKEN;

async function fetchAllEvents() {
  let page = 1;
  let events = [];
  while (page <= 20) { // tope de seguridad: ~2000 eventos
    const res = await fetch(`${GITLAB_URL}/api/v4/events?per_page=100&page=${page}`, {
      headers: { 'PRIVATE-TOKEN': TOKEN }
    });
    if (!res.ok) {
      throw new Error(`GitLab API error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    if (data.length === 0) break;
    events = events.concat(data);
    page++;
  }
  return events;
}

function toDateStr(iso) {
  return iso.slice(0, 10); // YYYY-MM-DD en UTC
}

function computeStats(events) {
  const dateSet = new Set(events.map(e => toDateStr(e.created_at)));
  const totalContributions = events.length;
  const totalActiveDays = dateSet.size;

  const dates = Array.from(dateSet).sort();
  let longest = 0, run = 0, prev = null;
  for (const d of dates) {
    if (prev) {
      const diff = (new Date(d) - new Date(prev)) / 86400000;
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let current = 0;
  let cursor = dateSet.has(today) ? today : (dateSet.has(yesterday) ? yesterday : null);
  if (cursor) {
    let d = new Date(cursor);
    while (dateSet.has(d.toISOString().slice(0, 10))) {
      current++;
      d = new Date(d.getTime() - 86400000);
    }
  }

  return { totalContributions, totalActiveDays, longest, current };
}

function renderSVG(stats) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="150" viewBox="0 0 495 150">
  <style>
    .bg { fill:#0d1117; }
    .title { fill:#fc6d26; font: 600 16px 'Segoe UI', sans-serif; }
    .num { fill:#ffffff; font: 700 28px 'Segoe UI', sans-serif; }
    .label { fill:#8b949e; font: 400 12px 'Segoe UI', sans-serif; }
  </style>
  <rect class="bg" width="495" height="150" rx="10"/>
  <text x="20" y="30" class="title">GitLab Stats</text>
  <text x="65" y="80" class="num" text-anchor="middle">${stats.totalContributions}</text>
  <text x="65" y="100" class="label" text-anchor="middle">Total</text>
  <text x="190" y="80" class="num" text-anchor="middle">${stats.current}</text>
  <text x="190" y="100" class="label" text-anchor="middle">Current Streak</text>
  <text x="330" y="80" class="num" text-anchor="middle">${stats.longest}</text>
  <text x="330" y="100" class="label" text-anchor="middle">Longest Streak</text>
  <text x="455" y="80" class="num" text-anchor="middle">${stats.totalActiveDays}</text>
  <text x="455" y="100" class="label" text-anchor="middle">Active Days</text>
</svg>`;
}

(async () => {
  const events = await fetchAllEvents();
  const stats = computeStats(events);
  const svg = renderSVG(stats);
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/gitlab-stats.svg', svg);
  console.log('Stats:', stats);
})();
