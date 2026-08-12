import { fonts } from "../../config.mjs";
import {
  clamp,
  compactNumber,
  esc,
  hashString,
  mixHex,
  mulberry32,
  round,
} from "../util.mjs";

const W = 1000;
const H = 350;

const CENTER = { x: 790, y: 165 };
const RADIUS = 120;
/** Baseline the "last signal" callout and its leader line share. */
const LABEL_Y = 300;
const GOLDEN_ANGLE = 2.399963229728653;

/**
 * Places repositories on a sunflower lattice so the disc fills evenly no matter
 * how many stars there are, then nudges each one with a seeded jitter.
 */
function layoutStars(repos, seed) {
  const rand = mulberry32(seed);
  const scores = repos.map((r) => r.score);
  const maxScore = Math.max(...scores, 0.0001);

  return repos.map((repo, i) => {
    const t = (i + 0.5) / repos.length;
    const radius = RADIUS * Math.sqrt(t);
    const angle = i * GOLDEN_ANGLE + seed * 0.0001;
    const jitter = (rand() - 0.5) * 14;
    const jitterAngle = (rand() - 0.5) * 0.25;
    const norm = repo.score / maxScore;

    return {
      ...repo,
      x: round(CENTER.x + Math.cos(angle + jitterAngle) * (radius + jitter)),
      y: round(CENTER.y + Math.sin(angle + jitterAngle) * (radius + jitter) * 0.92),
      r: round(2.1 + norm * 4.6, 2),
      norm: round(norm, 3),
      delay: round(rand() * -4, 2),
    };
  });
}

/** Connects every star to its two closest neighbours, deduping mirrored edges. */
function linkStars(stars) {
  const edges = new Map();
  stars.forEach((a, i) => {
    const neighbours = stars
      .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }))
      .filter((n) => n.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);

    for (const n of neighbours) {
      const key = i < n.j ? `${i}-${n.j}` : `${n.j}-${i}`;
      if (!edges.has(key)) edges.set(key, [a, stars[n.j]]);
    }
  });
  return [...edges.values()];
}

function starfield(theme, seed) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const dots = [];
  for (let i = 0; i < 150; i++) {
    const x = rand() * W;
    const y = rand() * H;
    // Bias the field toward the constellation half so the type stays legible.
    if (x < 460 && rand() > 0.22) continue;
    const r = round(0.35 + rand() * 1.05, 2);
    // Three amplitude tiers instead of one: a single shared keyframe would
    // override every inline opacity and flatten the field into uniform specks.
    const tier = rand() < 0.55 ? 1 : rand() < 0.75 ? 2 : 3;
    const dur = round(2.6 + rand() * 5.4, 2);
    const delay = round(rand() * -8, 2);
    dots.push(
      `<circle cx="${round(x, 1)}" cy="${round(y, 1)}" r="${r}" fill="${theme.star}" ` +
        `class="tw${tier}" style="animation-duration:${dur}s;animation-delay:${delay}s"/>`,
    );
  }
  return dots.join("");
}

function statCell(theme, x, value, label) {
  return `
    <text x="${x}" y="278" font-family="${fonts.mono}" font-size="19" font-weight="700"
      fill="${theme.text}" letter-spacing="-0.2">${esc(value)}</text>
    <text x="${x}" y="295" font-family="${fonts.mono}" font-size="8.5"
      fill="${theme.faint}" letter-spacing="1.6">${esc(label.toUpperCase())}</text>`;
}

function corner(theme, x, y, sx, sy) {
  return `<path d="M ${x} ${y + sy * 16} L ${x} ${y} L ${x + sx * 16} ${y}"
    fill="none" stroke="${theme.accent}" stroke-width="1.2" opacity="0.45"/>`;
}

