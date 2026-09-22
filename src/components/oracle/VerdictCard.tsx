import { useState } from "react";
import { ExternalLink, Lock, ShieldAlert, ChevronDown } from "lucide-react";
import { ClaimBadge, EvidenceBadge } from "./badges";
import type { OracleQuestion, Verdict } from "@/lib/oracle/types";
import { cn } from "@/lib/utils";

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isSecure(url: string) {
  return url.startsWith("https://");
}

export function VerdictCard({
  question,
  verdict,
  compact,
}: {
  question: OracleQuestion;
  verdict: Verdict;
  compact?: boolean;
}) {
  const [auditOpen, setAuditOpen] = useState(false);
  const urls = Array.isArray(verdict.fetched_urls) ? verdict.fetched_urls : [];
  const claims = Array.isArray(verdict.claims) ? verdict.claims : [];
  const confidence = Math.max(0, Math.min(100, Number(verdict.confidence) || 0));
  const audit = verdict.audit;

  return (
    <article className="rounded-xl border border-border bg-card/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            QID #{question.id} · {question.asker ? `${question.asker.slice(0, 10)}…` : "unknown asker"}
          </p>
          <h3 className="mt-1 text-base font-semibold text-foreground">{question.question}</h3>
        </div>
        <EvidenceBadge status={verdict.evidence_status} />
      </div>

      <div className="mt-4 rounded-lg border border-cyan/25 bg-cyan/5 p-4">
        <p className="text-lg font-semibold leading-snug text-foreground">{verdict.answer}</p>
        <div className="mt-3">
          <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Consensus confidence</span>
            <span className="text-cyan">{confidence}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan to-emerald transition-[width] duration-700"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Independent sources" value={String(verdict.independent_sources ?? 0)} />
        <Stat label="Verified fetched URLs" value={String(urls.length)} />
        <Stat label="Atomic claims" value={String(claims.length)} />
      </div>

      {!compact && (
        <>
          <Block title="Explanation">{verdict.explanation}</Block>
          <Block title="Principle applied">{verdict.principle}</Block>

          <div className="mt-5">
            <SectionTitle>Verified fetched sources</SectionTitle>
            {urls.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5 text-amber" />
                No source pages were successfully fetched for this verdict.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {urls.map((url) => (
                  <li
                    key={url}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 font-mono text-[10px] text-cyan">
                        {domainOf(url)}
                      </span>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                        {url}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Lock
                        className={cn(
                          "h-3.5 w-3.5",
                          isSecure(url) ? "text-emerald" : "text-amber",
                        )}
                      />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-muted-foreground hover:text-cyan"
                        aria-label={`Open ${domainOf(url)}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {claims.length > 0 && (
            <div className="mt-5">
              <SectionTitle>Atomic claim verification</SectionTitle>
              <ul className="mt-2 space-y-2">
                {claims.map((c, i) => (
                  <li
                    key={`${c.claim}-${i}`}
                    className="rounded-lg border border-border bg-background/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-foreground">{c.claim}</p>
                      <ClaimBadge status={c.status} />
                    </div>
                    {c.note && <p className="mt-1.5 text-xs text-muted-foreground">{c.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {audit && (
            <div className="mt-5 rounded-lg border border-border bg-background/50">
              <button
                type="button"
                onClick={() => setAuditOpen((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Retrieval audit
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    auditOpen && "rotate-180",
                  )}
                />
              </button>
              {auditOpen && (
                <dl className="grid gap-3 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Stat label="Pages opened" value={String(audit.pages_opened ?? 0)} />
                  <Stat label="Independent domains" value={String(audit.independent_domains ?? 0)} />
                  <Stat label="Fetch attempts" value={String(audit.fetch_attempts ?? 0)} />
                  <Stat
                    label="Blocked / thin discarded"
                    value={String(audit.discarded_blocked_or_thin ?? 0)}
                  />
                  <Stat label="Retry performed" value={audit.retried ? "Yes" : "No"} />
                </dl>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg text-foreground">{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </h4>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <SectionTitle>{title}</SectionTitle>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
