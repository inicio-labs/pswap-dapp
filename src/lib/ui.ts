// Tiny presentational helpers shared across components.

const PALETTES: [string, string][] = [
  ["#7c5cff", "#5b8cff"],
  ["#46d6c8", "#5b8cff"],
  ["#ff8a5b", "#ff5b9e"],
  ["#36d399", "#46d6c8"],
  ["#f4b740", "#ff8a5b"],
  ["#a78bfa", "#7c5cff"],
  ["#5b8cff", "#36d399"],
];

/** Deterministic gradient for a token avatar, seeded by ticker/faucet id. */
export function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = PALETTES[h % PALETTES.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

/** First 1–3 letters of a ticker for the avatar monogram. */
export function monogram(ticker: string): string {
  return (ticker || "?").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "?";
}

/** Short id for display: 0xabcd…ef01 */
export function shortId(id: string, head = 6, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** Compact USD. */
export function usd(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
