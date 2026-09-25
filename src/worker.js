import { verifySecret } from "./knowledge-security.js";

const GITHUB_AIRSPACE_URL = "https://raw.githubusercontent.com/sqdwz/hainan-airspace/main/data/latest.json";
const GITHUB_BRIEF_BASE_URL = "https://raw.githubusercontent.com/sqdwz/industry-brief/main/data";
const GITHUB_URBAN_RENEWAL_BASE_URL = "https://raw.githubusercontent.com/sqdwz/urban-renewal/main";
const GITHUB_URBAN_RENEWAL_URL = `${GITHUB_URBAN_RENEWAL_BASE_URL}/data/latest.json`;
const GITHUB_URBAN_RENEWAL_INDEX_URL = `${GITHUB_URBAN_RENEWAL_BASE_URL}/data/index.json`;
const GITHUB_POLICY_BASE_URL = "https://raw.githubusercontent.com/sqdwz/policy-library/main";
const GITHUB_SHOWCASE_INDEX_URL = "https://raw.githubusercontent.com/sqdwz/demos-share/main/demos/index.json";
const MAX_JSON_BYTES = 1_000_000;
const POLICY_RECORD_MAX_AGE_MS = 15 * 60 * 1000;
const AIRSPACE_DATA_KEY = "airspace:latest";
const URBAN_RENEWAL_DATA_KEY = "urban-renewal:latest";
const URBAN_RENEWAL_INDEX_KEY = "urban-renewal:index";
const BRIEF_ENTRIES = {
  latest: {
    key: "industry-brief:latest",
    url: `${GITHUB_BRIEF_BASE_URL}/latest.json`
  },
  index: {
    key: "industry-brief:index",
    url: `${GITHUB_BRIEF_BASE_URL}/index.json`
  }
};
const BRIEF_ARCHIVE_PATH = /^data\/(?:daily\/\d{4}-\d{2}-\d{2}|weekly\/(?:\d{4}-\d{2}-\d{2}|\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])))\.json$/;
const POLICY_ENTRIES = {
  index: {
    key: "policy-library:index",
    url: `${GITHUB_POLICY_BASE_URL}/data/index.json`
  },
  categories: {
    key: "policy-library:categories",
    url: `${GITHUB_POLICY_BASE_URL}/data/categories.json`
  }
};
const SHOWCASE_KEY = "showcase:index";
const KNOWLEDGE_OWNER = "sqdwz";
const KNOWLEDGE_REPO = "personal-knowledge-base";
const KNOWLEDGE_BRANCH = "main";
const KNOWLEDGE_SESSION_COOKIE = "KB_SESSION";
const KNOWLEDGE_ACCESS_COOKIE = "KB_ACCESS";
const KNOWLEDGE_TOKEN_PREFIX = "knowledge-auth:token:";
const KNOWLEDGE_SESSION_TTL = 60 * 60 * 24 * 7;
const KNOWLEDGE_TOKEN_MAX_TTL = 60 * 60 * 24 * 30;
const SHOWCASE_CREATED_AT = {
  "ai-agent-geocode": "2026-09-16T16:27:32Z",
  "ai-gis-share": "2026-08-24T12:18:44Z",
  "vibe-coding-share-0730": "2026-08-24T12:18:52Z",
  "land-area-guide": "2026-09-21T15:37:48Z"
};

function jsonResponse(body, { storage, syncedAt, dataset } = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "X-Data-Storage": storage || "cloudflare-kv"
  });
  if (dataset) headers.set("X-Data-Set", dataset);
  if (syncedAt) headers.set("X-Data-Synced-At", syncedAt);
  return new Response(body, { headers });
}

