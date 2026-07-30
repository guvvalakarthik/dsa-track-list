importScripts("shared.js");

async function getSettings() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get({ apiUrl: "http://localhost:8000" }),
    chrome.storage.session.get({ token: "" }),
  ]);
  return { ...local, ...session };
}

async function trackerApi(path, options = {}) {
  const { apiUrl, token } = await getSettings();
  const response = await fetch(`${TrackForgeUtils.normalizeApiUrl(apiUrl)}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Tracker-Token": token } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Tracker returned ${response.status}`);
  }
  return response.json();
}

async function syncLeetCode(username) {
  const catalogQuery = `
    query problemsetQuestionListV2(
      $filters: QuestionFilterInput
      $limit: Int
      $skip: Int
    ) {
      problemsetQuestionListV2(
        filters: $filters
        limit: $limit
        skip: $skip
      ) {
        questions {
          questionFrontendId
          title
          titleSlug
          difficulty
          status
          topicTags { name }
        }
        totalLength
        hasMore
      }
    }
  `;
  const recentQuery = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
      }
    }
  `;
  const unique = new Map();

  async function graphQl(query, variables) {
    const response = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Referer: `https://leetcode.com/u/${username}/`,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`LeetCode returned ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors[0].message);
    return payload.data;
  }

  try {
    const pageSize = 100;
    let skip = 0;
    let total = 1;
    while (skip < total && skip < 5000) {
      const data = await graphQl(catalogQuery, {
        limit: pageSize,
        skip,
        filters: { status: "AC" },
      });
      const page = data?.problemsetQuestionListV2;
      if (!page) throw new Error("Accepted catalogue is unavailable");
      total = page.totalLength || 0;
      for (const item of page.questions || []) {
        unique.set(item.titleSlug, {
          external_id: item.questionFrontendId,
          slug: item.titleSlug,
          title: item.title,
          url: `https://leetcode.com/problems/${item.titleSlug}/`,
          difficulty: item.difficulty,
          topics: (item.topicTags || []).map((topic) => topic.name),
          accepted: true,
        });
      }
      skip += pageSize;
    }
  } catch {
    const data = await graphQl(recentQuery, { username, limit: 5000 });
    for (const item of data?.recentAcSubmissionList || []) {
      unique.set(item.titleSlug, {
        external_id: item.id,
        slug: item.titleSlug,
        title: item.title,
        url: `https://leetcode.com/problems/${item.titleSlug}/`,
        accepted: true,
        solved_at: item.timestamp
          ? new Date(Number(item.timestamp) * 1000).toISOString()
          : null,
      });
    }
  }

  return trackerApi("/api/sync/leetcode", {
    method: "POST",
    body: JSON.stringify({ username, problems: [...unique.values()] }),
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SYNC_LEETCODE") {
    syncLeetCode(message.username)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === "TRACK_ACCEPTED") {
    trackerApi(`/api/sync/${message.platform}`, {
      method: "POST",
      body: JSON.stringify({ problems: [message.problem] }),
    })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

