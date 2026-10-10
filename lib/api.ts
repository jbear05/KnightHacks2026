// Fetch helpers. Components call these and never read CSVs or hit fetch directly,
// so switching from fixtures to the real backend is one flag: NEXT_PUBLIC_USE_MOCK.
import insightsMock from "./mock/insights.json";
import missionM014 from "./mock/mission-M014.json";
import missionsMock from "./mock/missions.json";
import type { ApiError, AssetDetail, Decision, Insights, MissionDetail, MissionSummary, Problem } from "./types";

// Mock until Backend's API is live; set NEXT_PUBLIC_USE_MOCK=false to use it.
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

/**
 * Absolute URL for an API path. In the browser a relative path is fine (same origin).
 * Server components run in Node, where fetch needs an absolute URL, so they use
 * NEXT_PUBLIC_API_BASE, else this deployment's own origin (Vercel's VERCEL_URL),
 * else the local Next server.
 */
export function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");
  if (base || typeof window !== "undefined") return `${base}${path}`;
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT ?? 3000}`;
  return `${origin}${path}`;
}

const MOCK_MISSIONS: Record<string, MissionDetail> = {
  M014: missionM014 as MissionDetail,
};

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

/** GET /api/missions/:id. Returns null for an unknown mission. */
export async function getMission(id: string): Promise<MissionDetail | null> {
  if (USE_MOCK) return MOCK_MISSIONS[id] ?? null;
  try {
    return await request<MissionDetail>(`/api/missions/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 404) return null;
    throw e;
  }
}

/** GET /api/assets/:id. Returns null for an unknown asset. */
export async function getAsset(id: string): Promise<AssetDetail | null> {
  if (USE_MOCK) {
    // Loaded on demand so the 20-asset fixture never lands in the client bundle.
    const { default: assets } = await import("./mock/assets.json");
    const byId = assets as unknown as Record<string, AssetDetail>;
    return Object.hasOwn(byId, id) ? byId[id] : null;
  }
  try {
    return await request<AssetDetail>(`/api/assets/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 404) return null;
    throw e;
  }
}

/** POST /api/problems/:id/decision. Mock mode echoes the change back after a short delay. */
export async function setDecision(problem: Problem, decision: Decision): Promise<Problem> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 150));
    return { ...problem, decision };
  }
  return request<Problem>(`/api/problems/${encodeURIComponent(problem.anomaly_id)}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

/** GET /api/missions. Mock data comes from scripts/build-insights-mock.mjs. */
export async function getMissions(): Promise<MissionSummary[]> {
  if (USE_MOCK) return missionsMock as MissionSummary[];
  return request<MissionSummary[]>("/api/missions");
}

/** GET /api/insights. Mock data comes from scripts/build-insights-mock.mjs. */
export async function getInsights(): Promise<Insights> {
  if (USE_MOCK) return insightsMock as Insights;
  return request<Insights>("/api/insights");
}