async function fetchJsonFromGitHub(url) {
  const response = await fetch(url, {
    headers: { "Cache-Control": "no-cache" },
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);

  const declaredLength = Number(response.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_JSON_BYTES) throw new Error(`GitHub JSON exceeds ${MAX_JSON_BYTES} bytes`);

  if (!response.body) throw new Error("GitHub returned an empty response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new Error(`GitHub JSON exceeds ${MAX_JSON_BYTES} bytes`);
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  JSON.parse(body);
  return body;
}

async function syncAirspaceData(env) {
  const body = await fetchJsonFromGitHub(GITHUB_AIRSPACE_URL);
  const current = await env.AIRSPACE_DATA.getWithMetadata(AIRSPACE_DATA_KEY);
  const syncedAt = new Date().toISOString();

  if (current.value !== body) {
    await env.AIRSPACE_DATA.put(AIRSPACE_DATA_KEY, body, {
      metadata: { source: "sqdwz/hainan-airspace", syncedAt }
    });
    return { body, syncedAt, updated: true };
  }

  return { body, syncedAt: current.metadata?.syncedAt || syncedAt, updated: false };
}

async function serveAirspaceData(request, env) {
  const stored = await env.AIRSPACE_DATA.getWithMetadata(AIRSPACE_DATA_KEY);
  if (stored.value) {
    return jsonResponse(stored.value, {
      storage: "cloudflare-kv",
      syncedAt: stored.metadata?.syncedAt,
      dataset: "airspace"
    });
  }

  try {
    const synced = await syncAirspaceData(env);
    return jsonResponse(synced.body, { storage: "cloudflare-kv", syncedAt: synced.syncedAt, dataset: "airspace" });
  } catch (error) {
    console.error("Cloudflare KV is empty and GitHub sync failed", error);
    return env.ASSETS.fetch(request);
  }
}

async function syncIndustryBriefEntry(env, entry) {
  const body = await fetchJsonFromGitHub(entry.url);
  const current = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(entry.key);
  const syncedAt = new Date().toISOString();

  if (current.value !== body) {
    await env.INDUSTRY_BRIEF_DATA.put(entry.key, body, {
      metadata: { source: "sqdwz/industry-brief", syncedAt }
    });
    return { body, syncedAt, updated: true };
  }

  return { body, syncedAt: current.metadata?.syncedAt || syncedAt, updated: false };
}

async function syncIndustryBriefData(env) {
  const [latest, index] = await Promise.all([
    syncIndustryBriefEntry(env, BRIEF_ENTRIES.latest),
    syncIndustryBriefEntry(env, BRIEF_ENTRIES.index)
  ]);
  return { latest, index };
}

async function syncPolicyEntry(env, entry) {
  const body = await fetchJsonFromGitHub(entry.url);
  const current = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(entry.key);
  const syncedAt = new Date().toISOString();

  if (current.value !== body) {
    await env.INDUSTRY_BRIEF_DATA.put(entry.key, body, {
      metadata: { source: "sqdwz/policy-library", syncedAt }
    });
    return { body, syncedAt, updated: true };
  }

  return { body, syncedAt: current.metadata?.syncedAt || syncedAt, updated: false };
}

async function syncPolicyData(env) {
  const [index, categories] = await Promise.all([
    syncPolicyEntry(env, POLICY_ENTRIES.index),
    syncPolicyEntry(env, POLICY_ENTRIES.categories)
  ]);
  return { index, categories };
}

function isValidPolicyRecordPath(path) {
  return /^data\/records\/[A-Za-z0-9._-]+\.json$/.test(path || "");
}

function policyRecordKey(path) {
  return `policy-library:record:${path}`;
}

async function syncPolicyRecord(env, path) {
  const body = await fetchJsonFromGitHub(`${GITHUB_POLICY_BASE_URL}/${path}`);
  const key = policyRecordKey(path);
  const current = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(key);
  const syncedAt = new Date().toISOString();
  const updated = current.value !== body;

  await env.INDUSTRY_BRIEF_DATA.put(key, body, {
    metadata: { source: "sqdwz/policy-library", path, syncedAt }
  });
  return { body, syncedAt, updated };
}

function privateJson(body, status = 200, extraHeaders = {}) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (Array.isArray(value)) value.forEach(item => headers.append(key, item));
    else headers.set(key, value);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers
  });
}

