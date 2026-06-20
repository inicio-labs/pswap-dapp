import { useState } from "react";
import { useWallet, WalletMultiButton } from "@miden-sdk/miden-wallet-adapter";
import { CreatePswap } from "./components/CreatePswap";
import { OrdersRail } from "./components/OrdersRail";
import { WalletDebug } from "./components/WalletDebug";
import { ConnectMiden } from "./components/ConnectMiden";
import { RPC_URL } from "./lib/config";

export default function App() {
  const { connected, publicKey, wallet } = useWallet();
  const address: string | null =
    (useWallet() as unknown as { address?: string }).address ??
    (wallet?.adapter as unknown as { address?: string } | undefined)?.address ??
    (publicKey ? String(publicKey) : null);

  // Bumped after a swap is created so the orders rail re-syncs.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">
          <span className="mark">◆</span>
          <b>Miden PSWAP</b>
          <span className="tag">{RPC_URL}</span>
        </div>
        <div className="nav-right">
          <span className="net-chip">
            <span className="dot" /> {RPC_URL}
          </span>
          <WalletMultiButton />
        </div>
      </nav>

      <main className="main">
        {connected && address ? (
          <div className="layout">
            <OrdersRail creatorAddress={address} refreshKey={refreshKey} />
            <CreatePswap
              creatorAddress={address}
              onCreated={() => setRefreshKey((k) => k + 1)}
            />
          </div>
        ) : (
          <Onboarding />
        )}

        <details className="diag">
          <summary>Diagnostics</summary>
          <WalletDebug />
        </details>
      </main>

      <footer className="footer">
        Built on the Miden web-sdk · signing via the Miden wallet ·{" "}
        <a href="https://github.com/inicio-labs/pswap-dapp" target="_blank" rel="noreferrer">
          source
        </a>
      </footer>
    </div>
  );
}

function Onboarding() {
  return (
    <section className="hero">
      <span className="eyebrow">◆ Partial-swap orders on Miden</span>
      <h1>Swap any asset, filled your way.</h1>
      <p className="lead">
        Offer one asset for another at a live, fair price. Anyone can fill your
        order — fully or partially — and you receive a payback note for every
        fill. Your keys never leave your wallet.
      </p>

      <div className="hero-cta">
        <div className="connect-cluster">
          <WalletMultiButton />
          <ConnectMiden />
        </div>
        <span className="sub">Miden wallet required · devnet</span>
      </div>

      <div className="steps">
        <div className="card step">
          <div className="n">1</div>
          <h3>Connect</h3>
          <p>Link the Miden wallet extension. The dApp reads your balances and never holds keys.</p>
        </div>
        <div className="card step">
          <div className="n">2</div>
          <h3>Price the pair</h3>
          <p>Pick what you offer and want. We fetch both USD prices and set a fair rate automatically.</p>
        </div>
        <div className="card step">
          <div className="n">3</div>
          <h3>Create &amp; track</h3>
          <p>Sign in your wallet. Watch fills land in the orders rail, and cancel anytime.</p>
        </div>
      </div>
    </section>
  );
}
