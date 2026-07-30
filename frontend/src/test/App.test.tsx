import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const summary = {
  total: 2,
  solved: 1,
  leetcode_solved: 1,
  gfg_solved: 0,
  completion: 50,
  recent_solved: [],
  topics: [{ name: "Arrays", total: 2, solved: 1 }],
};

function jsonResponse(payload: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("TrackForge dashboard", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/summary")) return jsonResponse(summary);
      if (url.includes("/api/problems")) return jsonResponse({ items: [], count: 2 });
      return jsonResponse({ status: "ok" });
    });
  });

  it("renders synchronized progress from the API", async () => {
    render(<App />);

    expect((await screen.findAllByText("50%"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("Arrays").length).toBeGreaterThan(0);
    expect(screen.getByText("of 2 tracked")).toBeInTheDocument();
  });

  it("opens connection settings", async () => {
    render(<App />);
    const settingsButtons = await screen.findAllByText("Connection settings");
    await userEvent.click(settingsButtons[0]);
    expect(await screen.findByText("FastAPI URL")).toBeInTheDocument();
  });
});