function base64UrlEncode(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

async function digestHex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function signSession(payload, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

async function getKnowledgeSession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${KNOWLEDGE_SESSION_COOKIE}=([^;]+)`));
  if (!match || !env.KNOWLEDGE_PASSWORD) return false;
  try {
    const [payload, signature] = match[1].split(".");
    const expected = await signSession(payload, env.KNOWLEDGE_PASSWORD);
    if (!(await verifySecret(signature, expected))) return false;
    const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    return data.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

function knowledgeCookie(value, maxAge = KNOWLEDGE_SESSION_TTL) {
  return `${KNOWLEDGE_SESSION_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function knowledgeAccessCookie(value, maxAge) {
  return `${KNOWLEDGE_ACCESS_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function knowledgeAuthStore(env) {
  return env.KNOWLEDGE_AUTH;
}

function tokenFromRequest(request) {
  const authorization = request.headers.get("Authorization") || "";
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, "").trim();
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${KNOWLEDGE_ACCESS_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function randomAccessToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `kb_${base64UrlEncode(bytes)}`;
}

async function accessTokenKey(token) {
  return `${KNOWLEDGE_TOKEN_PREFIX}${await digestHex(token)}`;
}

async function readAccessToken(env, token) {
  if (!token || !knowledgeAuthStore(env)) return null;
  const raw = await knowledgeAuthStore(env).get(await accessTokenKey(token));
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    if (!record.expiresAt || record.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return { ...record, token };
  } catch { return null; }
}

async function getKnowledgeToken(request, env) {
  return readAccessToken(env, tokenFromRequest(request));
}

async function getKnowledgeAuth(request, env) {
  if (await getKnowledgeSession(request, env)) return { kind: "session", role: "owner", scope: "all" };
  const token = await getKnowledgeToken(request, env);
  if (!token) return null;
  return token;
}

function tokenTtl(value) {
  const ttl = Number(value);
  if (!Number.isFinite(ttl)) return 60 * 60 * 24 * 7;
  return Math.min(Math.max(Math.floor(ttl), 60), KNOWLEDGE_TOKEN_MAX_TTL);
}

function tokenCanReadItem(auth, item) {
  if (!auth || auth.scope === "all") return Boolean(auth);
  const ids = Array.isArray(auth.ids) ? auth.ids : [];
  const categories = Array.isArray(auth.categories) ? auth.categories : [];
  return ids.includes(item.id) || (item.category && categories.includes(item.category));
}

function requestIsSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function checkKnowledgeLoginRateLimit(request, env) {
  if (!env.KNOWLEDGE_LOGIN_RATE_LIMITER) return { configured: false, allowed: false };
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const result = await env.KNOWLEDGE_LOGIN_RATE_LIMITER.limit({ key: `knowledge-login:${ip}` });
  return { configured: true, allowed: Boolean(result.success) };
}

async function issueKnowledgeToken(env, { ttl, ids = [], categories = [] }) {
  const token = randomAccessToken();
  const expiresAt = Math.floor(Date.now() / 1000) + tokenTtl(ttl);
  const record = {
    kind: "share",
    scope: "limited",
    ids: ids.slice(0, 100),
    categories: categories.slice(0, 50),
    createdAt: Math.floor(Date.now() / 1000),
    expiresAt
  };
  await knowledgeAuthStore(env).put(await accessTokenKey(token), JSON.stringify(record), { expiration: expiresAt });
  return { token, ...record };
}

function knowledgeConfig(env) {
  return {
    owner: env.KNOWLEDGE_GITHUB_OWNER || KNOWLEDGE_OWNER,
    repo: env.KNOWLEDGE_GITHUB_REPO || KNOWLEDGE_REPO,
    branch: env.KNOWLEDGE_GITHUB_BRANCH || KNOWLEDGE_BRANCH,
    token: env.KNOWLEDGE_GITHUB_TOKEN
  };
}

async function githubKnowledgeRequest(env, path, options = {}) {
  const config = knowledgeConfig(env);
  if (!config.token) throw new Error("Knowledge GitHub token is not configured");
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path.replace(/^\/+/, "")}${options.query ? `?${options.query}` : ""}`, {
    ...options,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${config.token}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "sqdwz-information-hub", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response;
}

function decodeGithubContent(content) {
  const bytes = Uint8Array.from(atob(String(content).replace(/\s/g, "")), char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function readKnowledgeFile(env, path) {
  const response = await githubKnowledgeRequest(env, path, { query: `ref=${encodeURIComponent(knowledgeConfig(env).branch)}` });
  const data = await response.json();
  return { content: decodeGithubContent(data.content), sha: data.sha, path: data.path };
}

function safeKnowledgeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

async function knowledgeManifest(env) {
  try { return JSON.parse((await readKnowledgeFile(env, "index/manifest.json")).content); }
  catch { return { schema_version: 1, updated_at: null, months: [], note_count: 0 }; }
}

async function knowledgeIndexItems(env, auth) {
  const manifest = await knowledgeManifest(env);
  const months = Array.isArray(manifest.months) ? manifest.months.map(value => typeof value === "string" ? value : value.month).filter(Boolean) : [];
  const monthResults = await Promise.all(months.map(async month => {
    try { return JSON.parse((await readKnowledgeFile(env, `index/${month}.json`)).content).items || []; } catch { return []; }
  }));
  const items = monthResults.flat().filter(item => tokenCanReadItem(auth, item)).sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
  return { manifest, months, items };
}

async function serveKnowledgeIndex(request, env) {
  const auth = await getKnowledgeAuth(request, env);
  if (!auth) return privateJson({ error: "Authentication required" }, 401);
  const { manifest, items } = await knowledgeIndexItems(env, auth);
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))].sort();
  return privateJson({ ...manifest, items, categories });
}

function normalizedKnowledgeText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN");
}

async function serveKnowledgeSearch(request, env, url) {
  const auth = await getKnowledgeAuth(request, env);
  if (!auth) return privateJson({ error: "Authentication required" }, 401);
  const query = normalizedKnowledgeText(url.searchParams.get("q")).trim().slice(0, 80);
  if (query.length < 2) return privateJson({ error: "Search query must contain at least 2 characters" }, 400);

  const { items, months } = await knowledgeIndexItems(env, auth);
  const matches = [];
  const pending = [];
  for (const item of items) {
    const metadata = normalizedKnowledgeText([item.title, item.summary, item.category, item.project, item.project_name, ...(item.tags || [])].join(" "));
    if (metadata.includes(query)) matches.push(item);
    else pending.push(item);
  }

  // Body search is intentionally bounded so a large private archive cannot exhaust
  // Worker subrequests. Index-field matches are never truncated.
  // Leave headroom below the Workers Free external-subrequest ceiling after
  // reading the manifest and every monthly index file.
  const contentLimit = Math.max(0, Math.min(40, 46 - months.length));
  const candidates = pending.slice(0, contentLimit);
  for (let start = 0; start < candidates.length; start += 6) {
    const batch = candidates.slice(start, start + 6);
    const results = await Promise.all(batch.map(async item => {
      try {
        const path = item.path || `notes/${String(item.created_at || "").slice(0, 7).replace("-", "/")}/${item.id}.md`;
        const note = await readKnowledgeFile(env, path);
        return normalizedKnowledgeText(note.content.replace(/^---[\s\S]*?---\s*/, "")).includes(query) ? item : null;
      } catch { return null; }
    }));
    matches.push(...results.filter(Boolean));
  }

  const order = new Map(items.map((item, index) => [item.id, index]));
  matches.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return privateJson({ query, items: matches, content_truncated: pending.length > contentLimit });
}

async function serveKnowledgeItem(request, env, url) {
  const auth = await getKnowledgeAuth(request, env);
  if (!auth) return privateJson({ error: "Authentication required" }, 401);
  const id = safeKnowledgeId(url.searchParams.get("id"));
  if (!id) return privateJson({ error: "Invalid id" }, 400);
  const manifest = await knowledgeManifest(env);
  const months = Array.isArray(manifest.months) ? manifest.months.map(value => typeof value === "string" ? value : value.month).filter(Boolean) : [];
  for (const month of months) {
    try {
      const data = JSON.parse((await readKnowledgeFile(env, `index/${month}.json`)).content);
      const entry = (data.items || []).find(item => item.id === id);
      if (entry) {
        if (!tokenCanReadItem(auth, entry)) return privateJson({ error: "Not found" }, 404);
        const path = entry.path || `notes/${month.replace("-", "/")}/${id}.md`;
        const note = await readKnowledgeFile(env, path);
        return privateJson({ ...entry, content: note.content.replace(/^---[\s\S]*?---\s*/, "") });
      }
    } catch { /* try the next month */ }
  }
  return privateJson({ error: "Not found" }, 404);
}

async function serveKnowledge(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/knowledge/session") {
    const auth = await getKnowledgeAuth(request, env);
    return privateJson({ authenticated: Boolean(auth), kind: auth?.kind || null, expiresAt: auth?.expiresAt || null });
  }
  if (request.method === "POST" && url.pathname === "/api/knowledge/login") {
    if (!env.KNOWLEDGE_PASSWORD) return privateJson({ error: "Authentication is not configured" }, 503);
    const rateLimit = await checkKnowledgeLoginRateLimit(request, env);
    if (!rateLimit.configured) return privateJson({ error: "Login protection is not configured" }, 503);
    if (!rateLimit.allowed) return privateJson({ error: "Too many login attempts. Try again later." }, 429, { "Retry-After": "60" });
    const body = await request.json().catch(() => ({}));
    if (!(await verifySecret(body.password, env.KNOWLEDGE_PASSWORD))) return privateJson({ error: "Invalid credentials" }, 401);
    const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + KNOWLEDGE_SESSION_TTL })));
    const session = `${payload}.${await signSession(payload, env.KNOWLEDGE_PASSWORD)}`;
    return privateJson({ authenticated: true }, 200, { "Set-Cookie": knowledgeCookie(session) });
  }
  if (request.method === "POST" && url.pathname === "/api/knowledge/token/exchange") {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const record = await readAccessToken(env, token);
    if (!record) return privateJson({ error: "Invalid or expired token" }, 401);
    return privateJson({ authenticated: true, kind: record.kind, expiresAt: record.expiresAt }, 200, { "Set-Cookie": knowledgeAccessCookie(token, Math.max(60, record.expiresAt - Math.floor(Date.now() / 1000))) });
  }
  if (request.method === "POST" && url.pathname === "/api/knowledge/tokens") {
    if (!requestIsSameOrigin(request) || !(await getKnowledgeSession(request, env))) return privateJson({ error: "Authentication required" }, 401);
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map(value => safeKnowledgeId(value)).filter(Boolean) : [];
    const categories = Array.isArray(body.categories) ? body.categories.map(value => String(value).slice(0, 80)).filter(Boolean) : [];
    const result = await issueKnowledgeToken(env, { ttl: body.ttl, ids, categories });
    return privateJson(result, 201);
  }
  if (request.method === "POST" && url.pathname === "/api/knowledge/tokens/revoke") {
    if (!requestIsSameOrigin(request) || !(await getKnowledgeSession(request, env))) return privateJson({ error: "Authentication required" }, 401);
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    if (!token) return privateJson({ error: "Token required" }, 400);
    await knowledgeAuthStore(env).delete(await accessTokenKey(token));
    return privateJson({ ok: true });
  }
  if (request.method === "POST" && url.pathname === "/api/knowledge/logout") return privateJson({ ok: true }, 200, { "Set-Cookie": [knowledgeCookie("", 0), knowledgeAccessCookie("", 0)] });
  if (url.pathname === "/api/knowledge/index") return serveKnowledgeIndex(request, env);
  if (url.pathname === "/api/knowledge/search") return serveKnowledgeSearch(request, env, url);
  if (url.pathname === "/api/knowledge/item") return serveKnowledgeItem(request, env, url);
  return privateJson({ error: "Not found" }, 404);
}

