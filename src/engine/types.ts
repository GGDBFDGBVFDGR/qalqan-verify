export type Verdict = "scheme" | "suspicious" | "calm";

export type SchemeId =
  | "safe_account"
  | "relative_emergency"
  | "fake_investment"
  | "marketplace_prepay"
  | "phishing_link"
  | "remote_access";

export type Language = "ru" | "kk" | "mixed";

export interface AnalysisInput {
  text: string;
  link?: string;
  transcript?: string;
  hasImage?: boolean;
  hasAudio?: boolean;
}

export interface Evidence {
  id: string;
  title: string;
  quote: string;
}

export interface SourceCheck {
  label: string;
  detail: string;
  status: "risk" | "ok" | "unknown";
}

export interface ChainStep {
  id: string;
  label: string;
}

export interface Analysis {
  verdict: Verdict;
  schemeId: SchemeId | null;
  title: string;
  summary: string;
  summaryKk: string | null;
  confidence: "высокая" | "средняя" | "ограниченная";
  language: Language;
  evidence: Evidence[];
  chain: ChainStep[];
  sourceChecks: SourceCheck[];
  safeSteps: string[];
  notChecked: string[];
  groups: number;
  phones: string[];
  domains: string[];
}
