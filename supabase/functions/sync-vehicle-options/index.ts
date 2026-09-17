// Refreshes the vehicle_makes / vehicle_models cache from NHTSA vPIC so the
// "Get Verified by Driveline" form can offer real year/make/model options.
//
// Invoke with the service role key (or VEHICLE_SYNC_SECRET):
//   curl -X POST "$SUPABASE_URL/functions/v1/sync-vehicle-options" \
//     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
//
// Optional JSON body or query params: startYear, endYear, makes, types.
// Defaults cover the makes and body styles Driveline builds around; vPIC's
// full make list runs to roughly eleven thousand entries, most of them
// trailer and equipment manufacturers that would swamp the dropdown.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const vpicBase = "https://vpic.nhtsa.dot.gov/api/vehicles";

const defaultMakes = [
  "Toyota",
  "Ford",
  "Chevrolet",
  "GMC",
  "Ram",
  "Dodge",
  "Jeep",
  "Nissan",
  "Honda",
  "Rivian"
];

// "truck" alone misses body-on-frame SUVs like the 4Runner, Tahoe, and
// Wrangler, which vPIC classifies as multipurpose passenger vehicles.
const defaultVehicleTypes = ["truck", "mpv"];

const earliestSupportedYear = 1995;

// vPIC answers bursts with 403, so keep concurrency low and pace each worker.
// A full 1995-onward backfill therefore needs to be run in year batches via
// the startYear/endYear params rather than in a single invocation.
const vpicConcurrency = 2;
const vpicRequestSpacingMs = 200;
const vpicMaxAttempts = 4;

// Share of lookups allowed to fail before the run is reported as unhealthy.
const failureRatioThreshold = 0.1;

const upsertChunkSize = 500;
const pageSize = 1000;

type SyncOptions = {
  startYear: number;
  endYear: number;
  makes: string[];
  types: string[];
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST to run the vehicle options sync." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase environment variables for vehicle options sync.");
    return jsonResponse({ error: "Vehicle options sync is not configured." }, 500);
  }

  if (!isAuthorized(request, serviceRoleKey)) {
    return jsonResponse({ error: "Not authorized to run the vehicle options sync." }, 401);
  }

  try {
    const options = await readSyncOptions(request);
    const started = Date.now();

    const makeIds = await upsertMakes(supabaseUrl, serviceRoleKey, options.makes);
    const { models, attempted, failed } = await collectModels(options, makeIds);
    const written = await upsertModels(supabaseUrl, serviceRoleKey, models);

    // A run where most vPIC lookups failed still writes rows, so report the
    // failure count instead of a bare success the caller cannot act on.
    const healthy = attempted === 0 || failed / attempted <= failureRatioThreshold;

    return jsonResponse(
      {
        ok: healthy,
        startYear: options.startYear,
        endYear: options.endYear,
        makes: options.makes.length,
        vehicleTypes: options.types,
        lookupsAttempted: attempted,
        lookupsFailed: failed,
        modelsWritten: written,
        elapsedMs: Date.now() - started,
        ...(healthy ? {} : { error: "Too many vPIC lookups failed; rerun with a smaller year range." })
      },
      healthy ? 200 : 502
    );
  } catch (error) {
    console.error("Vehicle options sync failed", error);
    return jsonResponse(
      {
        error: "Vehicle options sync failed.",
        details: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
});

function isAuthorized(request: Request, serviceRoleKey: string) {
  const bearer = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const secretHeader = (request.headers.get("x-sync-secret") ?? "").trim();
  const syncSecret = Deno.env.get("VEHICLE_SYNC_SECRET");

  if (bearer && bearer === serviceRoleKey) return true;
  if (syncSecret && (secretHeader === syncSecret || bearer === syncSecret)) return true;

  return false;
}

async function readSyncOptions(request: Request): Promise<SyncOptions> {
  const url = new URL(request.url);
  let body: Record<string, unknown> = {};

  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // A missing or non-JSON body just means "use the defaults".
  }

  const pick = (key: string) => {
    const fromBody = body[key];
    if (typeof fromBody === "string" || typeof fromBody === "number") return String(fromBody);
    if (Array.isArray(fromBody)) return fromBody.join(",");
    return url.searchParams.get(key) ?? "";
  };

  const latestYear = new Date().getFullYear() + 1;

  // A scheduled run only needs to refresh recent model years; pass startYear
  // explicitly (in batches) to backfill older ones.
  const defaultStartYear = numberFromEnv("VEHICLE_SYNC_START_YEAR", latestYear - 2);
  const startYear = clampYear(Number(pick("startYear")) || defaultStartYear, latestYear);
  const endYear = clampYear(Number(pick("endYear")) || latestYear, latestYear);

  const makes = splitList(pick("makes")) ?? splitList(Deno.env.get("VEHICLE_SYNC_MAKES") ?? "") ?? defaultMakes;
  const types = splitList(pick("types")) ?? splitList(Deno.env.get("VEHICLE_SYNC_TYPES") ?? "") ?? defaultVehicleTypes;

  return {
    startYear: Math.min(startYear, endYear),
    endYear: Math.max(startYear, endYear),
    makes,
    types
  };
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampYear(year: number, latestYear: number) {
  if (!Number.isFinite(year)) return latestYear;
  return Math.min(Math.max(Math.trunc(year), earliestSupportedYear), latestYear);
}

function splitList(value: string) {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : null;
}

async function upsertMakes(supabaseUrl: string, serviceRoleKey: string, makes: string[]) {
  await restRequest(supabaseUrl, serviceRoleKey, "vehicle_makes?on_conflict=name", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(makes.map((name) => ({ name })))
  });

  const wanted = new Set(makes.map((name) => name.toLowerCase()));
  const ids = new Map<string, number>();

  for (let from = 0; ; from += pageSize) {
    const rows = (await restRequest(
      supabaseUrl,
      serviceRoleKey,
      `vehicle_makes?select=id,name&order=id&offset=${from}&limit=${pageSize}`
    )) as Array<{ id: number; name: string }>;

    for (const row of rows) {
      if (wanted.has(row.name.toLowerCase())) ids.set(row.name.toLowerCase(), row.id);
    }

    if (rows.length < pageSize) break;
  }

  const missing = makes.filter((name) => !ids.has(name.toLowerCase()));
  if (missing.length) throw new Error(`Could not resolve make ids for: ${missing.join(", ")}`);

  return ids;
}

