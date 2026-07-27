import type { Problem, Summary } from "./types";

const DEFAULT_API =
  import.meta.env.VITE_API_URL || localStorage.getItem("trackforge_api") || "http://localhost:8000";

export function getSettings() {
  return {
    apiUrl: localStorage.getItem("trackforge_api") || DEFAULT_API,
    token: localStorage.getItem("trackforge_token") || "",
  };
}

export function saveSettings(apiUrl: string, token: string) {
  localStorage.setItem("trackforge_api", apiUrl.replace(/\/+$/, ""));
  localStorage.setItem("trackforge_token", token);
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

export const api = {
  health: () => request<{ status: string }>("/api/health"),
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
    request<{ imported: number }>("/api/import/zerotrac", { method: "POST" }),
};

