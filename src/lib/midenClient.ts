// A read-only @miden-sdk/miden-sdk client the dApp uses to (a) build the PSWAP
// create TransactionRequest and (b) list the connected account's balances.
// Signing + submission do NOT happen here — that's the wallet's job (see
// useWallet().requestTransaction in CreatePswap.tsx).

import { MidenClient } from "@miden-sdk/miden-sdk";
// The WASM value-classes (AccountId, NoteType, u64 helper, …) live on the same
// package. They're loaded lazily so the WASM core initializes on first use.
import * as sdk from "@miden-sdk/miden-sdk";

const RPC_URL = (import.meta.env.VITE_RPC_URL as string) || "devnet";

let clientPromise: Promise<MidenClient> | null = null;

function getClient(): Promise<MidenClient> {
  if (!clientPromise) {
    // A unique store name keeps this dApp's local cache isolated.
    clientPromise = MidenClient.create({
      rpcUrl: RPC_URL,
      storeName: "pswap_dapp_readonly",
    } as never);
  }
  return clientPromise;
}

function toAccountId(idStr: string): unknown {
  const s = idStr.trim();
  const a = sdk as unknown as {
    AccountId: { fromHex(s: string): unknown; fromBech32(s: string): unknown };
  };
  return s.startsWith("0x") ? a.AccountId.fromHex(s) : a.AccountId.fromBech32(s);
}

/**
 * Canonicalize a faucet id to the **hex** form the price API expects.
 *
 * The wallet (`requestAssets()`) returns ids in bech32 (`mdev1…`), but the
 * price API parses hex account ids ("failed to parse hex string" otherwise).
 * `AccountId.toString()` is the hex serializer (inverse of `fromHex`). Ensures
 * the WASM core is initialized (via `getClient()`) before constructing the id.
 */
export async function faucetIdToHex(id: string): Promise<string> {
  const s = id.trim();
  if (s.startsWith("0x")) return s;
  await getClient(); // initialize the WASM core
  return String((toAccountId(s) as { toString(): string }).toString());
}

export interface BuildPswapParams {
  creatorAddress: string; // the connected wallet account id
  offeredFaucetId: string;
  offeredAmount: bigint; // base units
  requestedFaucetId: string;
  requestedAmount: bigint; // base units
  noteType: "private" | "public";
}

/**
 * Build the PSWAP-create `TransactionRequest`. Returned object is serialized by
 * the wallet adapter's `CustomTransaction` before handoff to the extension.
 *
 * Uses the low-level WASM binding `newPswapCreateTransactionRequest`, reached
 * via `_withInnerWebClient` — the high-level resource API submits with the
 * dApp's own signer, which is exactly what we DON'T want here.
 */
export async function buildPswapCreateRequest(
  p: BuildPswapParams
): Promise<unknown> {
  const client = await getClient();
  const s = sdk as unknown as {
    NoteType: { Private: unknown; Public: unknown };
  };
  const noteType = p.noteType === "public" ? s.NoteType.Public : s.NoteType.Private;

  // `_withInnerWebClient(fn)` exposes the wasm-bindgen WebClient (documented in
  // @miden-sdk/miden-sdk). `newPswapCreateTransactionRequest` returns a
  // TransactionRequest without submitting. The amounts are plain JS `bigint`
  // (base units) — the binding takes `bigint`, NOT a wrapped u64 value-class.
  const withInner = (client as unknown as {
    _withInnerWebClient<T>(fn: (wasm: any) => Promise<T>): Promise<T>;
  })._withInnerWebClient.bind(client);

  return withInner(async (wasm: any) =>
    wasm.newPswapCreateTransactionRequest(
      toAccountId(p.creatorAddress),
      toAccountId(p.offeredFaucetId),
      p.offeredAmount, // bigint, base units
      toAccountId(p.requestedFaucetId),
      p.requestedAmount, // bigint, base units
      noteType, // PSWAP note visibility
      noteType // payback note visibility
    )
  );
}

export type LineageState = "active" | "fullyFilled" | "reclaimed" | "unknown";

export interface LineageView {
  orderId: string;
  state: LineageState;
  remainingOffered: string;
  remainingRequested: string;
  currentDepth: number;
  tipNoteId: string;
}

function stateName(s: number): LineageState {
  return s === 0
    ? "active"
    : s === 1
      ? "fullyFilled"
      : s === 2
        ? "reclaimed"
        : "unknown";
}

/**
 * List the PSWAP lineages this client tracks, newest-state first.
 *
 * IMPORTANT — lineages live in the store of the client that *tracks + syncs*
 * the creator account. This read client must therefore (a) track the connected
 * account and (b) sync, so the PSWAP observer can (re)build the lineages from
 * chain. We do both best-effort below. Requires the lineage-tracking SDK
 * (web-sdk #176 / 0.15.2); on an older SDK `client.pswap` is undefined.
 *
 * Pass `activeOnly` to keep just `Active` orders (filters `getPswapLineages()`
 * — i.e. `pswap.lineages()` — by state, as requested).
 */