async function serveShowcaseIndex(request, env) {
  const stored = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(SHOWCASE_KEY);
  if (stored.value) {
    return jsonResponse(normalizeShowcaseIndex(stored.value), {
      storage: "cloudflare-kv",
      syncedAt: stored.metadata?.syncedAt,
      dataset: "showcase:index"
    });
  }

  try {
    const body = normalizeShowcaseIndex(await fetchJsonFromGitHub(GITHUB_SHOWCASE_INDEX_URL));
    const syncedAt = new Date().toISOString();
    await env.INDUSTRY_BRIEF_DATA.put(SHOWCASE_KEY, body, {
      metadata: { source: "sqdwz/demos-share", syncedAt }
    });
    return jsonResponse(body, { storage: "cloudflare-kv", syncedAt, dataset: "showcase:index" });
  } catch (error) {
    console.error("Showcase index sync failed", error);
    return env.ASSETS.fetch(request);
  }
}

function normalizeShowcaseIndex(body) {
  const data = JSON.parse(body);
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (!item.created_at && SHOWCASE_CREATED_AT[item.slug]) item.created_at = SHOWCASE_CREATED_AT[item.slug];
    }
  }
  return JSON.stringify(data);
}

async function syncUrbanRenewalData(env) {
  const body = await fetchJsonFromGitHub(GITHUB_URBAN_RENEWAL_URL);
  const current = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(URBAN_RENEWAL_DATA_KEY);
  const syncedAt = new Date().toISOString();

  if (current.value !== body) {
    await env.INDUSTRY_BRIEF_DATA.put(URBAN_RENEWAL_DATA_KEY, body, {
      metadata: { source: "sqdwz/urban-renewal", syncedAt }
    });
    return { body, syncedAt, updated: true };
  }

  return { body, syncedAt: current.metadata?.syncedAt || syncedAt, updated: false };
}

