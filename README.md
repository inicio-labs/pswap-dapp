# Miden PSWAP dApp

A minimal site whose only job is: **fetch the live price for an asset pair and
create a partial-swap (PSWAP) order**, signed through the **Miden wallet**.

- **Wallet / signing:** `@miden-sdk/miden-wallet-adapter` (the MidenFi browser
  extension). The dApp never holds keys — it builds the swap transaction and the
  wallet signs + submits it.
- **Assets:** taken straight from the connected wallet via `requestAssets()` —
  no manual token registry.
- **PSWAP build:** `@miden-sdk/miden-sdk` builds `newPswapCreateTransactionRequest`.
- **Price:** the faucet price API, keyed by **hex** faucet id (see below).
- **Stack:** Vite + React + TypeScript, Uniswap-style swap UI.

## How it works

1. Connect the Miden wallet. The provider connects to **devnet** and requests
   full private-data access — required, or the wallet rejects reads/transactions
   with `NOT_GRANTED` (see `src/main.tsx`).
2. The wallet's holdings (`requestAssets()`) populate the **You pay** / **You
   receive** pickers, each priced via the API.
3. The site fetches USD prices for both faucets and derives the rate
   (`offered$ / requested$`), filling the receive amount so the order is fair.
4. **Create swap** → the dApp builds the create-request and hands it to the
   wallet as a generic (`custom`) transaction; you confirm in the extension.

## Prerequisites

- **MidenFi wallet extension** (devnet build) installed and set to **devnet**.
- The **`@miden-sdk/miden-sdk`** dependency is pinned to a local tarball built
  from the PSWAP-tracking web-sdk branch:

  ```jsonc
  // package.json
  "@miden-sdk/miden-sdk": "file:../web-sdk/crates/web-client/miden-sdk-miden-sdk-0.15.1.tgz"
  ```

  Clone [`inicio-labs/web-sdk`](https://github.com/inicio-labs/web-sdk) next to
  this repo, build the web-client package, and `npm pack` it (or adjust the path)
  before `npm install`. This build is what provides PSWAP create/cancel +
  lineage tracking; a stock npm `@miden-sdk/miden-sdk` will not have it.

## Setup

```bash
npm install
cp .env.example .env.local   # optional — defaults are devnet + the live price API
npm run dev                  # http://localhost:5173
```

### Environment

| Var | Default | Purpose |
|---|---|---|
| `VITE_RPC_URL` | `devnet` | Network the wallet provider connects to (`devnet`/`testnet`). |
| `VITE_PRICE_API_URL` | `https://35-175-40-181.sslip.io` | Faucet price API base. |

The price API is keyed by **hex** account id:

```
GET /v1/prices?ids=<hexFaucet1>,<hexFaucet2>
→ { "<hexFaucet>": { faucet_id, ticker, vs_currency:"usd", price:"<str>", decimals, stale } }
```

The wallet returns faucet ids in **bech32** (`mdev1…`); the dApp converts them to
hex with `AccountId.fromBech32(id).toString()` before querying (see
`faucetIdToHex` in `src/lib/midenClient.ts`). Assets the price API doesn't track
are hidden from the picker (logged to the console).

## Where each piece lives

| File | Responsibility |
|---|---|
| `src/main.tsx` | Wallet providers + **devnet / full private-data grant** |
| `src/App.tsx` | Connect button + connection gating |
| `src/components/CreatePswap.tsx` | Swap UI: wallet assets → price → amount → submit |
| `src/components/ActiveOrders.tsx` | Lists active lineages, cancel-by-order |
| `src/lib/priceService.ts` | Price API client + rate math |
| `src/lib/midenClient.ts` | Builds PSWAP create/cancel requests; bech32→hex helper |
| `src/lib/tokens.ts` | Base-unit / decimal helpers |
| `src/components/WalletDebug.tsx` | Diagnostics (`requestAssets()` probe) — safe to delete |
