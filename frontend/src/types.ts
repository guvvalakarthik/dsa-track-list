export type Platform = "leetcode" | "gfg";

export interface Problem {
  id: number;
  platform: Platform;
  external_id: string | null;
  slug: string;
  title: string;
  url: string;
  difficulty: string | null;
  rating: number | null;
  contest: string | null;
  question_index: string | null;
  topics: string[];
  custom_topics: string[];
  auto_solved: boolean;
  manual_override: boolean | null;
  solved: boolean;
  group_solved: boolean;
  solved_at: string | null;
  source: string;
  equivalence_key: string | null;
}

export interface Recommendation extends Problem {
  recommendation_score: number;
  shared_topics: string[];
  related_to: Array<{ id: number; title: string; url: string }>;
  reason: string;
}

export interface TopicSummary {
  name: string;
  total: number;
  solved: number;
}

export interface Summary {
  total: number;
  solved: number;
  leetcode_solved: number;
  gfg_solved: number;
  completion: number;
  recent_solved: Problem[];
  topics: TopicSummary[];
}