async function syncUrbanRenewalIndexData(env) {
  const body = await fetchJsonFromGitHub(GITHUB_URBAN_RENEWAL_INDEX_URL);
  const current = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(URBAN_RENEWAL_INDEX_KEY);
  const syncedAt = new Date().toISOString();

  if (current.value !== body) {
    await env.INDUSTRY_BRIEF_DATA.put(URBAN_RENEWAL_INDEX_KEY, body, {
      metadata: { source: "sqdwz/urban-renewal", syncedAt }
    });
    return { body, syncedAt, updated: true };
  }

  return { body, syncedAt: current.metadata?.syncedAt || syncedAt, updated: false };
}

function isValidUrbanHistoryPath(path) {
  return /^data\/history\/[A-Za-z0-9._-]+\.json$/.test(path || "");
}

function urbanHistoryKey(path) {
  return `urban-renewal:history:${path}`;
}

async function syncUrbanHistoryData(env, path) {
  const body = await fetchJsonFromGitHub(`${GITHUB_URBAN_RENEWAL_BASE_URL}/${path}`);
  const key = urbanHistoryKey(path);
  const current = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(key);
  const syncedAt = new Date().toISOString();

  if (current.value !== body) {
    await env.INDUSTRY_BRIEF_DATA.put(key, body, {
      metadata: { source: "sqdwz/urban-renewal", path, syncedAt }
    });
    return { body, syncedAt, updated: true };
  }

  return { body, syncedAt: current.metadata?.syncedAt || syncedAt, updated: false };
}

