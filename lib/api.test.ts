import { afterEach, describe, expect, it, vi } from "vitest";
import mission from "./mock/mission-M014.json";

// USE_MOCK is read when lib/api loads, so each case imports a fresh copy after setting env.
async function loadApi(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "false");
  vi.stubEnv("NEXT_PUBLIC_API_BASE", undefined);
  vi.stubEnv("VERCEL_URL", undefined);
  vi.stubEnv("PORT", undefined);
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("./api");
}

function mockFetch() {
  const fetch = vi.fn(async (input: string | URL | Request) => {
    new URL(String(input)); // Node's fetch rejects relative URLs; fail the same way here.
    return new Response(JSON.stringify(mission), { status: 200 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getAsset in mock mode", () => {
  it("loads a known asset", async () => {
    const { getAsset } = await loadApi({ NEXT_PUBLIC_USE_MOCK: "true" });
    await expect(getAsset("PANEL-212")).resolves.toMatchObject({ asset_id: "PANEL-212" });
  });

  it.each(["UNKNOWN", "toString", "constructor", "__proto__"])("returns null for unknown asset %s", async (id) => {
    const { getAsset } = await loadApi({ NEXT_PUBLIC_USE_MOCK: "true" });
    await expect(getAsset(id)).resolves.toBeNull();
  });
});

describe("getMission on the server with the real API", () => {
  it("uses the local Next server when no API base is set", async () => {
    const fetch = mockFetch();
    const { getMission } = await loadApi({});
    await expect(getMission("M014")).resolves.toMatchObject({ mission_id: "M014" });
    expect(fetch).toHaveBeenCalledWith("http://localhost:3000/api/missions/M014", expect.anything());
  });

  it("uses this deployment's own origin on Vercel", async () => {
    const fetch = mockFetch();
    const { getMission } = await loadApi({ VERCEL_URL: "watchdog-git-main.vercel.app" });
    await getMission("M014");
    expect(fetch).toHaveBeenCalledWith("https://watchdog-git-main.vercel.app/api/missions/M014", expect.anything());
  });

  it("prefers NEXT_PUBLIC_API_BASE and tolerates a trailing slash", async () => {
    const fetch = mockFetch();
    const { getMission } = await loadApi({ NEXT_PUBLIC_API_BASE: "https://api.example.test/", PORT: "4000" });
    await getMission("M014");
    expect(fetch).toHaveBeenCalledWith("https://api.example.test/api/missions/M014", expect.anything());
  });

  it("returns null for an unknown mission", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Not found" }), { status: 404 })));
    const { getMission } = await loadApi({});
    await expect(getMission("M999")).resolves.toBeNull();
  });
});
