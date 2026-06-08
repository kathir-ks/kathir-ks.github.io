/**
 * Source-isolated refresh helpers.
 *
 * Each source (GitHub, HuggingFace) writes to its own R2 key so concurrent
 * refreshes can't clobber each other:
 *   feed/github.json  ← refreshGitHub
 *   feed/hf.json      ← refreshHuggingFace
 *
 * Readers merge both at request time (see mergedActivity).
 *
 * Env bindings expected: R2, GITHUB_TOKEN, GH_USERNAME, HF_USERNAME.
 */

const MAX_ITEMS = 40;

// ── GitHub ────────────────────────────────────────────────────
export async function refreshGitHub(env) {
  const username = env.GH_USERNAME || "kathir-ks";
  const headers = {
    "User-Agent": "kathir-os",
    Accept: "application/vnd.github.v3+json",
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `token ${env.GITHUB_TOKEN}`;

  const [eventsRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${username}/events/public?per_page=30`, { headers }),
    fetch(`https://api.github.com/users/${username}/repos?sort=pushed&per_page=10`, { headers }),
  ]);

  const events = eventsRes.ok ? await eventsRes.json() : [];

  const activity = events
    .filter(e => ["PushEvent", "CreateEvent", "WatchEvent", "ForkEvent"].includes(e.type))
    .slice(0, 20)
    .map(e => ({
      source: "github",
      type: e.type,
      repo: e.repo?.name,
      message: formatGitHubEvent(e),
      ts: e.created_at,
    }));

  await env.R2.put("feed/github.json", JSON.stringify(activity), {
    httpMetadata: { contentType: "application/json" },
  });

  // Status update from latest push
  const latestPush = events.find(e => e.type === "PushEvent");
  if (latestPush) {
    const msg = latestPush.payload?.commits?.[0]?.message || "Working on something";
    const repo = latestPush.repo?.name?.split("/")?.[1] || "a project";
    await env.R2.put(
      "feed/status.json",
      JSON.stringify({
        text: msg.split("\n")[0].slice(0, 120),
        repo,
        updated: latestPush.created_at,
        source: "github",
      }),
      { httpMetadata: { contentType: "application/json" } }
    );
  }

  return activity.length;
}

// ── HuggingFace ───────────────────────────────────────────────
// Note: HF stats endpoints don't return a real update timestamp, so we
// stamp `ts` once per refresh — items will appear "as of <refresh time>".
export async function refreshHuggingFace(env) {
  const username = env.HF_USERNAME || "KathirKs";
  const datasets = (env.HF_DATASETS || "fineweb-edu-hindi").split(",").map(s => s.trim()).filter(Boolean);
  const models = (env.HF_MODELS || "Gemma-200M-hindi").split(",").map(s => s.trim()).filter(Boolean);

  const ts = new Date().toISOString();
  const activity = [];

  for (const ds of datasets) {
    const item = await fetchHfStats("datasets", username, ds, ts);
    if (item) activity.push(item);
  }
  for (const m of models) {
    const item = await fetchHfStats("models", username, m, ts);
    if (item) activity.push(item);
  }

  await env.R2.put("feed/hf.json", JSON.stringify(activity), {
    httpMetadata: { contentType: "application/json" },
  });

  return activity.length;
}

async function fetchHfStats(kind, user, name, ts) {
  try {
    const res = await fetch(`https://huggingface.co/api/${kind}/${user}/${name}`, {
      headers: { "User-Agent": "kathir-os" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const label = kind === "datasets" ? "DatasetStats" : "ModelStats";
    return {
      source: "huggingface",
      type: label,
      repo: `${user}/${name}`,
      message: `${name}: ${(data.downloads || 0).toLocaleString()} downloads`,
      downloads: data.downloads || 0,
      ts,
    };
  } catch {
    return null;
  }
}

// ── Read-side merge ───────────────────────────────────────────
// Returns merged activity from GitHub + HF, sorted by ts desc.
export async function mergedActivity(env) {
  const [gh, hf] = await Promise.all([
    readJson(env.R2, "feed/github.json"),
    readJson(env.R2, "feed/hf.json"),
  ]);
  const items = [...(gh || []), ...(hf || [])];
  items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return items.slice(0, MAX_ITEMS);
}

async function readJson(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  try { return await obj.json(); } catch { return null; }
}

// ── GitHub event formatter ────────────────────────────────────
function formatGitHubEvent(e) {
  switch (e.type) {
    case "PushEvent": {
      const msg = e.payload?.commits?.[0]?.message || "pushed code";
      return `Pushed: ${msg.split("\n")[0].slice(0, 80)}`;
    }
    case "CreateEvent":
      return `Created ${e.payload?.ref_type || "repo"}: ${e.payload?.ref || e.repo?.name}`;
    case "WatchEvent":
      return `Starred ${e.repo?.name}`;
    case "ForkEvent":
      return `Forked ${e.repo?.name}`;
    default:
      return e.type;
  }
}
