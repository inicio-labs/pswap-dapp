// Which devnet faucets the swap UI offers. Metadata (ticker, decimals, price)
// is fetched from the price API by faucet id — you only list the ids here.

export const KNOWN_FAUCETS: string[] = [
  "0xb3722d97036169910fc0eeaccce29b", // IBTC (from the price API)
  // add the other devnet faucet ids you want to trade…
];

/** UI amount (e.g. "1.5") → base units (bigint), given decimals. */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = amount.trim().split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const digits = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, "");
  return BigInt(digits || "0");
}

/** Base units (bigint) → UI string, given decimals. */
export function fromBaseUnits(units: bigint, decimals: number): string {
  const s = units.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
