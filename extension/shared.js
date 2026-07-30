(function exposeTrackForgeUtils(root, factory) {
  const utilities = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = utilities;
  root.TrackForgeUtils = utilities;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const acceptanceSignals = {
    leetcode: ["Accepted", "All test cases passed"],
    gfg: ["Problem Solved Successfully", "Correct Answer", "Congratulations"],
  };

  function normalizeApiUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function hasAcceptedSignal(bodyText, platform) {
    return (acceptanceSignals[platform] || []).some((signal) =>
      String(bodyText || "").includes(signal),
    );
  }

  function problemSlug(pathname) {
    const match = String(pathname || "").match(/\/problems\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  return { normalizeApiUrl, hasAcceptedSignal, problemSlug };
});