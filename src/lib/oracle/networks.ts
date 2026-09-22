export interface NetworkPreset {
  id: string;
  name: string;
  rpc: string;
  chainId: number;
  explorer: string;
}

export const DEFAULT_CONTRACT = "0xc2e0CB1284F33080B107cBD5E82C2A84bcC4e584";

/** The oracle contract is deployed on GenLayer Studionet only. */
export const STUDIONET: NetworkPreset = {
  id: "studionet",
  name: "GenLayer Studionet",
  rpc: "https://studio.genlayer.com/api",
  chainId: 61999,
  explorer: "https://studio.genlayer.com",
};
