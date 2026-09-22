import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SAMPLES = [
  "Did NASA's Artemis II launch before September 2026?",
  "What was the final score of the 2026 World Cup final?",
  "Has the EU AI Act's high-risk obligations taken effect?",
  "Is Bitcoin's block reward currently 3.125 BTC?",
];

export function AskPanel({
  value,
  onChange,
  onSubmit,
  submitting,
  disabled,
  disabledReason,
  error,
  txHash,
  explorer,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled: boolean;
  disabledReason: string | null;
  error: string | null;
  txHash: string | null;
  explorer: string;
}) {
  const len = value.trim().length;
  const valid = len >= 4 && len <= 500;

  return (
    <section className="rounded-xl border border-border bg-card/70 p-5">
      <h2 className="text-sm font-semibold tracking-wide text-foreground">Ask the Oracle</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Your question is answered by validator consensus over independently fetched web evidence.
      </p>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 500))}
        rows={4}
        placeholder="Ask a verifiable question about the real world…"
        className="mt-4 resize-none bg-background/60"
      />
      <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
        <span className={cn(len > 0 && !valid ? "text-amber" : "text-muted-foreground")}>
          {len < 4 ? "Minimum 4 characters" : "4–500 characters"}
        </span>
        <span className={cn(len > 480 ? "text-amber" : "text-muted-foreground")}>{len}/500</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-cyan/40 hover:text-cyan"
          >
            {s}
          </button>
        ))}
      </div>

      <Button
        onClick={onSubmit}
        disabled={!valid || submitting || disabled}
        className="mt-5 w-full bg-cyan text-background hover:bg-cyan/90"
      >
        {submitting ? "Submitting to consensus…" : "Submit question on-chain"}
      </Button>

      {disabled && disabledReason && (
        <p className="mt-2 text-[11px] text-amber">{disabledReason}</p>
      )}
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
      {txHash && (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          tx{" "}
          {explorer ? (
            <a
              className="text-cyan hover:underline"
              href={`${explorer}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {txHash.slice(0, 14)}…
            </a>
          ) : (
            `${txHash.slice(0, 14)}…`
          )}
        </p>
      )}
    </section>
  );
}
