import { useEffect, useState } from "react";
import { useWallet } from "@miden-sdk/miden-wallet-adapter";

// Temporary diagnostic: shows what the page sees so we can tell whether the
// extension is injecting a provider the adapter recognizes, AND what the
// wallet's own `requestAssets()` returns. Remove once everything works.
export function WalletDebug() {
  const w = useWallet() as unknown as {
    wallets?: Array<{ adapter?: { name?: string; readyState?: string }; readyState?: string }>;
    connected?: boolean;
    address?: string;
    publicKey?: unknown;
    requestAssets?: () => Promise<unknown>;
    requestConsumableNotes?: () => Promise<unknown>;
  };
  const [keys, setKeys] = useState<string[]>([]);
  const [probe, setProbe] = useState<string>("(not run)");

  useEffect(() => {
    const scan = () => {
      const win = window as unknown as Record<string, unknown>;
      setKeys(
        Object.keys(win)
          .filter((k) => /miden|wallet/i.test(k))
          .map((k) => `${k}:${typeof win[k]}`)
      );
    };
    scan();
    const t = setInterval(scan, 1000); // catch late injection
    return () => clearInterval(t);
  }, []);

  async function probeAssets() {
    setProbe("running…");
    try {
      if (!w.requestAssets) {
        setProbe("requestAssets is UNDEFINED on the wallet context");
        return;
      }
      const r = await w.requestAssets();
      // Enumerate the raw provider's methods — including the prototype chain —
      // so we can see whether the wallet exposes any PSWAP / order / lineage
      // call the adapter doesn't wrap.
      const win = window as unknown as { miden?: any; midenWallet?: any };
      const provider = win.midenWallet || win.miden;
      const methods = new Set<string>();
      let o = provider;
      while (o && o !== Object.prototype) {
        for (const k of Object.getOwnPropertyNames(o)) {
          try {
            if (typeof provider[k] === "function") methods.add(k);
          } catch {
            /* getter threw — ignore */
          }
        }
        o = Object.getPrototypeOf(o);
      }
      const methodList = [...methods].sort();
      const pswapish = methodList.filter((m) =>
        /pswap|lineage|order|swap/i.test(m)
      );
      console.info("provider methods:", methodList, "provider:", provider);
      setProbe(
        "assets: " +
          JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) +
          "\n\nprovider methods (" +
          methodList.length +
          "):\n" +
          methodList.join(", ") +
          "\n\nPSWAP/order-ish methods: " +
          (pswapish.length ? pswapish.join(", ") : "— NONE —")
      );
    } catch (e) {
      setProbe("ERROR: " + String((e as Error)?.message ?? e));
    }
  }

  const win = window as unknown as Record<string, unknown>;

  return (
    <div
      className="card"
      style={{ marginTop: 12, fontSize: 12, fontFamily: "monospace", lineHeight: 1.6 }}
    >
      <div style={{ color: "var(--muted)", marginBottom: 6 }}>wallet debug</div>
      <div>connected: {String(w.connected)}</div>
      <div>address: {w.address ? String(w.address) : "—"}</div>
      <div>publicKey: {w.publicKey ? String(w.publicKey) : "—"}</div>
      <div>requestAssets: {typeof w.requestAssets}</div>
      <div>window.miden: {typeof win.miden}</div>
      <div>window.midenWallet: {typeof win.midenWallet}</div>
      <div>matching window keys: {keys.length ? keys.join(", ") : "— none —"}</div>
      <div style={{ marginTop: 6 }}>configured adapters:</div>
      <ul style={{ margin: "4px 0 6px", paddingLeft: 18 }}>
        {(w.wallets ?? []).map((x, i) => (
          <li key={i}>
            {x.adapter?.name ?? "?"} — readyState:{" "}
            <b>{x.readyState ?? x.adapter?.readyState ?? "?"}</b>
          </li>
        ))}
      </ul>
      <button className="btn ghost sm" onClick={probeAssets}>
        probe requestAssets()
      </button>
      <pre
        style={{
          marginTop: 8,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          maxHeight: 220,
          overflow: "auto",
          background: "var(--bg)",
          padding: 8,
          borderRadius: 8,
        }}
      >
        {probe}
      </pre>
    </div>
  );
}
