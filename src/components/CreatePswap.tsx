import { useEffect, useMemo, useState } from "react";
import { useWallet, Transaction } from "@miden-sdk/miden-wallet-adapter";
import { fetchTokens, rateFrom, type TokenMeta } from "../lib/priceService";
import {
  buildPswapCreateRequest,
  faucetIdToHex,
  type Balance,
} from "../lib/midenClient";
import { toBaseUnits, fromBaseUnits } from "../lib/tokens";

type Stage = "idle" | "pricing" | "building" | "signing" | "done" | "error";

const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function CreatePswap({ creatorAddress }: { creatorAddress: string }) {
  const { requestTransaction, requestAssets } = useWallet() as unknown as {
    requestTransaction: (tx: unknown) => Promise<string>;
    requestAssets?: () => Promise<Array<{ faucetId: string; amount: string }>>;
  };

  const [tokens, setTokens] = useState<TokenMeta[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  const [offeredFaucet, setOfferedFaucet] = useState("");
  const [requestedFaucet, setRequestedFaucet] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [noteType, setNoteType] = useState<"private" | "public">("private");

  const [rate, setRate] = useState<number | null>(null);
  const [rateStale, setRateStale] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Assets come straight from the connected wallet (`requestAssets()`), priced
  // via the API. This is the wallet's own holdings — including private assets a
  // read-only node client could never see — and needs the `AllowedPrivateData`
  // grant configured on the WalletProvider (see main.tsx).
  useEffect(() => {
    let live = true;
    (async () => {
      setLoadingAssets(true);
      try {
        if (!requestAssets) throw new Error("wallet does not expose requestAssets()");
        const walletAssets = await requestAssets();
        if (!live) return;
        // The wallet returns bech32 faucet ids; the price API is keyed by hex.
        // Canonicalize to hex so balances, the picker, pricing, and the build
        // request all use one consistent id.
        const bals: Balance[] = await Promise.all(
          walletAssets.map(async (a) => ({
            faucetId: await faucetIdToHex(a.faucetId),
            amount: BigInt(a.amount),
          }))
        );
        if (!live) return;
        console.info(
          `requestAssets(): ${bals.length} asset(s)`,
          bals.map((b) => `${b.faucetId}=${b.amount}`)
        );
        setBalances(bals);
        const metas = await fetchTokens(bals.map((b) => b.faucetId));
        if (live) {
          setTokens(metas);
          if (metas.length < bals.length) {
            console.warn(
              `price API priced ${metas.length}/${bals.length} wallet asset(s);` +
                " unpriced faucets are hidden from the picker."
            );
          }
        }
      } catch (e) {
        if (live) setError(String((e as Error)?.message ?? e));
      } finally {
        if (live) setLoadingAssets(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [creatorAddress, requestAssets]);

  const payTok = tokens.find((t) => t.faucetId === offeredFaucet);
  const getTok = tokens.find((t) => t.faucetId === requestedFaucet);

  // Live price for the selected pair → rate (receive per 1 pay).
  useEffect(() => {
    if (!offeredFaucet || !requestedFaucet || offeredFaucet === requestedFaucet) {
      setRate(null);
      return;
    }
    let live = true;
    setStage("pricing");
    fetchTokens([offeredFaucet, requestedFaucet])
      .then((pair) => {
        if (!live) return;
        const o = pair.find((t) => t.faucetId === offeredFaucet);
        const r = pair.find((t) => t.faucetId === requestedFaucet);
        if (!o || !r) throw new Error("price API returned no price for the pair");
        setRate(rateFrom(o, r));
        setRateStale(o.stale || r.stale);
        setStage("idle");
      })
      .catch((e) => {
        if (!live) return;
        setError(String(e?.message ?? e));
        setStage("error");
      });
    return () => {
      live = false;
    };
  }, [offeredFaucet, requestedFaucet]);

  const payNum = Number(payAmount);
  // receive = pay × rate, at the receive token's decimals (fair-value delta).
  const receiveAmount = useMemo(() => {
    if (!rate || !getTok || !Number.isFinite(payNum) || payNum <= 0) return "";
    return (payNum * rate).toFixed(getTok.decimals);
  }, [payNum, rate, getTok]);

  const payUsd = payTok && payNum > 0 ? payNum * payTok.priceUsd : 0;
  const getUsd = getTok && receiveAmount ? Number(receiveAmount) * getTok.priceUsd : 0;

  const payBalance = (() => {
    if (!payTok) return null;
    const b = balances.find(
      (x) => x.faucetId.toLowerCase() === offeredFaucet.toLowerCase()
    );
    return b ? fromBaseUnits(b.amount, payTok.decimals) : "0";
  })();

  const overBalance =
    payBalance !== null && payNum > 0 && payNum > Number(payBalance);

  const canSubmit =
    !!payTok &&
    !!getTok &&
    offeredFaucet !== requestedFaucet &&
    payNum > 0 &&
    !overBalance &&
    !!rate &&
    (stage === "idle" || stage === "done" || stage === "error");

  function flip() {
    setOfferedFaucet(requestedFaucet);
    setRequestedFaucet(offeredFaucet);
    setPayAmount(receiveAmount || "");
  }

  async function onCreate() {
    if (!payTok || !getTok || !rate) return;
    setError(null);
    setTxId(null);
    try {
      setStage("building");
      const request = await buildPswapCreateRequest({
        creatorAddress,
        offeredFaucetId: offeredFaucet,
        offeredAmount: toBaseUnits(payAmount, payTok.decimals),
        requestedFaucetId: requestedFaucet,
        requestedAmount: toBaseUnits(receiveAmount, getTok.decimals),
        noteType,
      });
      const tx = (Transaction as unknown as {
        createCustomTransaction: (a: string, r: string, req: unknown) => unknown;
      }).createCustomTransaction(creatorAddress, creatorAddress, request);
      setStage("signing");
      setTxId(await requestTransaction(tx));
      setStage("done");
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? e));
      setStage("error");
    }
  }

  if (loadingAssets) {
    return <div className="card muted">Reading your wallet assets…</div>;
  }
  if (tokens.length === 0) {
    return (
      <div className="card warn">
        <strong>No tradable assets in this wallet.</strong>
        <p>
          This account holds no fungible assets the price API recognizes. Receive
          or mint at least two priced devnet tokens to create a swap.
        </p>
        {error && <div className="status err">✕ {error}</div>}
      </div>
    );
  }

  const cta = !payTok
    ? "Select an asset to offer"
    : !getTok
      ? "Select an asset to receive"
      : offeredFaucet === requestedFaucet
        ? "Pick two different assets"
        : payNum <= 0
          ? "Enter an amount"
          : overBalance
            ? "Insufficient balance"
            : stage === "building"
              ? "Building…"
              : stage === "signing"
                ? "Confirm in wallet…"
                : "Create swap";

  return (
    <div className="card swap">
      <Panel
        label="You pay"
        tokens={tokens}
        token={offeredFaucet}
        onToken={setOfferedFaucet}
        amount={payAmount}
        onAmount={setPayAmount}
        editable
        usd={payUsd}
        balance={payBalance}
        onMax={payBalance ? () => setPayAmount(payBalance) : undefined}
        over={overBalance}
      />

      <div className="flip-row">
        <button className="flip" onClick={flip} title="Switch direction">
          ⇅
        </button>
      </div>

      <Panel
        label="You receive"
        tokens={tokens}
        token={requestedFaucet}
        onToken={setRequestedFaucet}
        amount={stage === "pricing" ? "…" : receiveAmount}
        onAmount={() => {}}
        editable={false}
        usd={getUsd}
      />

      {payTok && getTok && offeredFaucet !== requestedFaucet && (
        <div className="rate">
          {rate ? (
            <>
              1 {payTok.ticker} = {rate.toPrecision(6)} {getTok.ticker}
              <span className="rate-sub">
                {usd(payTok.priceUsd)} / {usd(getTok.priceUsd)}
                {rateStale ? " · stale" : ""}
              </span>
            </>
          ) : (
            "fetching price…"
          )}
        </div>
      )}

      <label className="note-type">
        Note visibility
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value as "private" | "public")}
        >
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </label>

      <button className="primary" disabled={!canSubmit} onClick={onCreate}>
        {cta}
      </button>

      {stage === "done" && txId && (
        <div className="status ok">
          ✓ Swap created. Tx: <code>{txId}</code>
        </div>
      )}
      {stage === "error" && error && <div className="status err">✕ {error}</div>}
    </div>
  );
}

function Panel(props: {
  label: string;
  tokens: TokenMeta[];
  token: string;
  onToken: (v: string) => void;
  amount: string;
  onAmount: (v: string) => void;
  editable: boolean;
  usd: number;
  balance?: string | null;
  onMax?: () => void;
  over?: boolean;
}) {
  return (
    <div className={`panel${props.over ? " panel-over" : ""}`}>
      <div className="panel-top">
        <span>{props.label}</span>
        {props.balance != null && (
          <span className="panel-bal">
            Balance: {props.balance}
            {props.onMax && (
              <button className="max" onClick={props.onMax}>
                MAX
              </button>
            )}
          </span>
        )}
      </div>
      <div className="panel-mid">
        <input
          className="amount"
          inputMode="decimal"
          placeholder="0"
          value={props.amount}
          readOnly={!props.editable}
          onChange={(e) => props.onAmount(e.target.value)}
        />
        <select
          className="token-pill"
          value={props.token}
          onChange={(e) => props.onToken(e.target.value)}
        >
          <option value="">Select</option>
          {props.tokens.map((t) => (
            <option key={t.faucetId} value={t.faucetId}>
              {t.ticker}
            </option>
          ))}
        </select>
      </div>
      <div className="panel-usd">{props.usd > 0 ? usd(props.usd) : " "}</div>
    </div>
  );
}
