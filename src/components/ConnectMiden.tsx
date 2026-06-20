import { useEffect, useState } from "react";
import { useWallet } from "@miden-sdk/miden-wallet-adapter";

// Direct connect that bypasses the WalletModal's "only show detected wallets"
// filter — it select()s the Miden adapter and connect()s it regardless of the
// modal's detection snapshot. Works for the devnet extension as long as it
// injects the same provider the adapter looks for (window.miden/midenWallet).
export function ConnectMiden() {
  const { select, connect, disconnect, wallet, connected, connecting } =
    useWallet() as unknown as {
      select: (name: string) => void;
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      wallet: { adapter?: { name?: string } } | null;
      connected: boolean;
      connecting: boolean;
    };

  const [arming, setArming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // select() only sets the active wallet; connect once it's actually selected.
  useEffect(() => {
    if (arming && wallet && !connected && !connecting) {
      connect()
        .catch((e) => setErr(String((e as Error)?.message ?? e)))
        .finally(() => setArming(false));
    }
  }, [arming, wallet, connected, connecting, connect]);

  if (connected) {
    return (
      <button className="ghost" onClick={() => disconnect()}>
        Disconnect
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
      <button
        className="primary"
        disabled={arming || connecting}
        onClick={() => {
          setErr(null);
          setArming(true);
          select("Miden Wallet"); // MidenWalletName
        }}
      >
        {arming || connecting ? "Connecting…" : "Connect Miden Wallet (direct)"}
      </button>
      {err && <div className="status err">✕ {err}</div>}
    </div>
  );
}
