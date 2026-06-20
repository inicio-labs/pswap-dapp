import { useWallet, WalletMultiButton } from "@miden-sdk/miden-wallet-adapter";
import { CreatePswap } from "./components/CreatePswap";
import { ActiveOrders } from "./components/ActiveOrders";
import { WalletDebug } from "./components/WalletDebug";
import { ConnectMiden } from "./components/ConnectMiden";

export default function App() {
  const { connected, publicKey, wallet } = useWallet();
  // The adapter exposes the connected account id as `address`; some versions
  // surface it via `wallet.adapter.address`. Read both defensively.
  const address: string | null =
    (useWallet() as unknown as { address?: string }).address ??
    (wallet?.adapter as unknown as { address?: string } | undefined)?.address ??
    (publicKey ? String(publicKey) : null);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◆</span>
          <span>Miden PSWAP</span>
        </div>
        <WalletMultiButton />
      </header>

      <main className="content">
        <h1>Create a partial-swap order</h1>
        <p className="subtitle">
          Offer one asset for another. The price is fetched live; anyone can
          fill your order, fully or partially, and you receive a payback note
          for each fill.
        </p>

        {connected && address ? (
          <>
            <CreatePswap creatorAddress={address} />
            <ActiveOrders creatorAddress={address} />
          </>
        ) : (
          <div className="card connect-prompt">
            <p>Connect your Miden wallet to create a swap.</p>
            <ConnectMiden />
            <p className="muted" style={{ marginTop: 8 }}>
              or use the modal:
            </p>
            <WalletMultiButton />
          </div>
        )}

        <WalletDebug />
      </main>

      <footer className="footer">
        Built on the Miden web-sdk · signing via the Miden wallet
      </footer>
    </div>
  );
}
