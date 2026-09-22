# Internet Consensus Oracle

A web app for asking verifiable real-world questions and receiving on-chain verdicts backed by **GenLayer validator consensus**. Validators independently research the open web, cross-check atomic claims, and converge on a single verdict — with every fetched source recorded on-chain.

Built with TanStack Start (React 19), TypeScript, Tailwind CSS v4, and `genlayer-js`.

---

## Features

- **Ask a question on-chain** — connect MetaMask and submit any verifiable real-world question (4–500 characters) to the oracle contract.
- **Strict per-submission tracking** — every submission is bound to its own question ID. The app polls `get_submission_status(qid)` for that exact ID until validator consensus is reached, so repeat users never see a previous question's verdict by mistake.
- **Live consensus pipeline** — while validators work, a progress view shows the stages: Plan → Research → Verify → Judge.
- **Full verdict presentation** — once consensus is reached, the app renders:
  - The substantive answer headline and explanation
  - A confidence gauge (0–100%)
  - The evidence status badge: `evidence_found`, `insufficient_evidence`, or `search_failed`
  - The exact count of independent sources retrieved and verified by consensus
  - The verified fetched source URLs, with domain chips and external links
  - The principle the validators applied
  - An atomic-claims table (each claim marked supported / refuted / mixed / unverified, with evidence notes)
  - A retrieval audit panel: pages opened, independent domains, fetch attempts, blocked/thin pages discarded, retries
- **Recent verdicts feed** — searchable, filterable, with shareable deep links (`?qid=<id>`).
- **Fixed contract** — the oracle contract address is hardcoded and not editable from the UI, so the app always talks to the intended deployment.

## Network

The oracle contract is deployed on **GenLayer Studionet** — the only network the app uses.

| Setting  | Value                                        |
| -------- | -------------------------------------------- |
| Network  | GenLayer Studionet                           |
| Chain ID | 61999                                        |
| RPC      | https://studio.genlayer.com/api              |
| Explorer | https://studio.genlayer.com                  |
| Contract | `0xc2e0CB1284F33080B107cBD5E82C2A84bcC4e584` |

If MetaMask is on another chain, the app offers a one-click "Switch to GenLayer Studionet" button (adds the network to MetaMask automatically if needed).

## Requirements

- Node.js 18+ (or Bun)
- A browser with the **MetaMask** extension
- A Studionet account with GEN for transaction fees when submitting questions (reading verdicts and browsing the feed work without a wallet)

## Setup

```sh
npm install
npm run dev
```

Then open the local URL shown in the terminal (default `http://localhost:8080`).

## Using the app

1. Click **Connect MetaMask** and approve the connection.
2. If prompted, click **Switch to GenLayer Studionet**.
3. Type a verifiable real-world question (e.g. "Did NASA's Artemis II launch before September 2026?") and submit.
4. Confirm the transaction in MetaMask. The app resolves the exact new question ID from your transaction and begins tracking it.
5. Watch the consensus pipeline until the verdict appears.
6. Share the verdict with the `?qid=` deep link, or reopen it later from the recent-verdicts feed.

## Contract interface

The frontend matches `consensus_oracle.py`:

| Method                                      | Description                                                   |
| ------------------------------------------- | ------------------------------------------------------------- |
| `submit_question(question: str) -> int`     | Submit a question (4–500 chars); returns the new question ID  |
| `get_submission_status(qid: int) -> dict`   | `{id, status, completed, verdict}` strictly bound to that ID  |
| `get_question(qid: int) -> dict`            | `{id, question, asker, status, verdict}`                      |
| `latest_qid_of(asker: str) -> int`          | Latest question ID submitted by an address                    |
| `list_recent(limit: int) -> list`           | Recent questions                                              |

Reads use `genlayer-js` `readContract`; submissions use `writeContract` signed by the connected MetaMask account (EIP-1193).

## Project structure

```
src/
  routes/
    index.tsx            Main page: submit, track, verdict, recent feed
  components/oracle/
    ConnectionBar.tsx    Studionet info, fixed contract address, wallet widget
    AskPanel.tsx         Question composer with character counter
    Pipeline.tsx         Live Plan → Research → Verify → Judge progress
    VerdictCard.tsx      Verdict, evidence, sources, claims, retrieval audit
    RecentFeed.tsx       Searchable/filterable recent verdicts feed
    badges.tsx           Evidence-status and claim-status badges
  lib/oracle/
    networks.ts          Studionet preset + fixed contract address
    client.ts            genlayer-js reads/writes against the contract
    useWallet.ts         MetaMask (EIP-1193) connection hook
    types.ts             Verdict / question / status types
```

## Scripts

| Command         | Purpose              |
| --------------- | -------------------- |
| `npm run dev`   | Start the dev server |
| `npm run build` | Production build     |

---

Built with [Lovable](https://lovable.dev).
