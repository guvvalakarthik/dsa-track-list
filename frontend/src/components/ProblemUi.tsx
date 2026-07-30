import { CheckCircle2, Circle } from "lucide-react";
import type { Problem } from "../types";

export function PlatformBadge({ platform }: { platform: Problem["platform"] }) {
  return (
    <span className={`platform-badge ${platform}`}>
      {platform === "leetcode" ? "LC" : "GFG"}
      <span>{platform === "leetcode" ? "LeetCode" : "GeeksforGeeks"}</span>
    </span>
  );
}

export function StatusPill({ solved, manual }: { solved: boolean; manual?: boolean }) {
  return (
    <span className={`status-pill ${solved ? "solved" : "open"}`}>
      {solved ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      {solved ? "Solved" : "To solve"}
      {manual && <i>Manual</i>}
    </span>
  );
}
