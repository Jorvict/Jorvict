const fs = require('fs');

const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab.com';
const TOKEN = process.env.GITLAB_TOKEN;

async function fetchAllEvents() {
  let page = 1;
  let events = [];
  while (page <= 20) {
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
  return iso.slice(0, 10);
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

  const firstDate = dates.length ? dates[0] : null;
  return { totalContributions, totalActiveDays, longest, current, firstDate };
}

function formatDateEs(iso) {
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const d = new Date(iso);
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function renderSVG(stats) {
  const startLabel = stats.firstDate ? formatDateEs(stats.firstDate) : '—';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="180" viewBox="0 0 880 180">
  <defs>
    <style>
      .bg { fill:#16171f; }
      .border { fill:none; stroke:#3a3d52; stroke-width:1.5; }
      .header { fill:#ff6b35; font: 700 20px 'Segoe UI', sans-serif; }
      .num { fill:#ffffff; font: 700 46px 'Segoe UI', sans-serif; }
      .num-sm { fill:#ffffff; font: 700 30px 'Segoe UI', sans-serif; }
      .label { fill:#bf8fff; font: 700 15px 'Segoe UI', sans-serif; }
      .sub { fill:#9a9cb0; font: 400 12px 'Segoe UI', sans-serif; }
      .streak-num { fill:#4dd8ff; font: 700 30px 'Segoe UI', sans-serif; }
      .divider { stroke:#3a3d52; stroke-width:1; }
    </style>
  </defs>

  <rect class="bg" width="880" height="180" rx="14"/>

  <text x="24" y="34" class="header">🦊 GitLab Stats</text>
  <line x1="0" y1="48" x2="880" y2="48" class="divider"/>

  <rect class="border" x="16" y="64" width="848" height="102" rx="12"/>

  <text x="150" y="112" class="num" text-anchor="middle">${stats.totalContributions}</text>
  <text x="150" y="138" class="label" text-anchor="middle">Contribuciones Totales</text>
  <text x="150" y="156" class="sub" text-anchor="middle">${startLabel} - Presente</text>

  <line x1="317" y1="80" x2="317" y2="150" class="divider"/>

  <circle cx="440" cy="106" r="34" fill="none" stroke="#bf8fff" stroke-width="4"/>
  <text x="440" y="98" text-anchor="middle" font-size="18">🔥</text>
  <text x="440" y="122" class="streak-num" text-anchor="middle">${stats.current}</text>
  <text x="440" y="145" class="label" text-anchor="middle">Racha Actual</text>

  <line x1="563" y1="80" x2="563" y2="150" class="divider"/>

  <text x="700" y="112" class="num" text-anchor="middle">${stats.longest}</text>
  <text x="700" y="138" class="label" text-anchor="middle">Racha Más Larga</text>
  <text x="700" y="156" class="sub" text-anchor="middle">Máximo consecutivo</text>
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
