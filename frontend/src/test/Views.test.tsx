import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { SettingsModal } from "../components/SettingsModal";
import type { Problem, Recommendation, Summary } from "../types";
import { ProblemExplorer } from "../views/ProblemExplorer";
import { Recommendations } from "../views/Recommendations";
import { UrlChecker } from "../views/UrlChecker";

const problem: Problem = {
  id: 7,
  platform: "leetcode",
  external_id: "76",
  slug: "minimum-window-substring",
  title: "Minimum Window Substring",
  url: "https://leetcode.com/problems/minimum-window-substring/",
  difficulty: "Hard",
  rating: 2062,
  contest: "weekly-contest-10",
  question_index: "D",
  topics: ["Sliding Window", "Hashing", "Strings"],
  custom_topics: ["Revision"],
  auto_solved: true,
  manual_override: true,
  solved: true,
  group_solved: true,
  solved_at: "2026-07-30T10:00:00Z",
  source: "leetcode",
  equivalence_key: null,
};

const summary: Summary = {
  total: 1,
  solved: 1,
  leetcode_solved: 1,
  gfg_solved: 0,
  completion: 100,
  recent_solved: [problem],
  topics: [{ name: "Sliding Window", total: 1, solved: 1 }],
};

const recommendation: Recommendation = {
  ...problem,
  solved: false,
  auto_solved: false,
  manual_override: null,
  recommendation_score: 8.4,
  shared_topics: ["Sliding Window", "Hashing"],
  related_to: [{ id: 2, title: "Longest Substring", url: "https://leetcode.com/problems/longest-substring/" }],
  reason: "Builds on Sliding Window after Longest Substring",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProblemExplorer", () => {
  it("renders rich problem data, toggles state, and clears every filter", async () => {
    const user = userEvent.setup();
    const setSearch = vi.fn();
    const setPlatform = vi.fn();
    const setStatus = vi.fn();
    const setTopic = vi.fn();
    const onToggle = vi.fn();

    const { container } = render(
      <ProblemExplorer
        problems={[problem]}
        loading={false}
        summary={summary}
        search="window"
        setSearch={setSearch}
        platform="leetcode"
        setPlatform={setPlatform}
        status="true"
        setStatus={setStatus}
        topic="Sliding Window"
        setTopic={setTopic}
        onToggle={onToggle}
        ratedOnly
      />,
    );

    expect(screen.getByText("Minimum Window Substring")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("2062")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "All platforms" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Clear filters/ }));
    expect(setSearch).toHaveBeenCalledWith("");
    expect(setPlatform).toHaveBeenCalledWith("");
    expect(setStatus).toHaveBeenCalledWith("");
    expect(setTopic).toHaveBeenCalledWith("");

    await user.click(container.querySelector(".check-button")!);
    expect(onToggle).toHaveBeenCalledWith(problem);
  });

  it("shows empty and loading states", () => {
    const props = {
      problems: [] as Problem[],
      summary,
      search: "",
      setSearch: vi.fn(),
      platform: "",
      setPlatform: vi.fn(),
      status: "",
      setStatus: vi.fn(),
      topic: "",
      setTopic: vi.fn(),
      onToggle: vi.fn(),
      ratedOnly: false,
    };
    const { rerender } = render(<ProblemExplorer {...props} loading={false} />);
    expect(screen.getByText("No problems here yet")).toBeInTheDocument();
    rerender(<ProblemExplorer {...props} loading />);
    expect(screen.getByText(/Loading checklist/)).toBeInTheDocument();
  });
});

describe("Recommendations", () => {
  it("renders evidence and refreshes the classified catalogue", async () => {
    const user = userEvent.setup();
    const recommendations = vi.spyOn(api, "recommendations").mockResolvedValue({
      items: [recommendation],
      solved_basis: 42,
      target_rating: 1800,
      topics_used: 9,
    });
    vi.spyOn(api, "importLeetCodeCatalog").mockResolvedValue({ imported: 4000, classified: 3900 });

    render(<Recommendations />);
    expect(await screen.findByText("Minimum Window Substring")).toBeInTheDocument();
    expect(screen.getByText("RELATED TO YOUR SOLVES")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Refresh LeetCode classification/ }));
    expect(api.importLeetCodeCatalog).toHaveBeenCalledOnce();
    expect(recommendations).toHaveBeenCalledTimes(2);
  });

  it("surfaces recommendation failures", async () => {
    vi.spyOn(api, "recommendations").mockRejectedValue(new Error("catalog unavailable"));
    render(<Recommendations />);
    expect(await screen.findByText("catalog unavailable")).toBeInTheDocument();
    expect(screen.getByText("Classify the catalogue to get recommendations")).toBeInTheDocument();
  });
});

describe("UrlChecker", () => {
  it("normalizes through the API and renders solved evidence", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "resolve").mockResolvedValue({ ...problem, matched: true, canonical_url: problem.url });
    render(<UrlChecker />);
    await user.type(screen.getByLabelText("Problem URL"), `${problem.url}?envType=study-plan`);
    await user.click(screen.getByRole("button", { name: "Check status" }));
    expect(await screen.findByText("MATCHED IN YOUR TRACKER")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("Rating 2062")).toBeInTheDocument();
  });

  it("surfaces lookup failures", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "resolve").mockRejectedValue(new Error("unsupported problem URL"));
    render(<UrlChecker />);
    await user.type(screen.getByLabelText("Problem URL"), "https://example.com/problem");
    await user.click(screen.getByRole("button", { name: "Check status" }));
    expect(await screen.findByText("unsupported problem URL")).toBeInTheDocument();
  });
});

describe("SettingsModal", () => {
  it("rejects unsafe remote HTTP then saves a valid session-scoped connection", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<SettingsModal onClose={vi.fn()} onSaved={onSaved} />);
    const urlInput = screen.getByLabelText("FastAPI URL");
    const tokenInput = screen.getByLabelText("Personal tracker token");

    await user.clear(urlInput);
    await user.type(urlInput, "http://tracker.example.com");
    await user.click(screen.getByRole("button", { name: "Save connection" }));
    expect(screen.getByText(/Use HTTPS for remote APIs/)).toBeInTheDocument();

    await user.clear(urlInput);
    await user.type(urlInput, "https://tracker.example.com/api/");
    await user.type(tokenInput, "test-token");
    await user.click(screen.getByRole("button", { name: "Save connection" }));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(localStorage.getItem("trackforge_api")).toBe("https://tracker.example.com/api");
    expect(sessionStorage.getItem("trackforge_token")).toBe("test-token");
  });
});