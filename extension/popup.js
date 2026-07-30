const $ = (id) => document.getElementById(id);

async function settings() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get({
      apiUrl: "http://localhost:8000",
      leetcodeUser: "",
      gfgUser: "",
    }),
    chrome.storage.session.get({ token: "" }),
  ]);
  return { ...local, ...session };
}

function setStatus(message, kind = "") {
  $("status").textContent = message;
  $("status").className = `status ${kind}`;
}

async function api(path, options = {}) {
  const config = await settings();
  const response = await fetch(`${TrackForgeUtils.normalizeApiUrl(config.apiUrl)}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(config.token ? { "X-Tracker-Token": config.token } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

async function load() {
  const config = await settings();
  $("apiUrl").value = config.apiUrl;
  $("token").value = config.token;
  $("leetcodeUser").value = config.leetcodeUser;
  $("gfgUser").value = config.gfgUser;
  try {
    await api("/api/auth/verify");
    $("connectionDot").classList.add("online");
    setStatus("Connected. Automatic accepted-solution capture is active.", "success");
  } catch {
    setStatus("API is offline or not configured.", "error");
  }
}

$("save").addEventListener("click", async () => {
  try {
    const apiUrl = TrackForgeUtils.validateApiUrl($("apiUrl").value);
    const origin = `${new URL(apiUrl).origin}/*`;
    const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });
    if (!alreadyGranted) {
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) throw new Error("Permission to connect to this API was not granted.");
    }
    await Promise.all([
      chrome.storage.local.set({
        apiUrl,
        leetcodeUser: $("leetcodeUser").value.trim(),
        gfgUser: $("gfgUser").value.trim(),
      }),
      chrome.storage.session.set({ token: $("token").value.trim() }),
    ]);
    await api("/api/auth/verify");
    $("connectionDot").classList.add("online");
    setStatus("Connection saved and verified.", "success");
  } catch (error) {
    $("connectionDot").classList.remove("online");
    setStatus(error.message, "error");
  }
});

$("syncLeetcode").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  setStatus("Reading the full signed-in LeetCode catalogue...");
  try {
    const config = await settings();
    if (!config.leetcodeUser) throw new Error("Enter your LeetCode username first.");
    const tabs = await chrome.tabs.query({ url: ["https://leetcode.com/*", "https://www.leetcode.com/*"] });
    const tab = tabs.find((candidate) => candidate.id);
    if (!tab?.id) {
      throw new Error("Open LeetCode in a tab and sign in before syncing.");
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      args: [config.leetcodeUser],
      func: async (username) => {
        const response = await fetch("https://leetcode.com/api/problems/all/", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`LeetCode returned ${response.status}`);
        const payload = await response.json();
        const difficultyNames = { 1: "Easy", 2: "Medium", 3: "Hard" };
        const problems = (payload.stat_status_pairs || [])
          .filter((entry) => String(entry.status || "").toLowerCase() === "ac")
          .map((entry) => ({
            external_id: entry.stat.frontend_question_id,
            slug: entry.stat.question__title_slug,
            title: entry.stat.question__title,
            url: `https://leetcode.com/problems/${entry.stat.question__title_slug}/`,
            difficulty: difficultyNames[entry.difficulty?.level] || null,
            accepted: true,
          }));
        return {
          problems,
          expectedTotal: Number(payload.num_solved || 0),
          signedInUser: payload.user_name || "",
          requestedUser: username,
        };
      },
    });
    if (!result) throw new Error("LeetCode did not return account data.");
    if (result.signedInUser && result.signedInUser.toLowerCase() !== config.leetcodeUser.toLowerCase()) {
      throw new Error(`Chrome is signed in as ${result.signedInUser}, not ${config.leetcodeUser}.`);
    }
    if (!result.expectedTotal || !result.problems.length) {
      throw new Error("LeetCode session was not detected. Sign in and reload the LeetCode tab.");
    }
    if (result.problems.length !== result.expectedTotal) {
      throw new Error(`LeetCode reported ${result.expectedTotal} solved but returned ${result.problems.length}; partial sync rejected.`);
    }
    const imported = await api("/api/sync/leetcode", {
      method: "POST",
      body: JSON.stringify({ username: config.leetcodeUser, problems: result.problems }),
    });
    setStatus(`Synced all ${imported.imported} accepted LeetCode problems.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

$("scanGfg").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  setStatus("Fetching accepted GFG submissions...");
  try {
    const config = await settings();
    if (!config.gfgUser) throw new Error("Enter your GFG username first.");
    const response = await fetch(
      "https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: config.gfgUser,
          requestType: "",
          year: "",
          month: "",
        }),
      },
    );
    if (!response.ok) throw new Error(`GFG returned ${response.status}`);
    const payload = await response.json();
    if (payload.status !== "success") {
      throw new Error(payload.message || "GFG submission history is unavailable.");
    }
    const problems = [];
    for (const [difficulty, entries] of Object.entries(payload.result || {})) {
      for (const [externalId, item] of Object.entries(entries || {})) {
        problems.push({
          external_id: externalId,
          slug: item.slug,
          title: item.pname || item.title || item.slug.replaceAll("-", " "),
          url: `https://www.geeksforgeeks.org/problems/${item.slug}/1`,
          difficulty,
          accepted: true,
          solved_at: item.user_subtime
            ? new Date(`${item.user_subtime.replace(" ", "T")}Z`).toISOString()
            : null,
        });
      }
    }
    if (!problems.length) throw new Error("No accepted GFG problems were returned.");
    const imported = await api("/api/sync/gfg", {
      method: "POST",
      body: JSON.stringify({ username: config.gfgUser, problems }),
    });
    setStatus(`Synced ${imported.imported} accepted GFG problems.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

load();



