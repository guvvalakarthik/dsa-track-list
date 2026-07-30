import {
  ArrowUpRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  ExternalLink,
  Filter,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { EmptyMini } from "../components/EmptyMini";
import { PlatformBadge, StatusPill } from "../components/ProblemUi";
import type { Problem, Summary } from "../types";
export function ProblemExplorer({
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
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <label className="select-field">
      {icon}
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
      <ChevronDown size={14} />
    </label>
  );
}
