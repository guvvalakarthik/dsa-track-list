import { CheckCircle2, Circle, Cloud, ExternalLink, Link2, RefreshCw, Search, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { api } from "../api";
import { StatusPill } from "../components/ProblemUi";
import type { Problem } from "../types";
export function UrlChecker() {
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
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://leetcode.com/problems/…" required />
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