export async function listLineages(
  creatorAddress: string,
  activeOnly = true
): Promise<LineageView[]> {
  const client = (await getClient()) as any;
  if (!client.pswap?.lineages) {
    throw new Error(
      "This @miden-sdk/miden-sdk build has no PSWAP lineage tracking. " +
        "Use the web-sdk #176 build (link ../web-sdk/crates/web-client)."
    );
  }

  const accountId = toAccountId(creatorAddress);

  // (a) Track the connected (public) account so sync can subscribe to its PSWAP
  // tag and reconstruct lineages from chain. `getOrImport` pulls public account
  // state from the network when it isn't already in this client's store —
  // `import({accountId})` is NOT a valid input shape (it's AccountRef|file|seed),
  // which is why tracking previously failed silently.
  try {
    await client.accounts.getOrImport(accountId);
  } catch (err) {
    console.warn("listLineages: getOrImport failed (account may be private):", err);
  }
  // (b) Sync: the PSWAP observer reconstructs/advances lineages from chain.
  try {
    await (client.sync?.() ?? client.syncState?.());
  } catch (err) {
    console.warn("listLineages: sync failed (continuing with cached store):", err);
  }

  const records: any[] = await client.pswap.lineages();
  console.info(
    `listLineages(${creatorAddress}): pswap.lineages() returned ${records.length} record(s)`
  );
  const views = records.map((r): LineageView => ({
    orderId: r.orderId(),
    state: stateName(Number(r.state())),
    remainingOffered: r.remainingOffered().toString(),
    remainingRequested: r.remainingRequested().toString(),
    currentDepth: Number(r.currentDepth()),
    tipNoteId: r.currentTipNoteId().toString(),
  }));
  return activeOnly ? views.filter((v) => v.state === "active") : views;
}

/**
 * Build the cancel-by-order `TransactionRequest` (reclaims the unfilled offered
 * asset on an order's current tip). Submitted via the wallet, same as create.
 */
export async function buildPswapCancelRequest(orderId: string): Promise<unknown> {
  const client = await getClient();
  const withInner = (client as unknown as {
    _withInnerWebClient<T>(fn: (wasm: any) => Promise<T>): Promise<T>;
  })._withInnerWebClient.bind(client);
  return withInner((wasm: any) => wasm.buildPswapCancelByOrder(orderId));
}

export interface Balance {
  faucetId: string;
  amount: bigint;
}

/**
 * List the connected account's fungible balances from the node.
 *
 * The wallet's account is NOT tracked by this read-client's store, so a plain
 * `accounts.get()` returns null (it only looks locally). We use `getOrImport`,
 * which fetches a public account's state from the network when it isn't found
 * locally, then read the vault via `getDetails().vault.fungibleAssets()`.
 *
 * Works for public accounts the node serves. A private account can't be read
 * this way (the node has no state for it) → returns [] and the UI shows the
 * empty-assets card.
 */
export async function listBalances(address: string): Promise<Balance[]> {
  const client = (await getClient()) as any;
  const accountId = toAccountId(address);

  // Pull this account's state into the store from the network. For an
  // already-tracked or freshly-imported account this is a no-op-ish refresh.
  let account: any = null;
  try {
    account = await client.accounts.getOrImport(accountId);
  } catch (err) {
    console.warn("listBalances: getOrImport failed, trying local get():", err);
    try {
      account = await client.accounts.get(accountId);
    } catch (err2) {
      console.warn("listBalances: accounts.get() also failed:", err2);
    }
  }
  if (!account) {
    console.warn(
      "listBalances: node has no state for",
      address,
      "(private account, or not yet on-chain). Returning no balances."
    );
    return [];
  }

  // Sync so the imported account's vault reflects the latest chain state.
  try {
    await (client.sync?.() ?? client.syncState?.());
  } catch (err) {
    console.warn("listBalances: sync failed (using cached state):", err);
  }

  // Read the vault. `getDetails()` returns { vault: AssetVault }; AssetVault
  // .fungibleAssets() → FungibleAsset[] with .faucetId()/.amount(). Some builds
  // also expose account.vault() directly — try details first, then that.
  let assets: any[] = [];
  try {
    const details = await client.accounts.getDetails(accountId);
    assets = details?.vault?.fungibleAssets?.() ?? [];
  } catch (err) {
    console.warn("listBalances: getDetails failed, trying account.vault():", err);
    try {
      assets = account.vault?.().fungibleAssets?.() ?? [];
    } catch (err2) {
      console.warn("listBalances: account.vault() failed:", err2);
    }
  }

  const balances = assets.map((a) => ({
    faucetId: a.faucetId().toString(),
    amount: BigInt(a.amount()),
  }));
  console.info(
    `listBalances(${address}): ${balances.length} fungible asset(s)`,
    balances.map((b) => `${b.faucetId}=${b.amount}`)
  );
  return balances;
}
