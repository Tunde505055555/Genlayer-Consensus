import { useCallback, useEffect, useState } from "react";
import type { NetworkPreset } from "./networks";

type Eip1193 = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on: (event: string, handler: (...args: never[]) => void) => void;
  removeListener: (event: string, handler: (...args: never[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

function getProvider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export interface WalletState {
  available: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  connecting: boolean;
  error: string | null;
}

export function useWallet(network: NetworkPreset) {
  const [state, setState] = useState<WalletState>({
    available: false,
    address: null,
    chainId: null,
    balance: null,
    connecting: false,
    error: null,
  });

  const refreshBalance = useCallback(async (address: string) => {
    const provider = getProvider();
    if (!provider) return;
    try {
      const wei = (await provider.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      })) as string;
      const eth = Number(BigInt(wei)) / 1e18;
      setState((s) => ({ ...s, balance: eth.toFixed(4) }));
    } catch {
      setState((s) => ({ ...s, balance: null }));
    }
  }, []);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;
    setState((s) => ({ ...s, available: true }));

    const syncChain = async () => {
      const cid = (await provider.request({ method: "eth_chainId" })) as string;
      setState((s) => ({ ...s, chainId: Number(cid) }));
    };
    const syncAccounts = async () => {
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      const address = accounts[0] ?? null;
      setState((s) => ({ ...s, address, balance: address ? s.balance : null }));
      if (address) void refreshBalance(address);
    };
    void syncChain();
    void syncAccounts();

    const onAccounts = (...args: never[]) => {
      const accounts = (args[0] ?? []) as unknown as string[];
      const address = accounts[0] ?? null;
      setState((s) => ({ ...s, address, balance: null, error: null }));
      if (address) void refreshBalance(address);
    };
    const onChain = (...args: never[]) => {
      const cid = args[0] as unknown as string;
      setState((s) => ({ ...s, chainId: Number(cid) }));
    };
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener("accountsChanged", onAccounts);
      provider.removeListener("chainChanged", onChain);
    };
  }, [refreshBalance]);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setState((s) => ({ ...s, error: "MetaMask was not detected in this browser." }));
      return;
    }
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0] ?? null;
      const cid = (await provider.request({ method: "eth_chainId" })) as string;
      setState((s) => ({ ...s, address, chainId: Number(cid), connecting: false }));
      if (address) void refreshBalance(address);
    } catch (e) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: e instanceof Error ? e.message : "Connection rejected.",
      }));
    }
  }, [refreshBalance]);

  const disconnect = useCallback(() => {
    setState((s) => ({ ...s, address: null, balance: null, error: null }));
  }, []);

  const switchNetwork = useCallback(async () => {
    const provider = getProvider();
    if (!provider || !network.chainId) return;
    const hexChain = `0x${network.chainId.toString(16)}`;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChain }],
      });
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4902 || code === -32603) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexChain,
                chainName: network.name,
                rpcUrls: [network.rpc],
                nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
                blockExplorerUrls: network.explorer ? [network.explorer] : [],
              },
            ],
          });
        } catch (e) {
          setState((s) => ({
            ...s,
            error: e instanceof Error ? e.message : "Could not add the network.",
          }));
        }
      } else {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : "Could not switch network.",
        }));
      }
    }
  }, [network]);

  const sendTransaction = useCallback(
    async (tx: { to: string; data: string; value?: string }) => {
      const provider = getProvider();
      if (!provider) throw new Error("MetaMask was not detected.");
      if (!state.address) throw new Error("Connect your wallet first.");
      return (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: state.address, value: "0x0", ...tx }],
      })) as string;
    },
    [state.address],
  );

  const waitForReceipt = useCallback(async (hash: string, timeoutMs = 120_000) => {
    const provider = getProvider();
    if (!provider) throw new Error("MetaMask was not detected.");
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const receipt = (await provider.request({
        method: "eth_getTransactionReceipt",
        params: [hash],
      })) as { status?: string } | null;
      if (receipt) return receipt;
      await new Promise((r) => setTimeout(r, 2500));
    }
    throw new Error("Transaction is taking longer than expected to confirm.");
  }, []);

  return {
    ...state,
    onCorrectNetwork: state.chainId === network.chainId,
    connect,
    disconnect,
    switchNetwork,
    sendTransaction,
    waitForReceipt,
    refreshBalance,
  };
}
