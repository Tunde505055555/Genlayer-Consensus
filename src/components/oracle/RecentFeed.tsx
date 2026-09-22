import { Input } from "@/components/ui/input";
import { EvidenceBadge } from "./badges";
import type { OracleQuestion } from "@/lib/oracle/types";
import { cn } from "@/lib/utils";

export type FeedFilter = "all" | "consensus_reached" | "in_review";

export function RecentFeed({
  items,
  loading,
  error,
  search,
  onSearch,
  filter,
  onFilter,
  onOpen,
  activeQid,
}: {
  items: OracleQuestion[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearch: (v: string) => void;
  filter: FeedFilter;
  onFilter: (f: FeedFilter) => void;
  onOpen: (qid: number) => void;
  activeQid: number | null;
}) {
  const filtered = items.filter((q) => {
    const matchesText = q.question?.toLowerCase().includes(search.trim().toLowerCase());
    const matchesFilter = filter === "all" || q.status === filter;
    return matchesText && matchesFilter;
  });

  return (
    <section className="rounded-xl border border-border bg-card/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">
          Recent Consensus Verdicts
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "consensus_reached", "in_review"] as FeedFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFilter(f)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                filter === f
                  ? "border-cyan/50 bg-cyan/10 text-cyan"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search questions…"
        className="mt-4"
      />

      {error && <p className="mt-4 text-xs text-destructive">{error}</p>}
      {loading && !items.length && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">Reading contract state…</p>
      )}
      {!loading && !filtered.length && !error && (
        <p className="mt-4 text-xs text-muted-foreground">No questions match this view yet.</p>
      )}

      <ul className="mt-4 space-y-2">
        {filtered.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => onOpen(q.id)}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                activeQid === q.id
                  ? "border-cyan/50 bg-cyan/5"
                  : "border-border bg-background/50 hover:border-cyan/30",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-foreground">{q.question}</p>
                {q.verdict ? (
                  <EvidenceBadge status={q.verdict.evidence_status} />
                ) : (
                  <span className="shrink-0 rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan">
                    In review
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                QID #{q.id}
                {q.verdict ? ` · ${q.verdict.independent_sources ?? 0} independent sources` : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
