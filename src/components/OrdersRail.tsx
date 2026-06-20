import { useCallback, useEffect, useState } from "react";
import { useWallet, Transaction } from "@miden-sdk/miden-wallet-adapter";
import {
  listLineages,
  buildPswapCancelRequest,
  type LineageView,
  type LineageState,
} from "../lib/midenClient";

const STATE_LABEL: Record<LineageState, string> = {
  active: "Active",
  fullyFilled: "Filled",
  reclaimed: "Reclaimed",
  unknown: "Unknown",
};
const STATE_CLASS: Record<LineageState, string> = {
  active: "active",
  fullyFilled: "filled",
  reclaimed: "reclaimed",
  unknown: "reclaimed",
};

export function OrdersRail({
  creatorAddress,
  refreshKey,
}: {
  creatorAddress: string;
  refreshKey?: number;
}) {
  const { requestTransaction } = useWallet() as unknown as {
    requestTransaction: (tx: unknown) => Promise<string>;
  };

  const [orders, setOrders] = useState<LineageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await listLineages(creatorAddress, false)); // all states
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [creatorAddress]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  async function onCancel(orderId: string) {
    setCancelling(orderId);
    setError(null);
    try {
      const request = await buildPswapCancelRequest(orderId);
      const tx = (
        Transaction as unknown as {
          createCustomTransaction: (a: string, r: string, req: unknown) => unknown;
        }
      ).createCustomTransaction(creatorAddress, creatorAddress, request);
      await requestTransaction(tx);
      await refresh();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setCancelling(null);
    }
  }

  const active = orders.filter((o) => o.state === "active");
  const completed = orders.filter((o) => o.state !== "active");

  return (
    <div className="rail">
      <section className="card rail-card">
        <div className="section-title">
          <h2>Active orders</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {active.length > 0 && <span className="count">{active.length}</span>}
            <button className="btn ghost sm" onClick={refresh} disabled={loading}>
              {loading ? "Syncing…" : "↻"}
            </button>
          </div>
        </div>

        {error && (
          <div className="status err">
            <span>✕</span>
            <span>{error}</span>
          </div>
        )}

        {loading && active.length === 0 ? (
          <>
            <div className="skel order" />
            <div className="skel order" />
          </>
        ) : active.length === 0 ? (
          <div className="empty">
            <div className="em-icon">◇</div>
            <div className="em-title">No active orders</div>
            <p>Create a swap and it appears here once a sync picks it up.</p>
          </div>
        ) : (
          <ul className="orders">
            {active.map((o) => (
              <OrderCard
                key={o.orderId}
                o={o}
                onCancel={() => onCancel(o.orderId)}
                cancelling={cancelling === o.orderId}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card rail-card">
        <div className="section-title">
          <h2>Completed</h2>
          {completed.length > 0 && <span className="count">{completed.length}</span>}
        </div>
        {completed.length === 0 ? (
          <div className="empty">
            <p>Filled & reclaimed orders land here.</p>
          </div>
        ) : (
          <ul className="orders">
            {completed.map((o) => (
              <OrderCard key={o.orderId} o={o} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OrderCard({
  o,
  onCancel,
  cancelling,
}: {
  o: LineageView;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  return (
    <li className="order">
      <div className="order-top">
        <span className="order-id">#{o.orderId}</span>
        <span className={`pill ${STATE_CLASS[o.state]}`}>{STATE_LABEL[o.state]}</span>
      </div>
      <div className="order-amts">
        {o.remainingOffered}
        <span className="arrow">→</span>
        {o.remainingRequested}
      </div>
      <div className="order-foot">
        <span className="order-meta">depth {o.currentDepth}</span>
        {onCancel && (
          <button className="btn danger sm" onClick={onCancel} disabled={cancelling}>
            {cancelling ? "Confirm…" : "Cancel"}
          </button>
        )}
      </div>
    </li>
  );
}