async function serveUrbanRenewalData(request, env) {
  const stored = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(URBAN_RENEWAL_DATA_KEY);
  if (stored.value) {
    return jsonResponse(stored.value, {
      storage: "cloudflare-kv",
      syncedAt: stored.metadata?.syncedAt,
      dataset: "urban-renewal:latest"
    });
  }

  try {
    const synced = await syncUrbanRenewalData(env);
    return jsonResponse(synced.body, {
      storage: "cloudflare-kv",
      syncedAt: synced.syncedAt,
      dataset: "urban-renewal:latest"
    });
  } catch (error) {
    console.error("Urban renewal KV is empty and GitHub sync failed", error);
    return env.ASSETS.fetch(request);
  }
}

async function serveUrbanRenewalIndexData(request, env) {
  const stored = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(URBAN_RENEWAL_INDEX_KEY);
  if (stored.value) {
    return jsonResponse(stored.value, {
      storage: "cloudflare-kv",
      syncedAt: stored.metadata?.syncedAt,
      dataset: "urban-renewal:index"
    });
  }

  try {
    const synced = await syncUrbanRenewalIndexData(env);
    return jsonResponse(synced.body, {
      storage: "cloudflare-kv",
      syncedAt: synced.syncedAt,
      dataset: "urban-renewal:index"
    });
  } catch (error) {
    console.error("Urban renewal index KV is empty and GitHub sync failed", error);
    return env.ASSETS.fetch(request);
  }
}

