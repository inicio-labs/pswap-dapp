// Central runtime config. Everything the dApp needs to know about *where* it
// talks to lives here — the node, the price API, and the supported-asset
// universe — so there's a single place to point at a different environment.

/** Miden network the wallet provider + read-client use. */
export const RPC_URL = (import.meta.env.VITE_RPC_URL as string) || "devnet";

/** Faucet price API base (keyed by hex faucet id). Trailing slash stripped. */
export const PRICE_API_URL = (
  (import.meta.env.VITE_PRICE_API_URL as string) ||
  "https://35-175-40-181.sslip.io"
).replace(/\/+$/, "");

/**
 * Supported-asset universe — the faucets the price API tracks.
 *
 * The price API has no discovery endpoint (it only prices specific hex faucet
 * ids), so the selectable set is configured here. Override per-deployment with
 * `VITE_SUPPORTED_FAUCETS` (comma-separated hex ids). The connected wallet's own
 * priced holdings are unioned in at runtime, so you can always offer what you
 * hold even if it isn't listed here.
 */
export const SUPPORTED_FAUCETS: string[] = (
  (import.meta.env.VITE_SUPPORTED_FAUCETS as string) ||
  "0xb3722d97036169910fc0eeaccce29b" // IBTC (devnet, priced by the API)
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
