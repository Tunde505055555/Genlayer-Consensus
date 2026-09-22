import { cn } from "@/lib/utils";
import type { ClaimStatus, EvidenceStatus } from "@/lib/oracle/types";

const EVIDENCE_META: Record<EvidenceStatus, { label: string; className: string }> = {
  evidence_found: {
    label: "Evidence Found",
    className: "border-emerald/40 bg-emerald/10 text-emerald",
  },
  insufficient_evidence: {
    label: "Insufficient Evidence",
    className: "border-amber/40 bg-amber/10 text-amber",
  },
  search_failed: {
    label: "Search Failed",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

export function EvidenceBadge({
  status,
  className,
}: {
  status: EvidenceStatus;
  className?: string;
}) {
  const meta = EVIDENCE_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]",
        meta.className,
        className,
      )}
    >
      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

const CLAIM_META: Record<ClaimStatus, string> = {
  supported: "border-emerald/40 bg-emerald/10 text-emerald",
  refuted: "border-destructive/40 bg-destructive/10 text-destructive",
  mixed: "border-amber/40 bg-amber/10 text-amber",
  unverified: "border-border bg-muted text-muted-foreground",
};

export function ClaimBadge({ status }: { status: ClaimStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        CLAIM_META[status],
      )}
    >
      {status}
    </span>
  );
}
