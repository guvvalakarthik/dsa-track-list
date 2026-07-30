import {
  ArrowUpRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Code2,
  ExternalLink,
  Link2,
  Sparkles,
  Target,
} from "lucide-react";
import { EmptyMini } from "../components/EmptyMini";
import type { View } from "../navigation";
import type { Problem, Summary } from "../types";
export function Dashboard({
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
