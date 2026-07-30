(() => {
  const isLeetCode = location.hostname.includes("leetcode.com");
  const platform = isLeetCode ? "leetcode" : "gfg";
  const slug = TrackForgeUtils.problemSlug(location.pathname);
  if (!slug) return;

  let sent = false;


  function detect() {
    if (sent) return;
    const bodyText = document.body?.innerText || "";
    if (!TrackForgeUtils.hasAcceptedSignal(bodyText, platform)) return;

    sent = true;
    const title =
      document.querySelector("h1")?.textContent?.trim() ||
      document.title.split("-")[0].trim() ||
      slug.replaceAll("-", " ");
    const topics = [...document.querySelectorAll('a[href*="/tag/"], a[href*="/explore/"]')]
      .map((node) => node.textContent.trim())
      .filter((value) => value && value.length < 50)
      .slice(0, 20);

    chrome.runtime.sendMessage({
      type: "TRACK_ACCEPTED",
      platform,
      problem: {
        slug,
        title,
        url: isLeetCode
          ? `https://leetcode.com/problems/${slug}/`
          : `https://www.geeksforgeeks.org/problems/${slug}/1`,
        topics,
        accepted: true,
        solved_at: new Date().toISOString(),
      },
    });
  }

  const observer = new MutationObserver(detect);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  detect();
  setTimeout(() => observer.disconnect(), 30 * 60 * 1000);
})();