async function collectModels(options: SyncOptions, makeIds: Map<string, number>) {
  const jobs: Array<{ make: string; year: number; type: string }> = [];

  for (let year = options.startYear; year <= options.endYear; year += 1) {
    for (const make of options.makes) {
      for (const type of options.types) {
        jobs.push({ make, year, type });
      }
    }
  }

  const seen = new Set<string>();
  const models: Array<{ make_id: number; model_name: string; model_year: number }> = [];
  let cursor = 0;
  let failed = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;

      const result = await fetchVpicModels(job.make, job.year, job.type);
      if (!result.ok) failed += 1;

      const makeId = makeIds.get(job.make.toLowerCase());
      if (makeId === undefined) continue;

      for (const name of result.names) {
        const key = `${makeId}|${name.toLowerCase()}|${job.year}`;
        if (seen.has(key)) continue;
        seen.add(key);
        models.push({ make_id: makeId, model_name: name, model_year: job.year });
      }

      await delay(vpicRequestSpacingMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(vpicConcurrency, jobs.length) }, () => worker()));

  return { models, attempted: jobs.length, failed };
}

async function fetchVpicModels(make: string, year: number, vehicleType: string) {
  const url =
    `${vpicBase}/GetModelsForMakeYear/make/${encodeURIComponent(make)}` +
    `/modelyear/${year}/vehicleType/${encodeURIComponent(vehicleType)}?format=json`;

  for (let attempt = 1; attempt <= vpicMaxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });

      // vPIC uses 403 for throttling, so back off rather than giving up.
      if (!response.ok) throw new Error(`vPIC responded ${response.status}`);

      const payload = (await response.json()) as { Results?: Array<{ Model_Name?: string }> };

      return {
        ok: true,
        names: (payload.Results ?? []).map((result) => (result.Model_Name ?? "").trim()).filter(Boolean)
      };
    } catch (error) {
      if (attempt === vpicMaxAttempts) {
        console.error(`vPIC lookup failed for ${make} ${year} ${vehicleType}`, error);
        return { ok: false, names: [] as string[] };
      }

      await delay(500 * 2 ** (attempt - 1));
    }
  }

  return { ok: false, names: [] as string[] };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertModels(
  supabaseUrl: string,
  serviceRoleKey: string,
  models: Array<{ make_id: number; model_name: string; model_year: number }>
) {
  for (let index = 0; index < models.length; index += upsertChunkSize) {
    const chunk = models.slice(index, index + upsertChunkSize);

    await restRequest(supabaseUrl, serviceRoleKey, "vehicle_models?on_conflict=make_id,model_name,model_year", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(chunk)
    });
  }

  return models.length;
}

async function restRequest(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {}
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase request to ${path} failed with ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
