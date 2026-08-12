#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { featured, identity, login, themes } from "./config.mjs";
import {
  activityScore,
  fetchProfile,
  flattenDays,
  languageTotals,
  streaks,
  weeklyTotals,
} from "./lib/github.mjs";
import { renderHero } from "./lib/svg/hero.mjs";
import { renderPulse } from "./lib/svg/pulse.mjs";
import { renderSpectrum } from "./lib/svg/spectrum.mjs";
import { relativeTime, round } from "./lib/util.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const ASSETS = join(ROOT, "assets");

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
if (!token) {
  console.error("Missing GITHUB_TOKEN. Export a token with public read access and retry.");
  process.exit(1);
}

const write = (path, contents) => {
  writeFileSync(path, contents.replace(/\r\n/g, "\n"), "utf8");
  console.log(`  wrote ${path.replace(ROOT, ".")}`);
};

function buildModel(user) {
  const now = Date.now();
  // The profile repo itself is excluded: the render job commits to it on every
  // run, so it would permanently win "most recently pushed" and drown the signal.
  const repos = (user.repositories.nodes ?? []).filter(
    (repo) => repo && repo.name.toLowerCase() !== user.login.toLowerCase(),
  );
  const calendar = user.contributionsCollection.contributionCalendar;
  const days = flattenDays(calendar);
  const weeks = weeklyTotals(calendar);
  const { current, longest } = streaks(days);
  const languages = languageTotals(repos);

  const scored = repos
    .map((repo) => ({
      name: repo.name,
      url: repo.url,
      pushedAt: repo.pushedAt,
      relative: relativeTime(repo.pushedAt, now),
      stars: repo.stargazerCount,
      language: repo.primaryLanguage?.name ?? null,
      archived: repo.isArchived,
      score: activityScore(repo, now),
    }))
    .sort((a, b) => b.score - a.score);

  const byName = new Map(repos.map((repo) => [repo.name.toLowerCase(), repo]));

  return {
    login: user.login,
    identity,
    renderedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    generatedAtIso: new Date().toISOString(),
    repos,
    constellation: scored.slice(0, 20),
    weeks,
    languages,
    stats: {
      contributions: calendar.totalContributions,
      commits: user.contributionsCollection.totalCommitContributions,
      pullRequests: user.contributionsCollection.totalPullRequestContributions,
      issues: user.contributionsCollection.totalIssueContributions,
      publicRepos: user.repositories.totalCount,
      languages: languages.distinct,
      currentStreak: current,
      longestStreak: longest,
      avgPerWeek: round(calendar.totalContributions / Math.max(weeks.length, 1), 1),
      activeRepos: scored.filter((r) => Date.now() - new Date(r.pushedAt).getTime() < 7776e6).length,
    },
    featured: featured
      .map((entry) => {
        const repo = byName.get(entry.repo.toLowerCase());
        if (!repo) return null;
        return {
          ...entry,
          url: repo.url,
          language: repo.primaryLanguage?.name ?? null,
          stars: repo.stargazerCount,
          topics: (repo.repositoryTopics?.nodes ?? []).map((n) => n.topic.name),
          pushedAt: repo.pushedAt,
          updated: relativeTime(repo.pushedAt, now),
        };
      })
      .filter(Boolean),
  };
}

function renderWorkBlock(model) {
  return model.featured
    .map((project) => {
      const meta = [
        project.language ? `\`${project.language}\`` : null,
        project.stars > 0 ? `${project.stars} ★` : null,
        `updated ${project.updated}`,
      ]
        .filter(Boolean)
        .join(" · ");
      // Two trailing spaces: GFM needs an explicit hard break here, otherwise the
      // blurb collapses onto the title line.
      return `**[${project.title}](${project.url})** — ${meta}  \n${project.blurb}`;
    })
    .join("\n\n");
}

function renderSnapshotBlock(model) {
  const s = model.stats;
  return (
    `> **Live snapshot** · ${s.contributions} contributions in the last 365 days · ` +
    `${s.commits} commits · ${s.pullRequests} pull requests · ${s.activeRepos} repositories ` +
    `touched in the last 90 days · current streak ${s.currentStreak} days.\n>\n` +
    `> Rendered ${model.renderedAt} UTC by [\`tools/render\`](tools/render) — every number and ` +
    `every pixel above comes from the GitHub GraphQL API, not from a third-party badge service.`
  );
}

function injectBlocks(model) {
  const path = join(ROOT, "README.md");
  let readme = readFileSync(path, "utf8");
  const blocks = {
    work: renderWorkBlock(model),
    snapshot: renderSnapshotBlock(model),
  };

  for (const [key, body] of Object.entries(blocks)) {
    const pattern = new RegExp(
      `(<!-- gen:${key} -->)[\\s\\S]*?(<!-- /gen:${key} -->)`,
      "g",
    );
    if (!pattern.test(readme)) {
      console.warn(`  ! marker gen:${key} not found in README.md, skipping`);
      continue;
    }
    readme = readme.replace(pattern, `$1\n${body}\n$2`);
  }

  write(path, readme);
}