async function serveUrbanHistoryData(request, env, path) {
  if (!isValidUrbanHistoryPath(path)) return new Response("Invalid history path", { status: 400 });
  const key = urbanHistoryKey(path);
  const stored = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(key);
  if (stored.value) {
    return jsonResponse(stored.value, {
      storage: "cloudflare-kv",
      syncedAt: stored.metadata?.syncedAt,
      dataset: "urban-renewal:history"
    });
  }

  try {
    const synced = await syncUrbanHistoryData(env, path);
    return jsonResponse(synced.body, {
      storage: "cloudflare-kv",
      syncedAt: synced.syncedAt,
      dataset: "urban-renewal:history"
    });
  } catch (error) {
    console.error("Urban renewal history KV is empty and GitHub sync failed", { path, error: String(error) });
    return env.ASSETS.fetch(request);
  }
}

async function serveIndustryBriefData(request, env, entry, label) {
  const stored = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(entry.key);
  if (stored.value) {
    return jsonResponse(stored.value, {
      storage: "cloudflare-kv",
      syncedAt: stored.metadata?.syncedAt,
      dataset: `industry-brief:${label}`
    });
  }

  try {
    const synced = await syncIndustryBriefEntry(env, entry);
    return jsonResponse(synced.body, {
      storage: "cloudflare-kv",
      syncedAt: synced.syncedAt,
      dataset: `industry-brief:${label}`
    });
  } catch (error) {
    console.error("Industry brief KV is empty and GitHub sync failed", { label, error: String(error) });
    return env.ASSETS.fetch(request);
  }
}

function createIndustryBriefArchiveEntry(path) {
  if (!BRIEF_ARCHIVE_PATH.test(path || "")) return null;
  return {
    key: `industry-brief:archive:${path}`,
    url: `${GITHUB_BRIEF_BASE_URL}/${path.replace(/^data\//, "")}`
  };
}

async function servePolicyData(request, env, entry, label) {
  const stored = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(entry.key);
  if (stored.value) {
    return jsonResponse(stored.value, {
      storage: "cloudflare-kv",
      syncedAt: stored.metadata?.syncedAt,
      dataset: `policy-library:${label}`
    });
  }

  try {
    const synced = await syncPolicyEntry(env, entry);
    return jsonResponse(synced.body, {
      storage: "cloudflare-kv",
      syncedAt: synced.syncedAt,
      dataset: `policy-library:${label}`
    });
  } catch (error) {
    console.error("Policy library KV is empty and GitHub sync failed", { label, error: String(error) });
    return env.ASSETS.fetch(request);
  }
}

