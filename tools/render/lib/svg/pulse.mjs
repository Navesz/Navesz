import { fonts } from "../../config.mjs";
import { esc, round, smoothPath } from "../util.mjs";

const W = 1000;
const H = 270;
const X0 = 56;
const X1 = 944;
const BASELINE = 182;
const TOP = 76;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function statCell(theme, x, value, label, accent) {
  return `
    <text x="${x}" y="240" font-family="${fonts.mono}" font-size="20" font-weight="700"
      fill="${accent ?? theme.text}">${esc(value)}</text>
    <text x="${x}" y="256" font-family="${fonts.mono}" font-size="8.5" letter-spacing="1.6"
      fill="${theme.faint}">${esc(label.toUpperCase())}</text>`;
}

export function renderPulse({ theme, data }) {
  const weeks = data.weeks;
  const n = weeks.length;
  const gap = 3.4;
  const barW = round(((X1 - X0) - gap * (n - 1)) / n, 2);
  const max = Math.max(...weeks.map((w) => w.total), 1);

  // A single burst week can be an order of magnitude above the median, which would
  // flatten every other bar into the baseline. Compressing the axis keeps ordinary
  // weeks readable; the gridline labels below are derived from the inverse curve so
  // the numbers stay honest.
  const EXPONENT = 0.6;
  const PLOT_H = BASELINE - TOP;
  const scale = (value) =>
    value <= 0 ? 0 : round((value / max) ** EXPONENT * PLOT_H, 2);
  const axisValue = (ratio) => Math.round(max * ratio ** (1 / EXPONENT));

  const peakIndex = weeks.reduce((best, w, i) => (w.total > weeks[best].total ? i : best), 0);

  const bars = weeks
    .map((week, i) => {
      const h = Math.max(week.total > 0 ? 2 : 0.9, scale(week.total));
      const x = round(X0 + i * (barW + gap), 2);
      const y = round(BASELINE - h, 2);
      const rx = Math.min(barW / 2, 3.5);
      const dim = week.total === 0 ? ` opacity="0.35"` : "";
      return `<rect x="${x}" y="${y}" width="${barW}" height="${round(h, 2)}" rx="${rx}"
        fill="url(#bars)"${dim} class="grow"
        style="animation-delay:${round(i * 0.014, 3)}s"/>`;
    })
    .join("");

  const points = weeks.map((week, i) => ({
    x: X0 + i * (barW + gap) + barW / 2,
    y: BASELINE - scale(week.total),
  }));

  const monthTicks = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const month = new Date(`${week.firstDay}T00:00:00Z`).getUTCMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      monthTicks.push({ x: round(X0 + i * (barW + gap), 1), label: MONTHS[month] });
    }
  });

  const gridLines = [0.5, 1]
    .map((ratio) => {
      const y = round(BASELINE - PLOT_H * ratio, 1);
      return `<line x1="${X0}" y1="${y}" x2="${X1}" y2="${y}" stroke="${theme.grid}"
          stroke-width="1" stroke-dasharray="2 6"/>
        <text x="${X0 - 10}" y="${y + 3.5}" text-anchor="end" font-family="${fonts.mono}"
          font-size="9" fill="${theme.faint}">${axisValue(ratio)}</text>`;
    })
    .join("");

  const peakX = round(X0 + peakIndex * (barW + gap) + barW / 2, 1);
  const peakY = round(BASELINE - scale(weeks[peakIndex].total), 1);
  const peakAnchor = peakX > W - 140 ? "end" : "start";
  const peakLabelX = peakAnchor === "end" ? peakX - 8 : peakX + 8;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
  role="img" aria-label="Weekly contribution activity over the last 52 weeks">
  <title>Contribution rhythm — ${data.stats.contributions} contributions in the last year</title>
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.bg1}"/>
      <stop offset="1" stop-color="${theme.bg0}"/>
    </linearGradient>
    <linearGradient id="bars" gradientUnits="userSpaceOnUse" x1="0" y1="${BASELINE}" x2="0" y2="${TOP}">
      <stop offset="0" stop-color="${theme.accent3}"/>
      <stop offset="0.55" stop-color="${theme.accent}"/>
      <stop offset="1" stop-color="${theme.accent2}"/>
    </linearGradient>
  </defs>

  <style>
    @keyframes grow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
    @keyframes draw { from { stroke-dashoffset: 3000 } to { stroke-dashoffset: 0 } }
    @keyframes ping { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }
    .grow { animation: grow 0.85s cubic-bezier(0.16, 1, 0.3, 1) backwards;
            transform-box: fill-box; transform-origin: center bottom }
    .line { stroke-dasharray: 3000; animation: draw 2.6s ease-out 0.5s backwards }
    .ping { animation: ping 2.4s ease-in-out infinite }
    @media (prefers-reduced-motion: reduce) {
      .grow, .line, .ping { animation: none }
    }
  </style>

  <rect width="${W}" height="${H}" rx="14" fill="url(#panel)"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none"
    stroke="${theme.hairline}" stroke-width="1"/>

  <text x="56" y="36" font-family="${fonts.mono}" font-size="10" letter-spacing="2.6"
    fill="${theme.muted}">CONTRIBUTION RHYTHM — 52 WEEKS</text>
  <text x="944" y="36" text-anchor="end" font-family="${fonts.mono}" font-size="10"
    letter-spacing="1.4" fill="${theme.faint}">AVG ${data.stats.avgPerWeek}/WEEK</text>

  ${gridLines}
  <line x1="${X0}" y1="${BASELINE}" x2="${X1}" y2="${BASELINE}" stroke="${theme.hairline}" stroke-width="1"/>
  ${bars}
  <path d="${smoothPath(points, 0.55)}" fill="none" stroke="${theme.text}" stroke-width="1.4"
    stroke-linecap="round" opacity="0.5" class="line"/>

  <g>
    <circle cx="${peakX}" cy="${peakY}" r="3" fill="${theme.accent2}"/>
    <circle cx="${peakX}" cy="${peakY}" r="7" fill="none" stroke="${theme.accent2}"
      stroke-width="0.9" class="ping"/>
    <text x="${peakLabelX}" y="${peakY - 10}" text-anchor="${peakAnchor}"
      font-family="${fonts.mono}" font-size="9.5" fill="${theme.muted}">peak
      <tspan fill="${theme.accent2}" font-weight="700">${weeks[peakIndex].total}</tspan></text>
  </g>

  ${monthTicks
    .map(
      (tick) =>
        `<text x="${tick.x}" y="198" font-family="${fonts.mono}" font-size="8.5"
          letter-spacing="0.8" fill="${theme.faint}">${tick.label}</text>`,
    )
    .join("")}

  <line x1="56" y1="214" x2="944" y2="214" stroke="${theme.hairline}" stroke-width="1"/>
  ${statCell(theme, 56, String(data.stats.contributions), "total / 365d", theme.accent)}
  ${statCell(theme, 240, String(data.stats.commits), "commits")}
  ${statCell(theme, 424, String(data.stats.pullRequests), "pull requests")}
  ${statCell(theme, 608, String(data.stats.issues), "issues")}
  ${statCell(theme, 792, `${data.stats.currentStreak}d`, "current streak", theme.accent3)}
</svg>`;
}
