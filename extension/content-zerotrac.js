(() => {
  const BADGE_CLASS = "trackforge-solved-badge";
  let statusMap = {};

  function styleBadge(badge, solved) {
    Object.assign(badge.style, {
      display: "inline-flex",
      alignItems: "center",
      marginLeft: "8px",
      padding: "2px 7px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: "700",
      lineHeight: "18px",
      color: solved ? "#0a271c" : "#697386",
      background: solved ? "#64e6b3" : "#edf0f4",
      border: solved ? "1px solid #42c995" : "1px solid #d8dde5",
    });
  }

  function annotate() {
    for (const anchor of document.querySelectorAll('a[href*="leetcode.com/problems/"]')) {
      const match = anchor.href.match(/\/problems\/([^/?#]+)/);
      if (!match) continue;
      const slug = match[1];
      const row = anchor.closest("tr") || anchor.parentElement;
      if (!row || row.querySelector(`.${BADGE_CLASS}`)) continue;
      const solved = statusMap[slug] === true;
      const badge = document.createElement("span");
      badge.className = BADGE_CLASS;
      badge.textContent = solved ? "✓ Solved" : "○ To solve";
      badge.title = "Status from TrackForge";
      styleBadge(badge, solved);
      anchor.insertAdjacentElement("afterend", badge);
    }
  }

  async function loadStatuses() {
    const config = await chrome.storage.local.get({
      apiUrl: "http://localhost:8000",
      token: "",
    });
    try {
      const response = await fetch(
        `${config.apiUrl.replace(/\/+$/, "")}/api/extension/status-map`,
        { headers: config.token ? { "X-Tracker-Token": config.token } : {} },
      );
      if (!response.ok) return;
      const payload = await response.json();
      statusMap = payload.leetcode || {};
      annotate();
    } catch {
      // Dashboard/API may be offline; ZeroTrac should continue working normally.
    }
  }

  new MutationObserver(annotate).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  loadStatuses();
})();

