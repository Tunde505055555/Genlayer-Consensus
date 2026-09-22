export type EvidenceStatus = "evidence_found" | "insufficient_evidence" | "search_failed";
export type ClaimStatus = "supported" | "refuted" | "mixed" | "unverified";
export type QuestionStatus = "in_review" | "consensus_reached";

export interface AtomicClaim {
  claim: string;
  status: ClaimStatus;
  note: string;
}

export interface RetrievalAudit {
  pages_opened: number;
  independent_domains: number;
  fetch_attempts: number;
  discarded_blocked_or_thin: number;
  retried: boolean;
}

export interface Verdict {
  answer: string;
  confidence: number; // 0-100
  explanation: string;
  principle: string;
  evidence_status: EvidenceStatus;
  independent_sources: number;
  fetched_urls: string[];
  claims: AtomicClaim[];
  audit: RetrievalAudit;
}

export interface OracleQuestion {
  id: number;
  question: string;
  asker: string;
  status: QuestionStatus;
  verdict: Verdict | null;
  created_at?: number;
}

export interface SubmissionStatus {
  id: number;
  status: QuestionStatus;
  completed: boolean;
  verdict: Verdict | null;
}

export type PipelineStage = "plan" | "research" | "verify" | "judge";

export const PIPELINE_STAGES: { key: PipelineStage; label: string; detail: string }[] = [
  { key: "plan", label: "Plan", detail: "Decomposing the question into atomic, checkable claims" },
  { key: "research", label: "Research", detail: "Validators fetching independent source pages" },
  { key: "verify", label: "Verify", detail: "Cross-checking claims against fetched evidence" },
  { key: "judge", label: "Judge", detail: "Validators converging on an optimistic-democracy verdict" },
];
