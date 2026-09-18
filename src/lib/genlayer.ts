/**
 * Browser-only helpers for talking to the ConsensusOracle intelligent contract
 * deployed on the GenLayer Studio network.
 *
 * Everything here dynamically imports genlayer-js so the module stays safe to
 * reference from SSR-rendered route files.
 */

// Deployed ConsensusOracle contract on GenLayer Studio (v0.5.1, deterministic retrieval).
// This value is a compile-time constant and is not editable from the UI.
export const CONTRACT_ADDRESS = "0x56CC3A58c282eb96edC87b3B8d93256d750Ee8e5" as const;

export type ClaimCheck = {
  claim: string;
  status: "supported" | "refuted" | "mixed" | "unverified" | string;
  evidence: string;
};

export type EvidenceStatus = "evidence_found" | "insufficient_evidence" | "search_failed";

export type Verdict = {
  answer: string;
  confidence: number;
  explanation: string;
  sources: string[];
  principle: string;
  claims: ClaimCheck[];
  evidenceStatus: EvidenceStatus;
  sourcesCount: number;
  retrieval: {
    documents: number;
    attempts: number;
    retried: boolean;
    queries: string[];
    domains: string[];
    blocked: number;
    thin: number;
  } | null;

};


export type OracleQuestion = {
  id: number;
  question: string;
  asker: string;
  status: "in_review" | "consensus_reached" | string;
  verdict: Verdict | null;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function getEthereum(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
}

export function hasMetaMask(): boolean {
  return Boolean(getEthereum());
}

async function makeClient(account?: string) {
  const [{ createClient }, { studionet }] = await Promise.all([
    import("genlayer-js"),
    import("genlayer-js/chains"),
  ]);
  return createClient({
    chain: studionet as never,
    ...(account ? { account: account as `0x${string}` } : {}),
  } as never);
}

export const STUDIO_CHAIN_ID = 61999;
const STUDIO_CHAIN_ID_HEX = "0xf22f";
const STUDIO_RPC = "https://studio.genlayer.com/api";

/** Makes sure MetaMask is pointed at the GenLayer Studio network before signing. */
export async function ensureStudioNetwork(): Promise<void> {
  const ethereum = getEthereum();
  if (!ethereum) return;
  try {
    const current = (await ethereum.request({ method: "eth_chainId" })) as string;
    if (current?.toLowerCase() === STUDIO_CHAIN_ID_HEX) return;
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIO_CHAIN_ID_HEX }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902 || code === -32603) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: STUDIO_CHAIN_ID_HEX,
            chainName: "GenLayer Studio",
            nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
            rpcUrls: [STUDIO_RPC],
          },
        ],
      });
      return;
    }
    throw err;
  }
}

export async function connectWallet(): Promise<string> {
  const ethereum = getEthereum();
  if (!ethereum) throw new Error("MetaMask not detected. Install the MetaMask extension to continue.");
  const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.length) throw new Error("No account was authorized in MetaMask.");
  try {
    await ensureStudioNetwork();
  } catch {
    // Non-fatal: the user can still read, and we retry the switch before writing.
  }
  return accounts[0] as string;
}

