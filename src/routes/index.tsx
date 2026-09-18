import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CONTRACT_ADDRESS,
  connectWallet,
  getConnectedAccount,
  getEthereum,
  hasMetaMask,
  listRecent,
  shortAddress,
  submitQuestion,
  type OracleQuestion,
} from "@/lib/genlayer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Internet Consensus Oracle — Ask the Validators" },
      {
        name: "description",
        content:
          "Ask any subjective question and get an evidence-backed verdict decided by GenLayer validators reaching consensus on live internet data.",
      },
      { property: "og:title", content: "Internet Consensus Oracle" },
      {
        property: "og:description",
        content:
          "Evidence-backed verdicts from GenLayer validators. Connect MetaMask, ask a question, watch consensus form.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground">{pct}% confidence</span>
    </div>
  );
}

function QuestionCard({ q }: { q: OracleQuestion }) {
  const settled = q.status === "consensus_reached" && q.verdict;
  return (
    <article className="panel p-5 transition-colors hover:border-primary/40">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="max-w-[46ch] text-base font-semibold leading-snug text-foreground">
          {q.question}
        </h3>
        <Badge
          variant={settled ? "default" : "secondary"}
          className="shrink-0 font-mono text-[10px] uppercase tracking-wider"
        >
          {settled ? "consensus" : "in review"}
        </Badge>
      </header>

      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        #{q.id} · asked by {shortAddress(q.asker)}
      </p>

      {settled && q.verdict ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={q.verdict.evidenceStatus === "evidence_found" ? "default" : "secondary"}
              className="font-mono text-[10px] uppercase tracking-wider"
            >
              {q.verdict.evidenceStatus === "evidence_found"
                ? "evidence found"
                : q.verdict.evidenceStatus === "insufficient_evidence"
                  ? "insufficient evidence"
                  : "web search failed"}
            </Badge>
            <span className="font-mono text-[11px] text-muted-foreground">
              {q.verdict.sourcesCount} independent source
              {q.verdict.sourcesCount === 1 ? "" : "s"}
              {q.verdict.retrieval
                ? ` · ${q.verdict.retrieval.documents} source page${
                    q.verdict.retrieval.documents === 1 ? "" : "s"
                  } opened / ${q.verdict.retrieval.attempts} tried${
                    q.verdict.retrieval.blocked
                      ? ` · ${q.verdict.retrieval.blocked} blocked skipped`
                      : ""
                  }${q.verdict.retrieval.retried ? " · retried" : ""}`
                : ""}

            </span>
          </div>

          <p className="border-l-2 border-primary pl-3 text-sm leading-relaxed text-foreground">
            {q.verdict.answer}
          </p>
          <ConfidenceBar value={q.verdict.confidence} />
          <p className="text-sm leading-relaxed text-muted-foreground">{q.verdict.explanation}</p>

          {q.verdict.claims.length ? (
            <ul className="space-y-2">
              {q.verdict.claims.map((c, i) => (
                <li key={`${q.id}-claim-${i}`} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs leading-relaxed text-foreground">{c.claim}</p>
                    <span
                      className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${
                        c.status === "supported"
                          ? "text-primary"
                          : c.status === "refuted"
                            ? "text-destructive"
                            : "text-accent"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  {c.evidence ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      {c.evidence}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {q.verdict.retrieval?.queries.length ? (
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              queries · {q.verdict.retrieval.queries.join(" | ")}
            </p>
          ) : null}

          {q.verdict.principle ? (
            <p className="rounded-md bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-mono uppercase tracking-wider text-accent">Principle · </span>
              {q.verdict.principle}
            </p>
          ) : null}
          {q.verdict.sources.length ? (
            <ul className="flex flex-wrap gap-2">
              {q.verdict.sources.slice(0, 5).map((s, i) => (
                <li
                  key={`${q.id}-src-${i}`}
                  className="max-w-full truncate rounded-full border border-border px-3 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

      ) : (
        <p className="mt-4 font-mono text-xs text-accent">
          Validators are still researching this one…
        </p>
      )}
    </article>
  );
}

function Index() {
  const [account, setAccount] = useState<string | null>(null);
  const [metamask, setMetamask] = useState(true);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("");
  const [questions, setQuestions] = useState<OracleQuestion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await listRecent(10);
      if (!mounted.current) return;
      setQuestions(data);
      setLoadError(null);
    } catch (err) {
      if (!mounted.current) return;
      setQuestions([]);
      setLoadError(err instanceof Error ? err.message : "Could not reach the GenLayer Studio network.");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    setMetamask(hasMetaMask());
    void getConnectedAccount().then((a) => mounted.current && setAccount(a));
    void refresh();

    const ethereum = getEthereum();
    const onAccounts = (...args: unknown[]) => {
      const accounts = (args[0] as string[]) ?? [];
      setAccount(accounts[0] ?? null);
    };
    ethereum?.on?.("accountsChanged", onAccounts);

    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      ethereum?.removeListener?.("accountsChanged", onAccounts);
    };
  }, [refresh]);

  const handleConnect = async () => {
    try {
      const addr = await connectWallet();
      setAccount(addr);
      toast.success(`Connected ${shortAddress(addr)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not connect MetaMask.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = question.trim();
    if (!account) {
      toast.error("Connect MetaMask first.");
      return;
    }
    if (text.length < 4) {
      toast.error("Your question is too short (minimum 4 characters).");
      return;
    }
    if (text.length > 500) {
      toast.error("Your question is too long (maximum 500 characters).");
      return;
    }

    setSubmitting(true);
    setStage("Awaiting MetaMask signature…");
    try {
      await submitQuestion(account, text, (s) => mounted.current && setStage(s));
      toast.success("Consensus reached — verdict is on chain.");
      setQuestion("");
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed.";
      toast.error(msg.slice(0, 220));
    } finally {
      if (mounted.current) {
        setSubmitting(false);
        setStage("");
      }
    }
  };

  return (
    <main className="min-h-screen">
      <Toaster />
      <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-10 sm:pt-16">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="aurora glow flex size-10 items-center justify-center rounded-xl border border-border">
              <span className="font-mono text-sm text-primary">◎</span>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                GenLayer Studio
              </p>
              <p className="text-sm font-semibold">Consensus Oracle</p>
            </div>
          </div>

          {account ? (
            <div className="panel flex items-center gap-2 px-3 py-2">
              <span className="size-2 rounded-full bg-primary" />
              <span className="font-mono text-xs">{shortAddress(account)}</span>
            </div>
          ) : (
            <Button onClick={handleConnect} disabled={!metamask}>
              {metamask ? "Connect MetaMask" : "MetaMask not detected"}
            </Button>
          )}
        </header>

        <section className="mt-12">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Ask the internet.
            <br />
            <span className="text-primary">Get a verdict validators agree on.</span>
          </h1>
          <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every question is answered by independent GenLayer validators that fetch live web
            evidence inside the contract, then must agree on the substance of the answer — not just
            its format — before it is written on chain.
          </p>
          <p className="mt-4 break-all font-mono text-[11px] text-muted-foreground">
            contract · {CONTRACT_ADDRESS}
          </p>
        </section>

        <form onSubmit={handleSubmit} className="panel mt-8 p-5">
          <label htmlFor="question" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Your question
          </label>
          <Textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Is remote work more productive than office work in 2026?"
            rows={3}
            maxLength={500}
            disabled={submitting}
            className="mt-3 resize-none border-input bg-background/60 text-base"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              {question.trim().length}/500
            </span>
            <Button type="submit" disabled={submitting || !account}>
              {submitting ? "Reaching consensus…" : "Submit to the oracle"}
            </Button>
          </div>
          {submitting ? (
            <p className="mt-4 flex items-center gap-2 font-mono text-xs text-accent">
              <span className="size-2 animate-pulse rounded-full bg-accent" />
              {stage}
            </p>
          ) : null}
          {!account ? (
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Connect MetaMask to submit. Reading past verdicts works without a wallet.
            </p>
          ) : null}
        </form>

        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent verdicts</h2>
            <button
              onClick={() => void refresh()}
              className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary"
            >
              refresh
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {questions === null ? (
              <>
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </>
            ) : loadError ? (
              <div className="panel p-5">
                <p className="text-sm text-destructive">{loadError}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Make sure the contract is deployed and running on GenLayer Studio.
                </p>
              </div>
            ) : questions.length === 0 ? (
              <div className="panel p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No questions yet — be the first to ask the oracle.
                </p>
              </div>
            ) : (
              questions.map((q) => <QuestionCard key={q.id} q={q} />)
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
