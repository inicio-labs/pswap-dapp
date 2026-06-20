import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@miden-sdk/miden-wallet-adapter";
import { fetchTokens, type TokenMeta } from "./priceService";
import { faucetIdToHex } from "./midenClient";
import { SUPPORTED_FAUCETS } from "./config";

export interface AssetsState {
  /** Selectable universe: supported faucets ∪ wallet holdings, priced. */
  tokens: TokenMeta[];
  /** Wallet balances, base units, keyed by canonical hex faucet id. */
  balances: Map<string, bigint>;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * The asset model behind both pickers.
 *
 * - **Supported universe** comes from the price API via the configured faucet
 *   list (`SUPPORTED_FAUCETS`) — these are selectable as "You receive".
 * - **Wallet holdings** come from `requestAssets()`, converted bech32→hex; their
 *   priced entries are unioned in so you can offer what you hold even if it
 *   isn't in the configured list.
 *
 * Everything is keyed by canonical **hex** faucet id.
 */
export function useAssets(): AssetsState {
  const { requestAssets, connected } = useWallet() as unknown as {
    requestAssets?: () => Promise<Array<{ faucetId: string; amount: string }>>;
    connected?: boolean;
  };

  const [tokens, setTokens] = useState<TokenMeta[]>([]);
  const [balances, setBalances] = useState<Map<string, bigint>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Wallet holdings → hex-keyed balances.
        const bal = new Map<string, bigint>();
        const heldHex: string[] = [];
        if (connected && requestAssets) {
          const walletAssets = await requestAssets();
          for (const a of walletAssets) {
            const hex = await faucetIdToHex(a.faucetId);
            bal.set(hex, BigInt(a.amount));
            heldHex.push(hex);
          }
        }
        if (!live) return;

        // 2. Price the union of configured-supported + held faucets.
        const ids = Array.from(new Set([...SUPPORTED_FAUCETS, ...heldHex]));
        const metas = await fetchTokens(ids);
        if (!live) return;

        setBalances(bal);
        setTokens(metas);
        if (metas.length < ids.length) {
          console.warn(
            `useAssets: priced ${metas.length}/${ids.length} faucet(s); ` +
              "unpriced ids are hidden."
          );
        }
      } catch (e) {
        if (live) setError(String((e as Error)?.message ?? e));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [connected, requestAssets, nonce]);

  return { tokens, balances, loading, error, reload };
}
