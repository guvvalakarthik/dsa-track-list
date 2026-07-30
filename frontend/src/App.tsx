import {
  BarChart3,
  BookOpenCheck,
  Check,
  Cloud,
  Code2,
  Database,
  Gauge,
  Link2,
  Menu,
  RefreshCw,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { SettingsModal } from "./components/SettingsModal";
import type { View } from "./navigation";
import type { Problem, Summary } from "./types";
import { Dashboard } from "./views/Dashboard";
import { ProblemExplorer } from "./views/ProblemExplorer";
import { Recommendations } from "./views/Recommendations";
import { UrlChecker } from "./views/UrlChecker";
const EMPTY_SUMMARY: Summary = {
  total: 0,
  solved: 0,
  leetcode_solved: 0,
  gfg_solved: 0,
  completion: 0,
  recent_solved: [],
  topics: [],
};

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");
  const [topic, setTopic] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "5000" });
      if (platform) params.set("platform", platform);
      if (status) params.set("solved", status);
      if (topic) params.set("topic", topic);
      if (search.trim()) params.set("search", search.trim());
      const [summaryData, problemData] = await Promise.all([
        api.summary(),
        api.problems(params),
      ]);
      setSummary(summaryData);
      setProblems(problemData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to TrackForge API");
    } finally {
      setLoading(false);
    }
  }, [platform, search, status, topic]);

  useEffect(() => {
    const timer = window.setTimeout(load, 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const toggleProblem = async (problem: Problem) => {
    try {
      await api.override(problem.id, !problem.solved);
      setToast(`${problem.title} marked ${problem.solved ? "to solve" : "solved"}`);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Update failed");
    }
  };

  const importZeroTrac = async () => {
    setImporting(true);
    try {
      const result = await api.importZeroTrac();
      setToast(`Imported ${result.imported.toLocaleString()} ZeroTrac problems`);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const visibleProblems = useMemo(
    () => (view === "zerotrac" ? problems.filter((p) => p.rating !== null) : problems),
    [problems, view],
  );

  const nav = [
    { id: "dashboard" as View, label: "Overview", icon: BarChart3 },
    { id: "problems" as View, label: "Problem checklist", icon: BookOpenCheck },
    { id: "zerotrac" as View, label: "ZeroTrac ratings", icon: Gauge },
    { id: "recommendations" as View, label: "Recommended next", icon: Sparkles },
    { id: "checker" as View, label: "URL checker", icon: Link2 },
  ];

  return (
    <div className="app-shell">
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">
            <Code2 size={21} />
          </div>
          <div>
            <strong>TrackForge</strong>
            <span>DSA progress</span>
          </div>
          <button className="mobile-close" onClick={() => setMobileNav(false)}>
            <X size={20} />
          </button>
        </div>

        <nav>
          <p className="nav-label">Workspace</p>
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                setMobileNav(false);
              }}
            >
              <item.icon size={18} />
              {item.label}
              {item.id === "problems" && <em>{summary.total}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sync-card">
            <div className="sync-icon"><Cloud size={18} /></div>
            <div>
              <strong>Account sync</strong>
              <span>Use the extension to import</span>
            </div>
            <span className="live-dot" />
          </div>
          <button className="settings-link" onClick={() => setSettingsOpen(true)}>
            <Settings size={18} />
            Connection settings
          </button>
        </div>
      </aside>

      {mobileNav && <button className="backdrop" onClick={() => setMobileNav(false)} />}

      <main>
        <header>
          <button className="mobile-menu" onClick={() => setMobileNav(true)}>
            <Menu size={21} />
          </button>
          <div>
            <span className="eyebrow">PERSONAL WORKSPACE</span>
            <h1>
              {view === "dashboard" && "Your practice command center"}
              {view === "problems" && "Problem checklist"}
              {view === "zerotrac" && "ZeroTrac rated problems"}
              {view === "recommendations" && "Recommended problems"}
              {view === "checker" && "Check a problem link"}
            </h1>
          </div>
          <div className="header-actions">
            <button className="icon-button" onClick={load} title="Refresh">
              <RefreshCw size={18} />
            </button>
            <button className="avatar" onClick={() => setSettingsOpen(true)}>K</button>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            <Database size={20} />
            <div>
              <strong>API connection needed</strong>
              <span>{error}. Start the FastAPI server or update connection settings.</span>
            </div>
            <button onClick={() => setSettingsOpen(true)}>Configure</button>
          </div>
        )}

        {view === "dashboard" && (
          <Dashboard
            summary={summary}
            problems={problems}
            loading={loading}
            onNavigate={setView}
          />
        )}

        {(view === "problems" || view === "zerotrac") && (
          <>
            {view === "zerotrac" && (
              <section className="zerotrac-hero">
                <div>
                  <span className="section-kicker"><Sparkles size={15} /> EXTERNAL DATASET</span>
                  <h2>Practice by real contest rating</h2>
                  <p>
                    Import ZeroTrac’s weekly dataset, choose a rating range, and keep
                    your solved state in sync everywhere.
                  </p>
                </div>
                <button className="primary-button" onClick={importZeroTrac} disabled={importing}>
                  <RefreshCw size={17} className={importing ? "spin" : ""} />
                  {importing ? "Importing…" : "Import / refresh ZeroTrac"}
                </button>
              </section>
            )}
            <ProblemExplorer
              problems={visibleProblems}
              loading={loading}
              summary={summary}
              search={search}
              setSearch={setSearch}
              platform={platform}
              setPlatform={setPlatform}
              status={status}
              setStatus={setStatus}
              topic={topic}
              setTopic={setTopic}
              onToggle={toggleProblem}
              ratedOnly={view === "zerotrac"}
            />
          </>
        )}

        {view === "recommendations" && <Recommendations />}

        {view === "checker" && <UrlChecker />}

        <footer>
          <span>TrackForge stores only problem progress — never platform passwords.</span>
          <span>LeetCode · GeeksforGeeks · ZeroTrac</span>
        </footer>
      </main>

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            setToast("Connection settings saved");
            load();
          }}
        />
      )}

      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </div>
  );
}

export default App;
