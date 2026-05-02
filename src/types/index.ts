export interface ParsedResume {
  rawText: string;
  skills: string[];
  implied_skills: string[];
  job_titles: string[];
  search_terms: string[];
  experience_years: number;
  industries: string[];
  achievements: string[];
}

export interface AdzunaJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salaryMin?: number;
  salaryMax?: number;
  url: string;
  postedAt: string;
  logoUrl?: string;
}

export interface ScoredJob extends AdzunaJob {
  overall_score: number;
  skills_score: number;
  title_score: number;
  domain_score: number;
  matched: string[];
  missing: string[];
  reasoning: string;
  applied?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  location?: string;
  linkedin_url?: string;
  resume_url?: string;
  resume_text?: string;
  notification_enabled: boolean;
  notification_frequency: "daily" | "weekly" | "instant";
  created_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  job_title: string;
  company: string;
  match_score: number;
  job_url: string;
  status: "new" | "viewed" | "applied";
  created_at: string;
}

export interface JobFilters {
  location?: string;
  jobType?: "remote" | "hybrid" | "onsite" | "";
  datePosted?: "1" | "7" | "30" | "";
}
