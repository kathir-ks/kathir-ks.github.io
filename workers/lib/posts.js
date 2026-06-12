/**
 * Posts ("Thoughts") — R2-backed micro-blog with full revision history.
 *
 * Layout in R2:
 *   posts/_index.json   → [{ slug, title, kind, created, updated, revCount, preview }]
 *   posts/<slug>.json   → { slug, title, kind, body, created, updated,
 *                           revisions: [{ ts, note, body }] }   // oldest → newest
 *
 * Revisions store full body snapshots (text is cheap on R2); diffs are
 * computed client-side. Capped at MAX_REVISIONS per post.
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const MAX_REVISIONS = 50;
const MAX_BODY = 60_000;
const MAX_TITLE = 200;

const now = () => new Date().toISOString();

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 80);

async function readJson(bucket, key) {
  try {
    const obj = await bucket.get(key);
    return obj ? await obj.json() : null;
  } catch {
    return null;
  }
}

const putJson = (bucket, key, data) =>
  bucket.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: "application/json" },
  });

const preview = (body) =>
  String(body).replace(/[#*`>\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 140);

async function updateIndex(bucket, post, { remove = false } = {}) {
  const index = (await readJson(bucket, "posts/_index.json")) || [];
  const rest = index.filter((e) => e.slug !== post.slug);
  if (!remove) {
    rest.push({
      slug: post.slug,
      title: post.title,
      kind: post.kind,
      created: post.created,
      updated: post.updated,
      revCount: post.revisions.length,
      preview: preview(post.body),
    });
  }
  rest.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  await putJson(bucket, "posts/_index.json", rest);
}

// ── public reads ──────────────────────────────────────────────

export async function listPosts(bucket) {
  return (await readJson(bucket, "posts/_index.json")) || [];
}

/** Full post, with revision metadata but not revision bodies. */
export async function getPost(bucket, slug) {
  if (!SLUG_RE.test(slug)) return null;
  const post = await readJson(bucket, `posts/${slug}.json`);
  if (!post) return null;
  return {
    ...post,
    revisions: (post.revisions || []).map(({ ts, note }) => ({ ts, note })),
  };
}

/** Revision history including full body snapshots (for changelog diffs). */
export async function getHistory(bucket, slug) {
  if (!SLUG_RE.test(slug)) return null;
  const post = await readJson(bucket, `posts/${slug}.json`);
  return post ? { slug, title: post.title, revisions: post.revisions || [] } : null;
}

// ── admin writes ──────────────────────────────────────────────

export async function createPost(bucket, { title, body, kind = "thought", slug }) {
  if (!title || typeof title !== "string") return { error: "Missing title" };
  if (!body || typeof body !== "string") return { error: "Missing body" };
  if (title.length > MAX_TITLE) return { error: "Title too long" };
  if (body.length > MAX_BODY) return { error: "Body too long" };
  if (!["thought", "post"].includes(kind)) return { error: "kind must be 'thought' or 'post'" };

  const s = slug ? String(slug) : slugify(title);
  if (!SLUG_RE.test(s)) return { error: "Invalid slug" };
  if (await bucket.head(`posts/${s}.json`)) return { error: "Post already exists", status: 409 };

  const ts = now();
  const post = {
    slug: s, title, kind, body,
    created: ts, updated: ts,
    revisions: [{ ts, note: "created", body }],
  };
  await putJson(bucket, `posts/${s}.json`, post);
  await updateIndex(bucket, post);
  return { post: { ...post, revisions: [{ ts, note: "created" }] } };
}

export async function updatePost(bucket, slug, { title, body, note }) {
  if (!SLUG_RE.test(slug)) return { error: "Invalid slug" };
  if (!note || typeof note !== "string") return { error: "A changelog 'note' is required" };
  if (body && body.length > MAX_BODY) return { error: "Body too long" };
  if (title && title.length > MAX_TITLE) return { error: "Title too long" };

  const post = await readJson(bucket, `posts/${slug}.json`);
  if (!post) return { error: "Post not found", status: 404 };

  const ts = now();
  if (typeof title === "string" && title) post.title = title;
  if (typeof body === "string" && body) post.body = body;
  post.updated = ts;
  post.revisions = [...(post.revisions || []), { ts, note: note.slice(0, 300), body: post.body }]
    .slice(-MAX_REVISIONS);

  await putJson(bucket, `posts/${slug}.json`, post);
  await updateIndex(bucket, post);
  return { post: { ...post, revisions: post.revisions.map(({ ts: t, note: n }) => ({ ts: t, note: n })) } };
}

export async function deletePost(bucket, slug) {
  if (!SLUG_RE.test(slug)) return { error: "Invalid slug" };
  const post = await readJson(bucket, `posts/${slug}.json`);
  if (!post) return { error: "Post not found", status: 404 };
  await bucket.delete(`posts/${slug}.json`);
  await updateIndex(bucket, post, { remove: true });
  return { ok: true };
}
