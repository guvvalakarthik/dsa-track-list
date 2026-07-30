import {
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Cloud,
  Code2,
  Database,
  ExternalLink,
  Filter,
  Gauge,
  Link2,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, getSettings, saveSettings } from "./api";
import type { Problem, Recommendation, Summary } from "./types";

type View = "dashboard" | "problems" | "zerotrac" | "recommendations" | "checker";

const EMPTY_SUMMARY: Summary = {
  total: 0,
  solved: 0,
  leetcode_solved: 0,
  gfg_solved: 0,
  completion: 0,
  recent_solved: [],
  topics: [],
};

function PlatformBadge({ platform }: { platform: Problem["platform"] }) {
  return (
    <span className={`platform-badge ${platform}`}>
      {platform === "leetcode" ? "LC" : "GFG"}
      <span>{platform === "leetcode" ? "LeetCode" : "GeeksforGeeks"}</span>
    </span>
  );
}

function StatusPill({ solved, manual }: { solved: boolean; manual?: boolean }) {
  return (
    <span className={`status-pill ${solved ? "solved" : "open"}`}>
      {solved ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      {solved ? "Solved" : "To solve"}
      {manual && <i>Manual</i>}
    </span>
  );
}

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
                    Import ZeroTracâ€™s weekly dataset, choose a rating range, and keep
                    your solved state in sync everywhere.
                  </p>
                </div>
                <button className="primary-button" onClick={importZeroTrac} disabled={importing}>
                  <RefreshCw size={17} className={importing ? "spin" : ""} />
                  {importing ? "Importingâ€¦" : "Import / refresh ZeroTrac"}
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
          <span>TrackForge stores only problem progress â€” never platform passwords.</span>
          <span>LeetCode Â· GeeksforGeeks Â· ZeroTrac</span>
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

function Dashboard({
  summary,
  problems,
  loading,
  onNavigate,
}: {
  summary: Summary;
  problems: Problem[];
  loading: boolean;
  onNavigate: (view: View) => void;
}) {
  const recent = summary.recent_solved.length
    ? summary.recent_solved
    : problems.filter((problem) => problem.solved).slice(0, 5);
  const strongestTopic = summary.topics
    .filter((item) => item.solved)
    .sort((a, b) => b.solved / b.total - a.solved / a.total)[0];

  return (
    <>
      <section className="welcome-row">
        <div>
          <span className="section-kicker"><Target size={15} /> KEEP THE STREAK MOVING</span>
          <h2>Every accepted solution,<br /><i>one clear roadmap.</i></h2>
          <p>
            Your LeetCode and GFG progress, organized by topic and enriched with
            contest ratings.
          </p>
        </div>
        <div className="completion-orbit" style={{ "--progress": `${summary.completion * 3.6}deg` } as React.CSSProperties}>
          <div>
            <strong>{summary.completion}%</strong>
            <span>complete</span>
          </div>
        </div>
      </section>

      <section className="stat-grid">
        <StatCard
          label="Problems solved"
          value={summary.solved}
          detail={`of ${summary.total.toLocaleString()} tracked`}
          icon={CheckCircle2}
          color="mint"
        />
        <StatCard
          label="LeetCode"
          value={summary.leetcode_solved}
          detail="accepted solutions"
          icon={Code2}
          color="amber"
        />
        <StatCard
          label="GeeksforGeeks"
          value={summary.gfg_solved}
          detail="accepted solutions"
          icon={BookOpenCheck}
          color="green"
        />
        <StatCard
          label="Strongest topic"
          value={strongestTopic?.name || "â€”"}
          detail={strongestTopic ? `${strongestTopic.solved}/${strongestTopic.total} solved` : "Start solving to discover"}
          icon={Sparkles}
          color="violet"
          textual
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel topics-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">TOPIC ROADMAP</span>
              <h3>Progress by concept</h3>
            </div>
            <button onClick={() => onNavigate("problems")}>View all <ArrowUpRight size={15} /></button>
          </div>
          <div className="topic-list">
            {summary.topics.slice(0, 7).map((item) => {
              const progress = item.total ? Math.round((item.solved / item.total) * 100) : 0;
              return (
                <div className="topic-row" key={item.name}>
                  <div className="topic-name">
                    <span>{item.name.slice(0, 1)}</span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.solved} of {item.total} complete</small>
                    </div>
                  </div>
                  <div className="progress-wrap">
                    <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
                    <b>{progress}%</b>
                  </div>
                </div>
              );
            })}
            {!summary.topics.length && <EmptyMini text="Topics appear after your first account sync." />}
          </div>
        </div>

        <div className="panel recent-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">RECENT WINS</span>
              <h3>Latest solved</h3>
            </div>
          </div>
          <div className="recent-list">
            {recent.map((problem) => (
              <a href={problem.url} target="_blank" rel="noreferrer" key={problem.id}>
                <span className={`recent-check ${problem.platform}`}><Check size={15} /></span>
                <div>
                  <strong>{problem.title}</strong>
                  <small>{problem.platform === "leetcode" ? "LeetCode" : "GeeksforGeeks"} Â· {problem.topics[0] || "Uncategorized"}</small>
                </div>
                {problem.rating && <em>{problem.rating}</em>}
                <ExternalLink size={14} />
              </a>
            ))}
            {!recent.length && <EmptyMini text="Your accepted solutions will show up here." />}
          </div>
          <button className="secondary-button" onClick={() => onNavigate("checker")}>
            <Link2 size={16} /> Check a problem URL
          </button>
        </div>
      </section>

      {loading && <div className="loading-line" />}
    </>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  color,
  textual,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Target;
  color: string;
  textual?: boolean;
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${color}`}><Icon size={19} /></div>
      <div>
        <span>{label}</span>
        <strong className={textual ? "text-value" : ""}>{typeof value === "number" ? value.toLocaleString() : value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function ProblemExplorer({
  problems,
  loading,
  summary,
  search,
  setSearch,
  platform,
  setPlatform,
  status,
  setStatus,
  topic,
  setTopic,
  onToggle,
  ratedOnly,
}: {
  problems: Problem[];
  loading: boolean;
  summary: Summary;
  search: string;
  setSearch: (value: string) => void;
  platform: string;
  setPlatform: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  topic: string;
  setTopic: (value: string) => void;
  onToggle: (problem: Problem) => void;
  ratedOnly: boolean;
}) {
  return (
    <section className="explorer panel">
      <div className="explorer-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or slugâ€¦"
          />
        </label>
        {!ratedOnly && (
          <Select value={platform} onChange={setPlatform} icon={<Code2 size={16} />}>
            <option value="">All platforms</option>
            <option value="leetcode">LeetCode</option>
            <option value="gfg">GeeksforGeeks</option>
          </Select>
        )}
        <Select value={status} onChange={setStatus} icon={<CheckCircle2 size={16} />}>
          <option value="">Any status</option>
          <option value="true">Solved</option>
          <option value="false">To solve</option>
        </Select>
        <Select value={topic} onChange={setTopic} icon={<Filter size={16} />}>
          <option value="">All topics</option>
          {summary.topics.map((item) => <option key={item.name}>{item.name}</option>)}
        </Select>
      </div>

      <div className="table-meta">
        <span><strong>{problems.length.toLocaleString()}</strong> problems</span>
        {(search || platform || status || topic) && (
          <button onClick={() => {
            setSearch("");
            setPlatform("");
            setStatus("");
            setTopic("");
          }}>Clear filters <X size={14} /></button>
        )}
      </div>

      <div className="problem-table-wrap">
        <table className="problem-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Problem</th>
              <th>Platform</th>
              <th>Topics</th>
              {ratedOnly && <th>Rating</th>}
              <th>Difficulty</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {problems.slice(0, 250).map((problem) => (
              <tr key={problem.id}>
                <td>
                  <button className={`check-button ${problem.solved ? "checked" : ""}`} onClick={() => onToggle(problem)}>
                    {problem.solved && <Check size={14} />}
                  </button>
                </td>
                <td>
                  <div className="problem-title">
                    <strong>{problem.title}</strong>
                    <span>
                      {problem.external_id && `#${problem.external_id} Â· `}
                      {problem.contest?.replaceAll("-", " ") || problem.slug}
                    </span>
                  </div>
                </td>
                <td><PlatformBadge platform={problem.platform} /></td>
                <td>
                  <div className="tag-list">
                    {[...problem.topics, ...problem.custom_topics].slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                    {problem.topics.length + problem.custom_topics.length > 2 && <span>+{problem.topics.length + problem.custom_topics.length - 2}</span>}
                    {!problem.topics.length && !problem.custom_topics.length && <small>Uncategorized</small>}
                  </div>
                </td>
                {ratedOnly && <td><span className="rating-chip">{problem.rating || "â€”"}</span></td>}
                <td><span className={`difficulty ${(problem.difficulty || "").toLowerCase()}`}>{problem.difficulty || "â€”"}</span></td>
                <td>
                  <a className="row-link" href={problem.url} target="_blank" rel="noreferrer" title="Open problem">
                    <ArrowUpRight size={17} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!problems.length && !loading && (
          <div className="empty-state">
            <div><BookOpenCheck size={27} /></div>
            <h3>No problems here yet</h3>
            <p>Sync your accounts with the extension or import the ZeroTrac dataset.</p>
          </div>
        )}
        {loading && <div className="table-loading"><RefreshCw className="spin" size={21} /> Loading checklistâ€¦</div>}
      </div>
      {problems.length > 250 && <p className="row-limit">Showing the first 250 matching problems. Narrow the list with filters.</p>}
    </section>
  );
}

