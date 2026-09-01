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

function isWeekend(dateStr) {
  const day = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return day === 0 || day === 6; // domingo o sábado
}

function computeStats(events) {
  const dateSet = new Set(events.map(e => toDateStr(e.created_at)));
  const totalContributions = events.length;
  const totalActiveDays = dateSet.size;

  const sortedDates = Array.from(dateSet).sort();
  const firstDate = sortedDates.length ? sortedDates[0] : null;

  // Racha más larga: solo cuenta días hábiles (lun-vie), los fines de semana no rompen la racha
  let longest = 0, run = 0;
  if (firstDate) {
    let cursor = new Date(firstDate + 'T00:00:00Z');
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    while (cursor <= end) {
      const dStr = cursor.toISOString().slice(0, 10);
      if (!isWeekend(dStr)) {
        if (dateSet.has(dStr)) {
          run++;
          longest = Math.max(longest, run);
        } else {
          run = 0;
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  // Racha actual: camina hacia atrás desde hoy, saltando fines de semana
  let current = 0;
  {
    let cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    while (true) {
      const dStr = cursor.toISOString().slice(0, 10);
      if (isWeekend(dStr)) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        continue;
      }
      if (dateSet.has(dStr)) {
        current++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else {
        break;
      }
    }
  }

  return { totalContributions, totalActiveDays, longest, current, firstDate };
}

function formatDateEs(iso) {
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const d = new Date(iso);
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function renderSVG(stats) {
  const startLabel = stats.firstDate ? formatDateEs(stats.firstDate) : '—';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="195" viewBox="0 0 880 195">
  <defs>
    <style>
      .bg { fill:#16171f; }
      .border { fill:none; stroke:#3a3d52; stroke-width:1.5; }
      .header { fill:#ff6b35; font: 700 20px 'Segoe UI', sans-serif; }
      .num { fill:#ffffff; font: 700 46px 'Segoe UI', sans-serif; }
      .label { fill:#bf8fff; font: 700 15px 'Segoe UI', sans-serif; }
      .sub { fill:#9a9cb0; font: 400 12px 'Segoe UI', sans-serif; }
      .streak-num { fill:#4dd8ff; font: 700 26px 'Segoe UI', sans-serif; }
      .divider { stroke:#3a3d52; stroke-width:1; }
    </style>
  </defs>

  <rect class="bg" width="880" height="195" rx="14"/>

  <text x="24" y="34" class="header">🦊 GitLab Stats</text>
  <line x1="0" y1="48" x2="880" y2="48" class="divider"/>

  <rect class="border" x="16" y="64" width="848" height="115" rx="12"/>

  <text x="150" y="112" class="num" text-anchor="middle">${stats.totalContributions}</text>
  <text x="150" y="138" class="label" text-anchor="middle">Contribuciones Totales</text>
  <text x="150" y="156" class="sub" text-anchor="middle">${startLabel} - Presente</text>

  <line x1="317" y1="80" x2="317" y2="163" class="divider"/>

  <circle cx="440" cy="108" r="34" fill="none" stroke="#bf8fff" stroke-width="4"/>
  <text x="440" y="118" class="streak-num" text-anchor="middle">${stats.current}</text>
  <text x="415" y="150" text-anchor="middle" font-size="14">🔥</text>
  <text x="450" y="158" class="label" text-anchor="middle">Racha Actual</text>

  <line x1="563" y1="80" x2="563" y2="163" class="divider"/>

  <text x="700" y="112" class="num" text-anchor="middle">${stats.longest}</text>
  <text x="700" y="138" class="label" text-anchor="middle">Racha Más Larga</text>
  <text x="700" y="156" class="sub" text-anchor="middle">Máximo consecutivo</text>

  <text x="24" y="185" class="sub">* Excluyendo dom, sáb</text>
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