async function servePolicyRecord(request, env, path) {
  if (!isValidPolicyRecordPath(path)) return new Response("Invalid policy record path", { status: 400 });
  const key = policyRecordKey(path);
  const stored = await env.INDUSTRY_BRIEF_DATA.getWithMetadata(key);
  const storedAt = Date.parse(stored.metadata?.syncedAt || "");
  const isFresh = Number.isFinite(storedAt) && Date.now() - storedAt < POLICY_RECORD_MAX_AGE_MS;
  if (stored.value && isFresh) {
    return jsonResponse(stored.value, {
      storage: "cloudflare-kv",
      syncedAt: stored.metadata?.syncedAt,
      dataset: "policy-library:record"
    });
  }

  try {
    const synced = await syncPolicyRecord(env, path);
    return jsonResponse(synced.body, {
      storage: "cloudflare-kv",
      syncedAt: synced.syncedAt,
      dataset: "policy-library:record"
    });
  } catch (error) {
    console.error("Policy record refresh failed", { path, error: String(error) });
    if (stored.value) {
      return jsonResponse(stored.value, {
        storage: "cloudflare-kv-stale",
        syncedAt: stored.metadata?.syncedAt,
        dataset: "policy-library:record"
      });
    }
    const snapshotUrl = new URL(request.url);
    snapshotUrl.pathname = `/data/policy/${path.replace(/^data\//, "")}`;
    snapshotUrl.search = "";
    return env.ASSETS.fetch(new Request(snapshotUrl, request));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/knowledge/")) return serveKnowledge(request, env, url);
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/airspace.json") {
      return serveAirspaceData(request, env);
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/brief/latest.json") {
      return serveIndustryBriefData(request, env, BRIEF_ENTRIES.latest, "latest");
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/brief/index.json") {
      return serveIndustryBriefData(request, env, BRIEF_ENTRIES.index, "index");
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/brief/archive") {
      const path = url.searchParams.get("path");
      const entry = createIndustryBriefArchiveEntry(path);
      if (!entry) {
        return new Response(JSON.stringify({ error: "Invalid archive path" }), {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
        });
      }
      return serveIndustryBriefData(request, env, entry, `archive:${path}`);
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/urban-renewal/latest.json") {
      return serveUrbanRenewalData(request, env);
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/urban-renewal/index.json") {
      return serveUrbanRenewalIndexData(request, env);
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/urban-renewal/history") {
      return serveUrbanHistoryData(request, env, url.searchParams.get("path"));
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/policy/index.json") {
      return servePolicyData(request, env, POLICY_ENTRIES.index, "index");
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/policy/categories.json") {
      return servePolicyData(request, env, POLICY_ENTRIES.categories, "categories");
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/policy/document") {
      return servePolicyRecord(request, env, url.searchParams.get("path"));
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/showcase/index.json") {
      return serveShowcaseIndex(request, env);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    const jobs = await Promise.allSettled([syncAirspaceData(env), syncIndustryBriefData(env), syncUrbanRenewalData(env), syncUrbanRenewalIndexData(env), syncPolicyData(env), (async () => {
      const body = normalizeShowcaseIndex(await fetchJsonFromGitHub(GITHUB_SHOWCASE_INDEX_URL));
      const syncedAt = new Date().toISOString();
      const current = await env.INDUSTRY_BRIEF_DATA.get(SHOWCASE_KEY);
      if (current !== body) await env.INDUSTRY_BRIEF_DATA.put(SHOWCASE_KEY, body, { metadata: { source: "sqdwz/demos-share", syncedAt } });
      return { syncedAt, updated: current !== body };
    })()]);
    const failures = jobs.filter((job) => job.status === "rejected");
    if (failures.length) {
      controller.noRetry();
      console.error("Scheduled data sync failed", {
        cron: controller.cron,
        failures: failures.map((job) => String(job.reason))
      });
      return;
    }
    console.log("Scheduled data sync completed", {
      cron: controller.cron,
      airspace: jobs[0].value,
      industryBrief: jobs[1].value,
      urbanRenewal: jobs[2].value,
      urbanRenewalIndex: jobs[3].value,
      policyLibrary: jobs[4].value
    });
  }
};
