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

  function validateApiUrl(value) {
    const parsed = new URL(normalizeApiUrl(value));
    const localHttp =
      parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) {
      throw new Error("Use HTTPS for remote APIs; HTTP is allowed only on localhost.");
    }
    if (parsed.username || parsed.password) {
      throw new Error("API URLs cannot contain embedded credentials.");
    }
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
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

  return { normalizeApiUrl, validateApiUrl, hasAcceptedSignal, problemSlug };
});