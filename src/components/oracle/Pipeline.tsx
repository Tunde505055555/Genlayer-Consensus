import { PIPELINE_STAGES } from "@/lib/oracle/types";
import { cn } from "@/lib/utils";

export function Pipeline({
  qid,
  activeIndex,
  elapsed,
  polls,
}: {
  qid: number;
  activeIndex: number;
  elapsed: number;
  polls: number;
}) {
  return (
    <section className="glow-cyan rounded-xl border border-cyan/30 bg-card/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-cyan">
          <span className="pulse-dot h-2 w-2 rounded-full bg-cyan" />
          In Review · Validators Reaching Consensus
        </h2>
        <p className="font-mono text-[11px] text-muted-foreground">
          QID #{qid} · {Math.floor(elapsed / 1000)}s · {polls} status reads
        </p>
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PIPELINE_STAGES.map((stage, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={stage.key}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                done && "border-emerald/40 bg-emerald/5",
                active && "border-cyan/50 bg-cyan/5",
                !done && !active && "border-border bg-secondary/30",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    done && "bg-emerald",
                    active && "pulse-dot bg-cyan",
                    !done && !active && "bg-muted-foreground/50",
                  )}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
                  {i + 1}. {stage.label}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{stage.detail}</p>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">
        Tracking question <span className="font-mono text-foreground">#{qid}</span> only. This panel
        clears when <span className="font-mono">get_submission_status({qid})</span> reports
        consensus for this exact submission.
      </p>
    </section>
  );
}
