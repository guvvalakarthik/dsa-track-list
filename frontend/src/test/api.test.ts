import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, getSettings, normalizeApiUrl, saveSettings } from "../api";

describe("API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("normalizes and persists connection settings", () => {
    saveSettings("https://tracker.example.com///", "secret-token");
    expect(getSettings()).toEqual({
      apiUrl: "https://tracker.example.com",
      token: "secret-token",
    });
  });

  it("sends the configured token", async () => {
    saveSettings("https://tracker.example.com", "secret-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await api.summary();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tracker.example.com/api/summary",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Tracker-Token": "secret-token" }),
      }),
    );
  });

  it("surfaces API error details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid tracker token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api.summary()).rejects.toThrow("Invalid tracker token");
  });

  it("maps all public API operations to their endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ items: [], status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await api.health();
    await api.verify();
    await api.problems(new URLSearchParams({ limit: "10" }));
    await api.resolve("https://leetcode.com/problems/two-sum/");
    await api.override(1, true);
    await api.topics(1, ["Arrays"]);
    await api.importZeroTrac();
    await api.importLeetCodeCatalog();
    await api.recommendations();

    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/problems/resolve?url="),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/problems/1/override"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
  it("rejects insecure remote API URLs and embedded credentials", () => {
    expect(() => normalizeApiUrl("http://tracker.example.com")).toThrow("Use HTTPS");
    expect(() => normalizeApiUrl("https://user:pass@tracker.example.com")).toThrow(
      "embedded credentials",
    );
    expect(normalizeApiUrl("http://localhost:8000/")).toBe("http://localhost:8000");
  });});