import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DEFAULT_CONTRACT, STUDIONET } from "@/lib/oracle/networks";
import type { useWallet } from "@/lib/oracle/useWallet";
import { cn } from "@/lib/utils";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectionBar({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  return (
    <section className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-[260px] flex-1 space-y-3">
          <Label className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Network
          </Label>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border border-cyan/50 bg-cyan/10 px-3 py-1.5 text-xs text-cyan">
              {STUDIONET.name}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Oracle contract
            </Label>
            <p className="rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-xs break-all text-muted-foreground">
              {DEFAULT_CONTRACT}
            </p>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            RPC {STUDIONET.rpc} · chain {STUDIONET.chainId}
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3 rounded-lg border border-border bg-background/60 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Wallet
            </span>
            <span
              className={cn(
                "flex items-center gap-1.5 font-mono text-[11px]",
                wallet.address ? "text-emerald" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  wallet.address ? "pulse-dot bg-emerald" : "bg-muted-foreground",
                )}
              />
              {wallet.address ? "Connected" : "Disconnected"}
            </span>
          </div>

          {wallet.address ? (
            <>
              <p className="font-mono text-sm text-foreground">{short(wallet.address)}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {wallet.balance ?? "—"} GEN · chain {wallet.chainId ?? "—"}
              </p>
              {!wallet.onCorrectNetwork && (
                <Button
                  size="sm"
                  onClick={() => void wallet.switchNetwork()}
                  className="w-full bg-amber text-background hover:bg-amber/90"
                >
                  Switch to {STUDIONET.name}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={wallet.disconnect}
                className="w-full border-border"
              >
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => void wallet.connect()}
                disabled={wallet.connecting}
                className="w-full bg-cyan text-background hover:bg-cyan/90"
              >
                {wallet.connecting ? "Connecting…" : "Connect MetaMask"}
              </Button>
              {!wallet.available && (
                <p className="text-[11px] text-muted-foreground">
                  MetaMask not detected — install the extension to submit questions.
                </p>
              )}
            </>
          )}
          {wallet.error && <p className="text-[11px] text-destructive">{wallet.error}</p>}
        </div>
      </div>
    </section>
  );
}