export function renderHero({ theme, data }) {
  const seed = hashString(`${data.login}:${data.repos.length}:${theme.id}`);
  const stars = layoutStars(data.constellation, seed);
  const edges = linkStars(stars);
  const latest = stars.reduce(
    (best, s) => (new Date(s.pushedAt) > new Date(best.pushedAt) ? s : best),
    stars[0],
  );

  // Light-theme stars are dark ink on white, so the same opacities that read as a
  // faint galaxy on black read as dust on paper.
  const starScale = theme.id === "dark" ? 1 : 0.42;
  const dim = (value) => round(value * starScale, 3);

  const nodeColor = (norm) =>
    norm > 0.66
      ? mixHex(theme.accent, theme.accent2, (norm - 0.66) / 0.34)
      : mixHex(theme.accent3, theme.accent, norm / 0.66);

  const edgeMarkup = edges
    .map(([a, b], i) => {
      const strength = round(0.06 + Math.min(a.norm, b.norm) * 0.16, 3);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${theme.accent}"
        stroke-width="0.7" opacity="${strength}" class="flow"
        style="animation-delay:${round(i * -0.35, 2)}s"/>`;
    })
    .join("");

  const nodeMarkup = stars
    .map((s, i) => {
      const color = nodeColor(s.norm);
      const ping =
        i < 3
          ? `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="none" stroke="${color}" stroke-width="0.9">
              <animate attributeName="r" values="${s.r};${round(s.r + 19, 2)}" dur="3.4s"
                begin="${round(i * 1.1, 2)}s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.6;0" dur="3.4s"
                begin="${round(i * 1.1, 2)}s" repeatCount="indefinite"/>
            </circle>`
          : "";

      return `<g class="node" style="animation-delay:${s.delay}s">
        <circle cx="${s.x}" cy="${s.y}" r="${round(s.r * 3.6, 2)}" fill="${color}" opacity="0.13"/>
        <circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${color}"/>
      </g>${ping}`;
    })
    .join("");

  const rings = [46, 82, 119]
    .map((r, i) => {
      const dur = 90 + i * 55;
      const dir = i % 2 === 0 ? 360 : -360;
      return `<g opacity="${round(0.5 - i * 0.13, 2)}">
        <ellipse cx="${CENTER.x}" cy="${CENTER.y}" rx="${r}" ry="${round(r * 0.92, 1)}"
          fill="none" stroke="${theme.hairline}" stroke-width="0.8" stroke-dasharray="1.5 8"/>
        <animateTransform attributeName="transform" type="rotate"
          from="0 ${CENTER.x} ${CENTER.y}" to="${dir} ${CENTER.x} ${CENTER.y}"
          dur="${dur}s" repeatCount="indefinite"/>
      </g>`;
    })
    .join("");

  const reticle = `
    <g opacity="0.85">
      <circle cx="${latest.x}" cy="${latest.y}" r="11" fill="none"
        stroke="${theme.accent}" stroke-width="0.9" stroke-dasharray="4 4">
        <animateTransform attributeName="transform" type="rotate"
          from="0 ${latest.x} ${latest.y}" to="360 ${latest.x} ${latest.y}"
          dur="14s" repeatCount="indefinite"/>
      </circle>
      <path d="M ${latest.x} ${latest.y + 12} L ${latest.x} ${LABEL_Y} L 784 ${LABEL_Y}"
        fill="none" stroke="${theme.accent}" stroke-width="0.7" opacity="0.35"/>
      <circle cx="${latest.x}" cy="${LABEL_Y}" r="1.6" fill="${theme.accent}" opacity="0.6"/>
    </g>
    <text x="976" y="${LABEL_Y + 3.4}" text-anchor="end" font-family="${fonts.mono}" font-size="9.5"
      fill="${theme.muted}" letter-spacing="0.6">last signal
      <tspan fill="${theme.accent}">${esc(latest.name)}</tspan>
      <tspan fill="${theme.faint}">· ${esc(latest.relative)}</tspan></text>`;

  const wordmarkWidth = 300;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
  role="img" aria-label="${esc(data.login)} — generative profile banner rendered from public GitHub activity">
  <title>${esc(data.identity.wordmark)} — ${esc(data.identity.headline)}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.bg1}"/>
      <stop offset="0.55" stop-color="${theme.bg0}"/>
      <stop offset="1" stop-color="${theme.bg2}"/>
    </linearGradient>
    <radialGradient id="halo" cx="${CENTER.x / W}" cy="${CENTER.y / H}" r="0.42">
      <stop offset="0" stop-color="${theme.accent}" stop-opacity="0.16"/>
      <stop offset="0.55" stop-color="${theme.accent2}" stop-opacity="0.06"/>
      <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${theme.text}"/>
      <stop offset="1" stop-color="${mixHex(theme.text, theme.bg0, 0.32)}"/>
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${theme.accent}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${theme.accent}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${theme.accent}" stop-opacity="0.05"/>
      <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <clipPath id="frame"><rect width="${W}" height="${H}" rx="14"/></clipPath>
  </defs>

  <style>
    @keyframes tw1 { 0%,100% { opacity: ${dim(0.06)} } 50% { opacity: ${dim(0.3)} } }
    @keyframes tw2 { 0%,100% { opacity: ${dim(0.1)} } 50% { opacity: ${dim(0.55)} } }
    @keyframes tw3 { 0%,100% { opacity: ${dim(0.18)} } 50% { opacity: ${dim(0.85)} } }
    @keyframes nodeBreathe { 0%,100% { opacity: 0.78 } 50% { opacity: 1 } }
    @keyframes flow { 0%,100% { opacity: 0.05 } 50% { opacity: 0.22 } }
    @keyframes blink { 0%,45% { opacity: 1 } 50%,100% { opacity: 0.15 } }
    @keyframes ruleIn { from { transform: scaleX(0) } to { transform: scaleX(1) } }
    .tw1 { opacity: ${dim(0.18)}; animation: tw1 4s ease-in-out infinite }
    .tw2 { opacity: ${dim(0.3)}; animation: tw2 4s ease-in-out infinite }
    .tw3 { opacity: ${dim(0.5)}; animation: tw3 4s ease-in-out infinite }
    .node { animation: nodeBreathe 4.4s ease-in-out infinite }
    .flow { animation: flow 6s ease-in-out infinite }
    .blink { animation: blink 1.6s steps(1, end) infinite }
    .rule { animation: ruleIn 1.1s cubic-bezier(0.2, 0.9, 0.2, 1) backwards;
            transform-box: fill-box; transform-origin: left center }
    @media (prefers-reduced-motion: reduce) {
      .tw1, .tw2, .tw3, .node, .flow, .blink, .rule { animation: none }
    }
  </style>

  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#halo)"/>
    <rect width="${W}" height="${H}" filter="url(#grain)" opacity="${theme.id === "dark" ? 0.05 : 0.035}"/>
    ${starfield(theme, seed)}
    ${rings}
    ${edgeMarkup}
    ${nodeMarkup}
    ${reticle}
    <rect x="-170" y="0" width="170" height="${H}" fill="url(#sweep)">
      <animate attributeName="x" values="-170;${W}" dur="12s" repeatCount="indefinite"/>
    </rect>

    ${corner(theme, 18, 18, 1, 1)}
    ${corner(theme, W - 18, 18, -1, 1)}
    ${corner(theme, 18, H - 18, 1, -1)}
    ${corner(theme, W - 18, H - 18, -1, -1)}

    <g>
      <rect x="56" y="56" width="3" height="11" fill="${theme.accent}" class="blink"/>
      <text x="68" y="65" font-family="${fonts.mono}" font-size="9.5" letter-spacing="2.8"
        fill="${theme.muted}">SELF&#8209;RENDERING PROFILE — REBUILT EVERY 6H FROM LIVE DATA</text>

      <text x="54" y="156" font-family="${fonts.sans}" font-size="78" font-weight="800"
        letter-spacing="4" fill="url(#ink)">${esc(data.identity.wordmark)}</text>
      <rect x="56" y="170" width="${wordmarkWidth}" height="2" fill="url(#rule)" class="rule"/>

      <text x="56" y="200" font-family="${fonts.sans}" font-size="16.5" font-weight="500"
        fill="${theme.text}" opacity="0.92">${esc(data.identity.headline)}</text>
      <text x="56" y="222" font-family="${fonts.mono}" font-size="11.5"
        fill="${theme.muted}">${esc(data.identity.subline)}</text>

      <g>
        ${statCell(theme, 56, compactNumber(data.stats.contributions), "contributions / 365d")}
        ${statCell(theme, 216, String(data.stats.publicRepos), "public repos")}
        ${statCell(theme, 330, String(data.stats.languages), "languages")}
        ${statCell(theme, 436, String(data.stats.longestStreak) + "d", "longest streak")}
        <line x1="203" y1="262" x2="203" y2="297" stroke="${theme.hairline}" stroke-width="1"/>
        <line x1="317" y1="262" x2="317" y2="297" stroke="${theme.hairline}" stroke-width="1"/>
        <line x1="423" y1="262" x2="423" y2="297" stroke="${theme.hairline}" stroke-width="1"/>
      </g>

      <line x1="56" y1="318" x2="944" y2="318" stroke="${theme.hairline}" stroke-width="1"/>
      <circle cx="60" cy="333" r="3" fill="${theme.accent3}" class="blink"/>
      <text x="70" y="336" font-family="${fonts.mono}" font-size="9"
        fill="${theme.faint}" letter-spacing="0.8">${esc(
          `${data.constellation.length} repositories mapped · rendered ${data.renderedAt} UTC`,
        )}</text>
      <text x="944" y="336" text-anchor="end" font-family="${fonts.mono}" font-size="9"
        fill="${theme.faint}" letter-spacing="1.4">NO THIRD&#8209;PARTY WIDGETS</text>
    </g>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none"
    stroke="${theme.hairline}" stroke-width="1"/>
</svg>`;
}
