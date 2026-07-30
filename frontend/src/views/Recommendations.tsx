import { ArrowUpRight, CheckCircle2, RefreshCw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { PlatformBadge } from "../components/ProblemUi";
import type { Recommendation } from "../types";
export function Recommendations() {
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
