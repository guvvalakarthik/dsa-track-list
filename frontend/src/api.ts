import type { Problem, Recommendation, Summary } from "./types";

const DEFAULT_API =
  import.meta.env.VITE_API_URL || localStorage.getItem("trackforge_api") || "http://localhost:8000";

export function normalizeApiUrl(value: string) {
  const parsed = new URL(value.trim());
  const localHttp =
    parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) {
    throw new Error("Use HTTPS for remote APIs; HTTP is allowed only on localhost.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("API URLs cannot contain embedded credentials.");
  }
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}

export function getSettings() {
  return {
    apiUrl: localStorage.getItem("trackforge_api") || DEFAULT_API,
    token: sessionStorage.getItem("trackforge_token") || "",
  };
}

export function saveSettings(apiUrl: string, token: string) {
  localStorage.setItem("trackforge_api", normalizeApiUrl(apiUrl));
  sessionStorage.setItem("trackforge_token", token);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiUrl, token } = getSettings();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Tracker-Token": token } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

type ImportJob<T> = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result: T | null;
  error: string | null;
};

async function runImportJob<T>(kind: "zerotrac" | "leetcode-catalog"): Promise<T> {
  const queued = await request<ImportJob<T>>(`/api/jobs/import/${kind}`, { method: "POST" });
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const job =
      attempt === 0 && queued.status !== "queued" ? queued : await request<ImportJob<T>>(`/api/jobs/${queued.id}`);
    if (job.status === "succeeded" && job.result) return job.result;
    if (job.status === "failed") throw new Error(job.error || `${kind} import failed`);
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
  throw new Error(`${kind} import timed out`);
}
export const api = {
  health: () => request<{ status: string }>("/api/health"),
  verify: () => request<{ authenticated: boolean }>("/api/auth/verify"),
  summary: () => request<Summary>("/api/summary"),
  problems: (params: URLSearchParams) =>
    request<{ items: Problem[]; count: number }>(`/api/problems?${params}`),
  resolve: (url: string) =>
    request<Problem & { matched: boolean; canonical_url: string }>(
      `/api/problems/resolve?url=${encodeURIComponent(url)}`,
    ),
  override: (id: number, solved: boolean | null) =>
    request<Problem>(`/api/problems/${id}/override`, {
      method: "PUT",
      body: JSON.stringify({ solved }),
    }),
  topics: (id: number, topics: string[]) =>
    request<Problem>(`/api/problems/${id}/topics`, {
      method: "PUT",
      body: JSON.stringify({ topics }),
    }),
  importZeroTrac: () =>
    runImportJob<{ imported: number }>("zerotrac"),
  importLeetCodeCatalog: () =>
    runImportJob<{ imported: number; classified: number }>("leetcode-catalog"),
  recommendations: () =>
    request<{
      items: Recommendation[];
      solved_basis: number;
      target_rating: number | null;
      topics_used: number;
    }>("/api/recommendations?limit=30"),
};



