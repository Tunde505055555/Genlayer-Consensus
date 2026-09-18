# Internet Consensus Oracle

A decentralized fact-checking oracle built on **GenLayer Intelligent Contracts**.
Users submit real-world questions; GenLayer validators research the live web,
compare independent sources, and reach consensus on a verdict — all on-chain.

- **Deployed contract (GenLayer Studio):** `0x56CC3A58c282eb96edC87b3B8d93256d750Ee8e5` (hardcoded immutable constant, not user-editable from the UI)
- **Contract version:** v0.5.1 (real source-page extraction, blocked-source skipping, alternative-source retry, review-hardened validation, relaxed equivalence so transactions finalize)
- **Frontend:** React 19 + TanStack Start + Tailwind CSS v4 + genlayer-js

---

## How it works

### 1. Submitting a question
The user connects MetaMask, switches to the GenLayer Studio network
(chain ID `61999`), and submits a question (4–500 characters) by calling the
`submit_question` write method. The question is stored on-chain with status
`in_review`.

### 2. Multi-stage research & judging pipeline
`submit_question` runs a GenLayer non-deterministic block
(`gl.eq_principle.prompt_comparative`) where validators execute this pipeline
and must agree on an equivalent verdict:

1. **PLAN** — the contract *deterministically* builds the search query set
   from the question text itself (raw question, "+ evidence data statistics",
   "+ analysis report findings"). There is **no LLM planner** — every validator
   derives byte-identical queries.
2. **DISCOVER** — search endpoints are used only to obtain *candidate links*,
   never as evidence:
   - the Wikipedia search API resolves matching article titles,
   - the DuckDuckGo Instant Answer JSON API returns abstract/related URLs,
   - the DuckDuckGo HTML page is parsed for its outbound `uddg=` result links.
   Search engines, social networks and other aggregators (Google, Bing, DDG,
   Reddit, X, YouTube, Quora, …) are removed from the candidate list.
3. **OPEN & EXTRACT** — every candidate page is opened directly with
   `gl.nondet.web.render(url, mode="text")` and the real article body is
   extracted (Wikipedia is read through `action=raw`, i.e. full article text
   rather than a snippet). Whitespace is collapsed so character counts reflect
   actual content.
4. **SKIP BLOCKED / THIN SOURCES** — a page is discarded when it is
   unreachable, when it returns a bot wall or JS shell (captcha, "unusual
   traffic", 403, Cloudflare, "enable javascript", rate limit …), or when it
   yields fewer than 500 characters of substantive text. The pipeline simply
   moves on to the next candidate.
5. **INDEPENDENCE** — at most one page per registrable domain is accepted, so
   the accepted set is independent by construction (up to 4 source pages,
   2,200 chars each).
6. **RETRY WITH ALTERNATIVE SOURCES** — if fewer than 2 independent domains
   were obtained, a second round automatically runs with reformulated queries
   ("official report", "study peer reviewed", "explained facts") to reach
   different sources.
7. **VERIFY** — the judging prompt requires validators to check every number,
   date, unit, population and timeframe against the extracted text, and to
   mark each claim supported / refuted / mixed / unverified.
8. **JUDGE** — validators receive only the substantive excerpts from the
   accepted independent pages (up to 7,000 chars total, each with its URL and
   domain) plus a retrieval report (pages opened, independent domains, blocked
   skipped, thin discarded, retry performed). A confident verdict requires at
   least two independent credible sources; with fewer, confidence is capped
   at 40.

### 3. Evidence status
Every verdict reports one of:

| Status | Meaning |
|---|---|
| `evidence_found` | ≥ 2 independent source pages opened with ≥ 1,200 chars of substantive text |
| `insufficient_evidence` | Pages were opened but they do not settle the question |
| `search_failed` | No source page could be opened at all (all blocked/unreachable) |

If zero source pages were opened, the status is forced to `search_failed`
(validators cannot override deterministic retrieval facts).

### 4. Consensus & finalization
Because validators fetch **live** web pages, their source lists legitimately
differ. The equivalence principle therefore compares only the *substantive
judgment* of the `answer` field (same direction — yes/no/true/false/
undetermined — and the same key figure or entity if one is given) and
explicitly instructs validators to ignore wording, confidence, explanation
length, per-claim phrasing, `evidence_status` labels, `sources_count`, and
which URLs/domains each validator managed to open. This is what allows the
transaction to reach ACCEPTED/FINALIZED on the explorer instead of stalling in
COMMITTING. The frontend additionally polls the contract for the stored verdict
so the UI never hangs on a slow receipt.


---

## Project structure

```
contracts/consensus_oracle.py   # The GenLayer Intelligent Contract (Python)
src/lib/genlayer.ts             # Browser client: genlayer-js wrapper, MetaMask
                                # connect, Studio network switch, verdict parsing
src/routes/index.tsx            # Main UI: connect wallet, submit question,
                                # live verdict feed with claims & evidence
src/routes/__root.tsx           # App shell, fonts, <Toaster/>
src/styles.css                  # Dark "oracle" theme (Tailwind v4 tokens)
src/router.tsx, src/start.ts    # TanStack Start bootstrap
```

## Contract API

| Method | Type | Description |
|---|---|---|
| `submit_question(question: str)` | write | Stores the question and runs the consensus pipeline. Emits `UserError` for questions < 4 or > 500 chars. |
| `get_question(qid: int) -> dict` | view | Returns one question with its verdict (or `{"error": "not_found"}`). |
| `list_recent(limit: int) -> list` | view | Newest-first list, capped at 20. |
| `get_next_id() -> int` | view | Total number of questions ever submitted. |
| `latest_qid_of(asker: str) -> int` | view | Latest question id for an address (-1 if none). |

Verdict JSON keys: `answer`, `confidence`, `explanation`, `sources`,
`principle`, `claims` (per-claim status + evidence), `evidence_status`,
`sources_count`, `retrieval` (documents, attempts, retried, queries,
difficulty).

## Running the frontend

```sh
bun install   # or npm install
bun run dev   # http://localhost:8080
```

Requirements: a browser with **MetaMask**. On first use the app offers to add
the GenLayer Studio network (chain ID `61999`, RPC
`https://studio.genlayer.com/api`, symbol `GEN`). Consensus takes a while —
the UI polls until the transaction is accepted and the verdict appears in the
feed.

## Deploying / updating the contract

1. Open GenLayer Studio and deploy `contracts/consensus_oracle.py`
   (no constructor arguments required).
2. The deployed address is hardcoded as the compile-time constant
   `CONTRACT_ADDRESS` in `src/lib/genlayer.ts` and is not editable from the UI.
   If you redeploy and the address changes, update that one constant.

## Notes & limits

- Storage is primitive-only (`u256` + JSON strings) for Studio schema-loader
  compatibility; each question caps at ~2500 chars of text per source and
  14,000 chars of total evidence.
- Questions are stored forever on-chain; `list_recent` only exposes the last 20.
