import { fonts } from "../../config.mjs";
import { compactNumber, ensureContrast, esc, relativeLuminance, round } from "../util.mjs";

const W = 1000;
const H = 180;
const X0 = 56;
const X1 = 944;
const BAR_Y = 56;
const BAR_H = 28;

const FALLBACK_COLORS = ["#5ee7ff", "#a78bfa", "#3ddc97", "#f59e0b", "#f472b6", "#38bdf8"];

export function renderSpectrum({ theme, data }) {
  const width = X1 - X0;
  const langs = data.languages.list;

  let cursor = X0;
  const segments = langs.map((lang, i) => {
    const raw = lang.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
    const color = ensureContrast(raw, theme.bg0);
    const w = Math.max(2, round(lang.share * width, 2));
    const seg = { ...lang, color, x: round(cursor, 2), w };
    cursor += w;
    return seg;
  });

  const bars = segments
    .map(
      (seg) =>
        `<rect x="${seg.x}" y="${BAR_Y}" width="${round(Math.max(1, seg.w - 2), 2)}" height="${BAR_H}"
          fill="${seg.color}"/>`,
    )
    .join("");

  const inlineLabels = segments
    .filter((seg) => seg.w > 54)
    .map((seg) => {
      const onLight = relativeLuminance(seg.color) > 0.42;
      return `<text x="${round(seg.x + (seg.w - 2) / 2, 1)}" y="${BAR_Y + BAR_H / 2 + 3.6}"
        text-anchor="middle" font-family="${fonts.mono}" font-size="10.5" font-weight="700"
        fill="${onLight ? "#08101f" : "#ffffff"}"
        >${(seg.share * 100).toFixed(1)}%</text>`;
    })
    .join("");

  let legendX = X0;
  const legend = segments
    .map((seg) => {
      const pct = `${(seg.share * 100).toFixed(1)}%`;
      const label = `<g>
        <circle cx="${round(legendX + 4, 1)}" cy="114" r="4" fill="${seg.color}"/>
        <text x="${round(legendX + 15, 1)}" y="118" font-family="${fonts.mono}" font-size="11.5"
          fill="${theme.text}">${esc(seg.name)}</text>
        <text x="${round(legendX + 15 + seg.name.length * 6.9 + 8, 1)}" y="118"
          font-family="${fonts.mono}" font-size="11.5" fill="${theme.faint}">${pct}</text>
      </g>`;
      legendX += 15 + seg.name.length * 6.9 + 8 + pct.length * 6.9 + 26;
      return label;
    })
    .join("");

  const primary = segments[0];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
  role="img" aria-label="Language distribution across public repositories, measured in bytes of code">
  <title>Language spectrum — ${esc(primary.name)} leads with ${(primary.share * 100).toFixed(1)}%</title>
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.bg1}"/>
      <stop offset="1" stop-color="${theme.bg0}"/>
    </linearGradient>
    <clipPath id="rounded">
      <rect x="${X0}" y="${BAR_Y}" width="${width}" height="${BAR_H}" rx="${BAR_H / 2}"/>
    </clipPath>
  </defs>

  <style>
    /* The wipe is a transform, not a clip, so the bar degrades to fully drawn
       wherever CSS animation does not run instead of vanishing. */
    @keyframes wipe { from { transform: scaleX(0) } to { transform: scaleX(1) } }
    @keyframes fadeIn { from { opacity: 0 } to { opacity: 0.92 } }
    .wipe { animation: wipe 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.15s backwards;
            transform-box: fill-box; transform-origin: left center }
    .fade { animation: fadeIn 0.7s ease-out 0.9s backwards }
    @media (prefers-reduced-motion: reduce) {
      .wipe, .fade { animation: none }
    }
  </style>

  <rect width="${W}" height="${H}" rx="14" fill="url(#panel)"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none"
    stroke="${theme.hairline}" stroke-width="1"/>

  <text x="56" y="36" font-family="${fonts.mono}" font-size="10" letter-spacing="2.6"
    fill="${theme.muted}">LANGUAGE SPECTRUM — MEASURED IN BYTES OF CODE</text>
  <text x="944" y="36" text-anchor="end" font-family="${fonts.mono}" font-size="10"
    letter-spacing="1.4" fill="${theme.faint}">${data.languages.distinct} LANGUAGES DETECTED</text>

  <rect x="${X0}" y="${BAR_Y}" width="${width}" height="${BAR_H}" rx="${BAR_H / 2}"
    fill="${theme.bg2}" stroke="${theme.hairline}" stroke-width="1"/>
  <g clip-path="url(#rounded)">
    <g class="wipe">${bars}</g>
    <g class="fade">${inlineLabels}</g>
  </g>

  ${legend}

  <line x1="56" y1="142" x2="944" y2="142" stroke="${theme.hairline}" stroke-width="1"/>
  <text x="56" y="163" font-family="${fonts.mono}" font-size="9" letter-spacing="0.8"
    fill="${theme.faint}">${esc(
      `${compactNumber(data.languages.totalBytes)} bytes across ${data.repos.length} public repositories`,
    )}</text>
  <text x="944" y="163" text-anchor="end" font-family="${fonts.mono}" font-size="9"
    letter-spacing="1.4" fill="${theme.faint}">PRIMARY · ${esc(primary.name.toUpperCase())}</text>
</svg>`;
}
