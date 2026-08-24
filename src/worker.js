const GITHUB_AIRSPACE_URL = "https://raw.githubusercontent.com/sqdwz/hainan-airspace/main/data/latest.json";
const GITHUB_BRIEF_BASE_URL = "https://raw.githubusercontent.com/sqdwz/industry-brief/main/data";
const AIRSPACE_DATA_KEY = "airspace:latest";
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

  const body = await response.text();
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
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    const jobs = await Promise.allSettled([syncAirspaceData(env), syncIndustryBriefData(env)]);
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
      industryBrief: jobs[1].value
    });
  }
};
