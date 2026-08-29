const GITHUB_AIRSPACE_URL = "https://raw.githubusercontent.com/sqdwz/hainan-airspace/main/data/latest.json";
const GITHUB_BRIEF_BASE_URL = "https://raw.githubusercontent.com/sqdwz/industry-brief/main/data";
const GITHUB_URBAN_RENEWAL_BASE_URL = "https://raw.githubusercontent.com/sqdwz/urban-renewal/main";
const GITHUB_URBAN_RENEWAL_URL = `${GITHUB_URBAN_RENEWAL_BASE_URL}/data/latest.json`;
const GITHUB_URBAN_RENEWAL_INDEX_URL = `${GITHUB_URBAN_RENEWAL_BASE_URL}/data/index.json`;
const GITHUB_POLICY_BASE_URL = "https://raw.githubusercontent.com/sqdwz/policy-library/main";
const MAX_JSON_BYTES = 1_000_000;
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
const BRIEF_ARCHIVE_PATH = /^data\/(daily|weekly)\/(\d{4}-\d{2}-\d{2})\.json$/;
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

  if (current.value !== body) {
    await env.INDUSTRY_BRIEF_DATA.put(key, body, {
      metadata: { source: "sqdwz/policy-library", path, syncedAt }
    });
    return { body, syncedAt, updated: true };
  }

  return { body, syncedAt: current.metadata?.syncedAt || syncedAt, updated: false };
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
  if (stored.value) {
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
    console.error("Policy record KV is empty and GitHub sync failed", { path, error: String(error) });
    const snapshotUrl = new URL(request.url);
    snapshotUrl.pathname = `/data/policy/${path.replace(/^data\//, "")}`;
    snapshotUrl.search = "";
    return env.ASSETS.fetch(new Request(snapshotUrl, request));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    const jobs = await Promise.allSettled([syncAirspaceData(env), syncIndustryBriefData(env), syncUrbanRenewalData(env), syncUrbanRenewalIndexData(env), syncPolicyData(env)]);
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
