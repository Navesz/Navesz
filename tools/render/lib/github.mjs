const ENDPOINT = "https://api.github.com/graphql";

const QUERY = `
query Profile($login: String!) {
  user(login: $login) {
    login
    name
    createdAt
    followers { totalCount }
    repositories(
      first: 100
      privacy: PUBLIC
      isFork: false
      ownerAffiliations: OWNER
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      totalCount
      nodes {
        name
        description
        url
        homepageUrl
        stargazerCount
        forkCount
        pushedAt
        createdAt
        isArchived
        primaryLanguage { name color }
        repositoryTopics(first: 8) { nodes { topic { name } } }
        languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoriesWithContributedCommits
      contributionCalendar {
        totalContributions
        weeks {
          firstDay
          contributionDays { date contributionCount }
        }
      }
    }
  }
}`;

export async function fetchProfile(login, token) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "navesz-profile-renderer",
    },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API responded ${res.status}: ${await res.text()}`);
  }

  const payload = await res.json();
  if (payload.errors?.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }
  if (!payload.data?.user) {
    throw new Error(`No user data returned for "${login}"`);
  }
  return payload.data.user;
}

/** Flattens the contribution calendar into a chronological list of days. */
export function flattenDays(calendar) {
  return calendar.weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({
      date: day.date,
      count: day.contributionCount,
    })),
  );
}

export function weeklyTotals(calendar) {
  return calendar.weeks.map((week) => ({
    firstDay: week.firstDay,
    total: week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0),
  }));
}

export function streaks(days) {
  let current = 0;
  let longest = 0;
  let running = 0;

  for (const day of days) {
    if (day.count > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  // The current streak walks backwards, tolerating an empty final day (today may
  // simply not have happened yet in the user's timezone).
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) current += 1;
    else if (i === days.length - 1) continue;
    else break;
  }

  return { current, longest };
}

export function languageTotals(repos, { limit = 6 } = {}) {
  const totals = new Map();
  for (const repo of repos) {
    for (const edge of repo.languages?.edges ?? []) {
      const name = edge.node.name;
      const entry = totals.get(name) ?? { name, color: edge.node.color, bytes: 0 };
      entry.bytes += edge.size;
      totals.set(name, entry);
    }
  }

  const sorted = [...totals.values()].sort((a, b) => b.bytes - a.bytes);
  const grandTotal = sorted.reduce((sum, lang) => sum + lang.bytes, 0) || 1;
  const top = sorted.slice(0, limit);
  const restBytes = sorted.slice(limit).reduce((sum, lang) => sum + lang.bytes, 0);

  const list = top.map((lang) => ({ ...lang, share: lang.bytes / grandTotal }));
  if (restBytes > 0) {
    list.push({ name: "Other", color: null, bytes: restBytes, share: restBytes / grandTotal });
  }
  return { list, totalBytes: grandTotal, distinct: sorted.length };
}

/**
 * Repos are scored by how alive they feel: recent pushes dominate, with size and
 * social proof as secondary signals. Drives the visual weight of each star.
 */
export function activityScore(repo, now = Date.now()) {
  const days = (now - new Date(repo.pushedAt).getTime()) / 86400000;
  const recency = Math.exp(-days / 120);
  const bytes = (repo.languages?.edges ?? []).reduce((sum, e) => sum + e.size, 0);
  const size = Math.log10(bytes + 1) / 7;
  const social = Math.log10(repo.stargazerCount + repo.forkCount + 1) / 2;
  return recency * 0.65 + size * 0.25 + social * 0.1;
}