export async function getConnectedAccount(): Promise<string | null> {
  const ethereum = getEthereum();
  if (!ethereum) return null;
  try {
    const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

function normalizeVerdict(raw: unknown): Verdict | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const sources = Array.isArray(v["sources"]) ? v["sources"].map((s) => String(s)) : [];
  const claims: ClaimCheck[] = Array.isArray(v["claims"])
    ? v["claims"].map((c) => {
        const o = (c ?? {}) as Record<string, unknown>;
        return {
          claim: String(o["claim"] ?? c),
          status: String(o["status"] ?? "unverified"),
          evidence: String(o["evidence"] ?? ""),
        };
      })
    : [];
  const rawStatus = String(v["evidence_status"] ?? "evidence_found");
  const evidenceStatus: EvidenceStatus =
    rawStatus === "search_failed" || rawStatus === "insufficient_evidence"
      ? rawStatus
      : "evidence_found";
  const r = (v["retrieval"] ?? null) as Record<string, unknown> | null;
  return {
    answer: String(v["answer"] ?? ""),
    confidence: Number(v["confidence"] ?? 0),
    explanation: String(v["explanation"] ?? ""),
    sources,
    principle: String(v["principle"] ?? ""),
    claims,
    evidenceStatus,
    sourcesCount: Number(v["sources_count"] ?? sources.length),
    retrieval: r
      ? {
          documents: Number(r["documents"] ?? 0),
          attempts: Number(r["attempts"] ?? 0),
          retried: Boolean(r["retried"]),
          queries: Array.isArray(r["queries"]) ? r["queries"].map((q) => String(q)) : [],
          domains: Array.isArray(r["domains"]) ? r["domains"].map((d) => String(d)) : [],
          blocked: Number(r["blocked"] ?? 0),
          thin: Number(r["thin"] ?? 0),
        }
      : null,

  };

}

function normalizeQuestion(raw: unknown): OracleQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  if (q["question"] === undefined) return null;
  return {
    id: Number(q["id"] ?? 0),
    question: String(q["question"] ?? ""),
    asker: String(q["asker"] ?? ""),
    status: String(q["status"] ?? "in_review"),
    verdict: normalizeVerdict(q["verdict"]),
  };
}

/** Reads the most recent questions (newest first). */
export async function listRecent(limit = 10): Promise<OracleQuestion[]> {
  const client = await makeClient();
  const result = (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "list_recent",
    args: [limit],
  })) as unknown;
  if (!Array.isArray(result)) return [];
  return result.map(normalizeQuestion).filter((q): q is OracleQuestion => q !== null);
}

export async function getQuestion(qid: number): Promise<OracleQuestion | null> {
  const client = await makeClient();
  const result = (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_question",
    args: [qid],
  })) as unknown;
  return normalizeQuestion(result);
}

export async function latestQidOf(asker: string): Promise<number> {
  const client = await makeClient();
  const result = (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "latest_qid_of",
    args: [asker.toLowerCase()],
  })) as unknown;
  return Number(result ?? -1);
}

export async function getNextId(): Promise<number> {
  const client = await makeClient();
  const result = (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_next_id",
  })) as unknown;
  return Number(result ?? 0);
}

/** Submits a question and waits for the transaction to be accepted by consensus. */
export async function submitQuestion(
  account: string,
  question: string,
  onStage?: (stage: string) => void,
): Promise<string> {
  const client = await makeClient(account);
  onStage?.("Switching MetaMask to GenLayer Studio…");
  await ensureStudioNetwork();
  onStage?.("Awaiting MetaMask signature…");
  const hash = (await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "submit_question",
    args: [question],
    value: BigInt(0),
  })) as string;

  onStage?.("Validators are researching and reaching consensus…");

  // Studio transactions can sit in COMMITTING for a long time. Instead of
  // waiting on the receipt forever, we poll the contract itself: once the
  // question shows up with a verdict, the run succeeded.
  const startedAt = Date.now();
  const TIMEOUT_MS = 10 * 60 * 1000;
  const receiptDone = client
    .waitForTransactionReceipt({
      hash: hash as never,
      status: "ACCEPTED" as never,
      interval: 5000,
      retries: 120,
    })
    .then(() => true)
    .catch(() => false);
  let receiptSettled = false;
  void receiptDone.then(() => {
    receiptSettled = true;
  });

  while (Date.now() - startedAt < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const qid = await latestQidOf(account);
      if (qid >= 0) {
        const q = await getQuestion(qid);
        if (q?.verdict) return hash;
      }
    } catch {
      // transient RPC hiccup - keep polling
    }
    if (receiptSettled && (await receiptDone)) return hash;
  }

  throw new Error(
    "Consensus is taking unusually long — the transaction is still committing on GenLayer Studio. Your verdict will appear in the feed once validators finish.",
  );
  return hash;
}

export function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
