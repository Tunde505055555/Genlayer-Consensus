import { createClient } from "genlayer-js";
import * as genChains from "genlayer-js/chains";
import type { OracleQuestion, SubmissionStatus } from "./types";

type GenChain = NonNullable<NonNullable<Parameters<typeof createClient>[0]>["chain"]>;

const CHAIN = genChains.studionet as unknown as GenChain;

export interface ChainConfig {
  contract: string;
  sender: string;
}

function client(cfg: ChainConfig) {
  return cfg.sender
    ? createClient({ chain: CHAIN, account: cfg.sender as `0x${string}` })
    : createClient({ chain: CHAIN });
}

async function read<T>(cfg: ChainConfig, functionName: string, args: unknown[]): Promise<T> {
  const result = await client(cfg).readContract({
    address: cfg.contract as `0x${string}`,
    functionName,
    args: args as never[],
  });
  if (typeof result === "string") {
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  }
  return result as T;
}

export const oracle = {
  async getSubmissionStatus(cfg: ChainConfig, qid: number): Promise<SubmissionStatus> {
    const r = await read<SubmissionStatus>(cfg, "get_submission_status", [qid]);
    return { ...r, id: qid };
  },
  getQuestion(cfg: ChainConfig, qid: number): Promise<OracleQuestion> {
    return read<OracleQuestion>(cfg, "get_question", [qid]);
  },
  async latestQidOf(cfg: ChainConfig, asker: string): Promise<number> {
    const raw = await read<unknown>(cfg, "latest_qid_of", [asker]);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  },
  async listRecent(cfg: ChainConfig, limit: number): Promise<OracleQuestion[]> {
    const list = await read<OracleQuestion[]>(cfg, "list_recent", [limit]);
    return Array.isArray(list) ? list : [];
  },
  /** Submits via the connected MetaMask signer and returns the transaction hash. */
  async submitQuestion(cfg: ChainConfig, question: string): Promise<string> {
    if (!cfg.sender) throw new Error("Connect MetaMask before submitting.");
    const hash = await client(cfg).writeContract({
      address: cfg.contract as `0x${string}`,
      functionName: "submit_question",
      args: [question],
      value: BigInt(0),
    });
    return hash as unknown as string;
  },
  async waitForTx(cfg: ChainConfig, hash: string) {
    return client(cfg).waitForTransactionReceipt({
      hash,
      status: "FINALIZED",
      retries: 100,
      interval: 5000,
    } as never);
  },
};