function Select({
  value,
  onChange,
  children,
  icon,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <label className="select-field">
      {icon}
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
      <ChevronDown size={14} />
    </label>
  );
}

function Recommendations() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [solvedBasis, setSolvedBasis] = useState(0);
  const [targetRating, setTargetRating] = useState<number | null>(null);
  const [topicsUsed, setTopicsUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState("");

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.recommendations();
      setItems(result.items);
      setSolvedBasis(result.solved_basis);
      setTargetRating(result.target_rating);
      setTopicsUsed(result.topics_used);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build recommendations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const classifyCatalogue = async () => {
    setClassifying(true);
    setError("");
    try {
      await api.importLeetCodeCatalog();
      await loadRecommendations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "LeetCode classification failed");
    } finally {
      setClassifying(false);
    }
  };

  return (
    <section className="recommendations-page">
      <div className="recommendation-hero">
        <div>
          <span className="section-kicker"><Sparkles size={15} /> PERSONALIZED PRACTICE</span>
          <h2>Problems that build on<br /><i>what you already know.</i></h2>
          <p>
            TrackForge compares official LeetCode topics in your solved history with
            unsolved questions, then prefers nearby contest ratings.
          </p>
        </div>
        <button className="primary-button classify-button" onClick={classifyCatalogue} disabled={classifying}>
          <RefreshCw size={17} className={classifying ? "spin" : ""} />
          {classifying ? "Classifying 4,000+ problems..." : "Refresh LeetCode classification"}
        </button>
      </div>

      <div className="recommendation-insights">
        <div><strong>{solvedBasis}</strong><span>solved problems analyzed</span></div>
        <div><strong>{topicsUsed}</strong><span>learned topic signals</span></div>
        <div><strong>{targetRating || "—"}</strong><span>suggested rating frontier</span></div>
        <div><strong>{items.length}</strong><span>best next matches</span></div>
      </div>

      {error && <div className="checker-error"><X size={17} />{error}</div>}
      {loading && <div className="recommendation-loading"><RefreshCw className="spin" size={22} />Building your practice path...</div>}

      {!loading && !items.length && (
        <div className="empty-state recommendation-empty">
          <div><Sparkles size={27} /></div>
          <h3>Classify the catalogue to get recommendations</h3>
          <p>Sync solved problems first, then refresh LeetCode classification.</p>
        </div>
      )}

      <div className="recommendation-grid">
        {items.map((problem, index) => (
          <article className="recommendation-card" key={problem.id}>
            <div className="recommendation-rank">{String(index + 1).padStart(2, "0")}</div>
            <div className="recommendation-card-head">
              <PlatformBadge platform={problem.platform} />
              {problem.rating && <span className="rating-chip">{problem.rating}</span>}
            </div>
            <h3>{problem.title}</h3>
            <p>{problem.reason}</p>
            <div className="recommendation-tags">
              {problem.shared_topics.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            {problem.related_to.length > 0 && (
              <div className="related-evidence">
                <small>RELATED TO YOUR SOLVES</small>
                {problem.related_to.slice(0, 2).map((related) => (
                  <span key={related.id}><CheckCircle2 size={12} />{related.title}</span>
                ))}
              </div>
            )}
            <div className="recommendation-footer">
              <span className={`difficulty ${(problem.difficulty || "").toLowerCase()}`}>
                {problem.difficulty || "Unrated"}
              </span>
              <a href={problem.url} target="_blank" rel="noreferrer">
                Solve next <ArrowUpRight size={15} />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function UrlChecker() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<(Problem & { matched: boolean }) | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const check = async (event: FormEvent) => {
    event.preventDefault();
    setChecking(true);
    setError("");
    setResult(null);
    try {
      setResult(await api.resolve(url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check this URL");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="checker-layout">
      <div className="checker-card">
        <div className="checker-icon"><Link2 size={28} /></div>
        <span className="section-kicker">INSTANT LOOKUP</span>
        <h2>Have I solved this?</h2>
        <p>Paste any LeetCode or GeeksforGeeks problem link. TrackForge normalizes the URL and checks your synced history.</p>
        <form onSubmit={check}>
          <label>
            Problem URL
            <div>
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://leetcode.com/problems/â€¦" required />
              <button disabled={checking}>
                {checking ? <RefreshCw size={18} className="spin" /> : <Search size={18} />}
                {checking ? "Checking" : "Check status"}
              </button>
            </div>
          </label>
        </form>
        {error && <div className="checker-error"><X size={17} />{error}</div>}
        {result && (
          <div className={`checker-result ${result.solved ? "solved" : ""}`}>
            <div className="result-icon">{result.solved ? <CheckCircle2 size={26} /> : <Circle size={26} />}</div>
            <div>
              <span>{result.matched ? "MATCHED IN YOUR TRACKER" : "NOT IN YOUR TRACKER YET"}</span>
              <h3>{result.title || result.slug}</h3>
              <div className="result-meta">
                <StatusPill solved={result.solved} manual={result.manual_override !== null} />
                <span className="plain-chip">{result.platform === "leetcode" ? "LeetCode" : "GeeksforGeeks"}</span>
                {result.rating && <span className="plain-chip">Rating {result.rating}</span>}
              </div>
            </div>
            {result.url && <a href={result.url} target="_blank" rel="noreferrer"><ExternalLink size={18} /></a>}
          </div>
        )}
      </div>
      <aside className="checker-help">
        <span className="section-kicker">HOW IT WORKS</span>
        <ol>
          <li><b>1</b><div><strong>Paste a problem link</strong><span>Description and submission URLs both work.</span></div></li>
          <li><b>2</b><div><strong>Match the canonical slug</strong><span>Tracking ignores query strings and URL variants.</span></div></li>
          <li><b>3</b><div><strong>See trusted evidence</strong><span>Automatic accepts and manual overrides stay separate.</span></div></li>
        </ol>
        <div className="privacy-note"><Cloud size={19} /><span>Your platform login stays in your browser.</span></div>
      </aside>
    </section>
  );
}

function SettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const current = getSettings();
  const [apiUrl, setApiUrl] = useState(current.apiUrl);
  const [token, setToken] = useState(current.token);
  const [settingsError, setSettingsError] = useState("");

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><span className="section-kicker">CONNECTION</span><h3>Tracker settings</h3></div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <label>
          FastAPI URL
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="http://localhost:8000" />
        </label>
        <label>
          Personal tracker token
          <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Leave blank for local development" />
        </label>
        <p>Use the same URL and token in the browser extension. Tokens are kept only for this browser session.</p>
        {settingsError && <p className="checker-error">{settingsError}</p>}
        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={() => {
            try {
              saveSettings(apiUrl, token);
              onSaved();
            } catch (err) {
              setSettingsError(err instanceof Error ? err.message : "Invalid API URL");
            }
          }}>Save connection</button>
        </div>
      </div>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <div className="empty-mini"><Circle size={17} /><span>{text}</span></div>;
}

export default App;




