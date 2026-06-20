import { useCallback, useEffect, useState } from "react";
import { useWallet, Transaction } from "@miden-sdk/miden-wallet-adapter";
import {
  listLineages,
  buildPswapCancelRequest,
  type LineageView,
} from "../lib/midenClient";

// Lineage amounts are base units keyed by faucet id, but the record doesn't
// carry the faucet on 0.15.2 — show raw amounts (the create form knows the pair).
function fmt(v: string): string {
  return v;
}

export function ActiveOrders({ creatorAddress }: { creatorAddress: string }) {
  const { requestTransaction } = useWallet() as unknown as {
    requestTransaction: (tx: unknown) => Promise<string>;
  };

  const [orders, setOrders] = useState<LineageView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // getPswapLineages() filtered to Active.
      setOrders(await listLineages(creatorAddress, true));
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [creatorAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onCancel(orderId: string) {
    setCancelling(orderId);
    setError(null);
    try {
      const request = await buildPswapCancelRequest(orderId);
      const tx = (Transaction as unknown as {
        createCustomTransaction: (a: string, r: string, req: unknown) => unknown;
      }).createCustomTransaction(creatorAddress, creatorAddress, request);
      await requestTransaction(tx);
      await refresh();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="card orders">
      <div className="orders-head">
        <h2>Your active orders</h2>
        <button className="ghost" onClick={refresh} disabled={loading}>
          {loading ? "Syncing…" : "Refresh"}
        </button>
      </div>

      {error && <div className="status err">✕ {error}</div>}

      {!error && orders.length === 0 && !loading && (
        <p className="muted">
          No active orders. Create one above — it shows here once a sync picks it
          up.
        </p>
      )}

      <ul className="order-list">
        {orders.map((o) => (
          <li key={o.orderId} className="order">
            <div className="order-main">
              <span className="order-id">#{o.orderId}</span>
              <span className="order-amts">
                {fmt(o.remainingOffered)} offered · {fmt(o.remainingRequested)}{" "}
                requested
              </span>
              <span className="order-meta">depth {o.currentDepth} · active</span>
            </div>
            <button
              className="ghost danger"
              disabled={cancelling === o.orderId}
              onClick={() => onCancel(o.orderId)}
            >
              {cancelling === o.orderId ? "Confirm…" : "Cancel"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
