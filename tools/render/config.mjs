export const login = "Navesz";

export const identity = {
  wordmark: "NAVES",
  headline: "I build web products, developer tools and open-source experiments.",
  subline: "TypeScript · Next.js · Node · Python · a bias for shipping",
  /** Rendered inside the machine-readable manifest, not on the canvas. */
  summary:
    "Software developer focused on TypeScript, Next.js and Node. I build web products, " +
    "internal tooling and open-source experiments — usually the kind that turn a messy " +
    "manual process into something a browser can do in one click.",
  interests: [
    "front-end architecture",
    "developer tooling",
    "local-first apps",
    "simulation and physics toys",
    "automation",
  ],
};

/**
 * Curated, English-first descriptions. Live numbers (stars, language, last push)
 * are merged in at render time, so this list only carries the editorial voice.
 */
export const featured = [
  {
    repo: "openkartline",
    title: "OpenKartline",
    blurb:
      "Racing-line planner and lap-time simulator. Draw a track, get the optimal line, " +
      "a speed profile, braking points and an estimated lap time.",
  },
  {
    repo: "openparts",
    title: "OpenParts",
    blurb:
      "Local-first parts interchange lab. Cross-reference automotive part numbers " +
      "entirely in the browser, with no backend to depend on.",
  },
  {
    repo: "constellation",
    title: "Constellation",
    blurb:
      "An observatory for public GitHub signals — profiles, achievements and activity, " +
      "measured honestly instead of gamified.",
  },
  {
    repo: "Galegos",
    title: "Galegos",
    blurb:
      "Digital menu that hands the finished order off to WhatsApp. Built for a real " +
      "kitchen, so it had to survive real customers.",
  },
  {
    repo: "tradutor-voz-texto",
    title: "Speech → Text Translator",
    blurb: "Real-time speech-to-text translation running straight in the browser.",
  },
  {
    repo: "fivem-realistic-injuries",
    title: "Realistic Injuries",
    blurb:
      "FiveM mod that models injuries per body region instead of a single health bar.",
  },
];

export const fonts = {
  mono:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  sans:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif",
};

export const themes = {
  dark: {
    id: "dark",
    bg0: "#05070d",
    bg1: "#0a0f1c",
    bg2: "#0e1526",
    panel: "#0b111f",
    grid: "#1a2436",
    hairline: "#233047",
    text: "#e8eefb",
    muted: "#8b9ab5",
    faint: "#5a6880",
    accent: "#5ee7ff",
    accent2: "#a78bfa",
    accent3: "#3ddc97",
    star: "#cfe4ff",
  },
  light: {
    id: "light",
    bg0: "#ffffff",
    bg1: "#f5f7fc",
    bg2: "#eef2f9",
    panel: "#ffffff",
    grid: "#e3e9f3",
    hairline: "#d3dcea",
    text: "#0c1424",
    muted: "#5c6b83",
    faint: "#8493a9",
    accent: "#0284c7",
    accent2: "#6d28d9",
    accent3: "#059669",
    star: "#2a3b58",
  },
};