function renderManifest(model) {
  const manifest = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    kind: "github-profile-manifest",
    version: 1,
    generatedAt: model.generatedAtIso,
    generator: "tools/render (no third-party services)",
    identity: {
      handle: model.login,
      alias: identity.wordmark,
      headline: identity.headline,
      summary: identity.summary,
      interests: identity.interests,
      languagePreference: "English for code and docs, Portuguese natively",
    },
    stack: {
      primary: model.languages.list[0]?.name ?? null,
      spectrum: model.languages.list.map((lang) => ({
        name: lang.name,
        share: round(lang.share, 4),
        bytes: lang.bytes,
      })),
    },
    activity: model.stats,
    projects: model.featured.map((project) => ({
      name: project.title,
      repo: project.repo,
      url: project.url,
      summary: project.blurb,
      language: project.language,
      stars: project.stars,
      topics: project.topics,
      lastPush: project.pushedAt,
    })),
    links: { github: `https://github.com/${model.login}` },
    agentNotes: [
      "Project summaries are authored by the profile owner; numbers are machine-generated.",
      "This file is regenerated on a schedule, so prefer it over scraping the rendered README.",
      "Nothing here is private: every field derives from public GitHub data.",
    ],
  };

  write(join(ROOT, "profile.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const llms = `# ${identity.wordmark} — GitHub profile (${model.login})

> ${identity.summary}

This file follows the llms.txt convention. It exists so that language models and
autonomous agents can understand this profile without scraping rendered HTML.
Structured equivalent: ./profile.json

Generated: ${model.generatedAtIso}

## Focus
${identity.interests.map((topic) => `- ${topic}`).join("\n")}

## Selected projects
${model.featured
  .map(
    (project) =>
      `- [${project.title}](${project.url}) — ${project.blurb} ` +
      `(${project.language ?? "mixed"}, ${project.stars} star${project.stars === 1 ? "" : "s"}, ` +
      `last push ${project.pushedAt.slice(0, 10)})`,
  )
  .join("\n")}

## Stack signal (share of public code, by bytes)
${model.languages.list
  .map((lang) => `- ${lang.name}: ${(lang.share * 100).toFixed(1)}%`)
  .join("\n")}

## Activity (rolling 365 days)
- contributions: ${model.stats.contributions}
- commits: ${model.stats.commits}
- pull requests: ${model.stats.pullRequests}
- issues: ${model.stats.issues}
- public repositories: ${model.stats.publicRepos}
- longest streak: ${model.stats.longestStreak} days

## Contact
- GitHub: https://github.com/${model.login}
- Preferred first contact: open an issue or discussion on a relevant repository.

## Notes for agents
- Prose is human-authored; metrics are generated by ./tools/render.
- Do not infer employer, location or contact details: they are deliberately omitted.
`;

  write(join(ROOT, "llms.txt"), llms);
}

const STATE_FILE = join(ROOT, "assets", ".render-state.json");

/**
 * Fingerprints everything that can legitimately change the output, so an idle
 * profile stops rewriting files. Without this the scheduled job would commit a
 * fresh timestamp four times a day forever. The UTC date is part of the input on
 * purpose: relative labels like "updated 3d ago" have to stay truthful, so a new
 * day is a real change even when nothing was pushed.
 */
function fingerprint(model) {
  const canonical = {
    day: model.generatedAtIso.slice(0, 10),
    stats: model.stats,
    languages: model.languages.list.map((l) => [l.name, l.bytes]),
    repos: model.constellation.map((r) => [r.name, r.pushedAt, r.stars]),
    featured: model.featured.map((p) => [p.repo, p.pushedAt, p.stars, p.blurb]),
    identity,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

async function main() {
  const force = process.argv.includes("--force");

  console.log(`Fetching public profile data for ${login}...`);
  const user = await fetchProfile(login, token);
  const model = buildModel(user);

  console.log(
    `  ${model.stats.contributions} contributions · ${model.repos.length} public repos · ` +
      `${model.languages.distinct} languages`,
  );

  const hash = fingerprint(model);
  if (!force && existsSync(STATE_FILE)) {
    const previous = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    if (previous.fingerprint === hash) {
      console.log("Nothing meaningful changed since the last render. Skipping write.");
      return;
    }
  }

  mkdirSync(ASSETS, { recursive: true });

  const panels = [
    ["hero", renderHero],
    ["pulse", renderPulse],
    ["spectrum", renderSpectrum],
  ];

  for (const [name, render] of panels) {
    for (const theme of Object.values(themes)) {
      write(join(ASSETS, `${name}-${theme.id}.svg`), render({ theme, data: model }));
    }
  }

  renderManifest(model);
  injectBlocks(model);
  write(
    STATE_FILE,
    `${JSON.stringify({ fingerprint: hash, renderedAt: model.generatedAtIso }, null, 2)}\n`,
  );
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
