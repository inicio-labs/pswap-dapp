import { useMemo, useState } from "react";
import { useWallet, Transaction } from "@miden-sdk/miden-wallet-adapter";
import { rateFrom, type TokenMeta } from "../lib/priceService";
import { buildPswapCreateRequest } from "../lib/midenClient";
import { useAssets } from "../lib/useAssets";
import { toBaseUnits, fromBaseUnits } from "../lib/tokens";
import { avatarGradient, monogram, usd } from "../lib/ui";

type Stage = "idle" | "building" | "signing" | "done" | "error";

export function CreatePswap({
  creatorAddress,
  onCreated,
}: {
  creatorAddress: string;
  onCreated?: () => void;
}) {
  const { requestTransaction } = useWallet() as unknown as {
    requestTransaction: (tx: unknown) => Promise<string>;
  };
  const { tokens, balances, loading, error: assetError, reload } = useAssets();

  const [offeredFaucet, setOfferedFaucet] = useState("");
  const [requestedFaucet, setRequestedFaucet] = useState("");
  const [payAmount, setPayAmount] = useState("");
  // Orders are created as public notes. (Private-note option removed.)
  const noteType = "public" as const;

  const [stage, setStage] = useState<Stage>("idle");
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // You can only OFFER assets you actually hold; you can RECEIVE any supported.
  const offerable = useMemo(
    () => tokens.filter((t) => (balances.get(t.faucetId) ?? 0n) > 0n),
    [tokens, balances]
  );

  const payTok = tokens.find((t) => t.faucetId === offeredFaucet);
  const getTok = tokens.find((t) => t.faucetId === requestedFaucet);

  // Rate (receive per 1 pay) straight from the priced metadata — no extra call.
  const rate =
    payTok && getTok && payTok.faucetId !== getTok.faucetId
      ? rateFrom(payTok, getTok)
      : null;
  const rateStale = (payTok?.stale || getTok?.stale) ?? false;

  const payNum = Number(payAmount);
  const receiveAmount = useMemo(() => {
    if (!rate || !getTok || !Number.isFinite(payNum) || payNum <= 0) return "";
    return (payNum * rate).toFixed(getTok.decimals);
  }, [payNum, rate, getTok]);

  const payUsd = payTok && payNum > 0 ? payNum * payTok.priceUsd : 0;
  const getUsd = getTok && receiveAmount ? Number(receiveAmount) * getTok.priceUsd : 0;

  const payBalance = useMemo(() => {
    if (!payTok) return null;
    const units = balances.get(payTok.faucetId);
    return units != null ? fromBaseUnits(units, payTok.decimals) : "0";
  }, [payTok, balances]);

  const overBalance =
    payBalance != null && payNum > 0 && payNum > Number(payBalance);

  const busy = stage === "building" || stage === "signing";
  const canSubmit =
    !!payTok &&
    !!getTok &&
    offeredFaucet !== requestedFaucet &&
    payNum > 0 &&
    !overBalance &&
    !!rate &&
    !busy;

  function flip() {
    // Only flip into pay if we actually hold the requested asset.
    const canPayRequested = (balances.get(requestedFaucet) ?? 0n) > 0n;
    if (!canPayRequested) return;
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
      const tx = (
        Transaction as unknown as {
          createCustomTransaction: (a: string, r: string, req: unknown) => unknown;
        }
      ).createCustomTransaction(creatorAddress, creatorAddress, request);
      setStage("signing");
      setTxId(await requestTransaction(tx));
      setStage("done");
      setPayAmount("");
      onCreated?.();
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? e));
      setStage("error");
    }
  }

  // ── loading / empty universe ──────────────────────────────────────────
  if (loading && tokens.length === 0) {
    return (
      <div className="card swap">
        <div className="skel line" style={{ width: "40%", height: 18 }} />
        <div className="skel" style={{ height: 92, marginTop: 14, borderRadius: 16 }} />
        <div className="skel" style={{ height: 92, marginTop: 10, borderRadius: 16 }} />
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="card swap">
        <div className="empty">
          <div className="em-icon">⚠</div>
          <div className="em-title">No priced assets available</div>
          <p>
            The price API returned no supported assets and your wallet holds none
            it recognizes. Check <code>VITE_SUPPORTED_FAUCETS</code> or mint a
            priced devnet token.
          </p>
          {assetError && (
            <div className="status err" style={{ marginTop: 12 }}>
              <span>✕</span>
              <span>{assetError}</span>
            </div>
          )}
          <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={reload}>
            Retry
          </button>
        </div>
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
              ? "Building order…"
              : stage === "signing"
                ? "Confirm in wallet…"
                : "Create swap";

  return (
    <div className="card swap">
      <div className="swap-head">
        <h1>Create swap</h1>
        <span className="hint">priced live · partial fills allowed</span>
      </div>

      <div className="fields">
        <Field
          label="You pay"
          options={offerable}
          token={offeredFaucet}
          onToken={setOfferedFaucet}
          amount={payAmount}
          onAmount={setPayAmount}
          editable
          usdValue={payUsd}
          balance={payBalance}
          onMax={payBalance ? () => setPayAmount(payBalance) : undefined}
          over={overBalance}
          emptyHint="No holdings"
        />

        <div className="flip-wrap">
          <button className="flip" onClick={flip} title="Switch direction" aria-label="switch">
            ↓
          </button>
        </div>

        <Field
          label="You receive"
          options={tokens}
          token={requestedFaucet}
          onToken={setRequestedFaucet}
          amount={stage === "building" || stage === "signing" ? receiveAmount : receiveAmount}
          onAmount={() => {}}
          editable={false}
          usdValue={getUsd}
        />
      </div>

      {payTok && getTok && offeredFaucet !== requestedFaucet && rate && (
        <div className="rate-row">
          <span className="r-main">
            1 {payTok.ticker} = {trim(rate)} {getTok.ticker}
          </span>
          <span className="r-sub">
            {usd(payTok.priceUsd)} / {usd(getTok.priceUsd)}
            {rateStale ? " · stale" : ""}
          </span>
        </div>
      )}

      <button className="btn-primary" disabled={!canSubmit} onClick={onCreate}>
        {busy && <span className="spinner" style={{ marginRight: 8, display: "inline-block", verticalAlign: "-2px" }} />}
        {cta}
      </button>

      {stage === "done" && txId && (
        <div className="status ok">
          <span>✓</span>
          <span>
            Swap created. Tx: <code>{txId}</code>
          </span>
        </div>
      )}
      {stage === "error" && error && (
        <div className="status err">
          <span>✕</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function trim(n: number): string {
  return Number(n.toPrecision(6)).toString();
}

function Field(props: {
  label: string;
  options: TokenMeta[];
  token: string;
  onToken: (v: string) => void;
  amount: string;
  onAmount: (v: string) => void;
  editable: boolean;
  usdValue: number;
  balance?: string | null;
  onMax?: () => void;
  over?: boolean;
  emptyHint?: string;
}) {
  const sel = props.options.find((t) => t.faucetId === props.token);
  return (
    <div className={`field${props.over ? " over" : ""}`}>
      <div className="field-top">
        <span>{props.label}</span>
        {props.balance != null && (
          <span className="field-bal">
            Balance: {props.balance}
            {props.onMax && (
              <button className="chip-max" onClick={props.onMax}>
                MAX
              </button>
            )}
          </span>
        )}
      </div>
      <div className="field-mid">
        <input
          className="amount"
          inputMode="decimal"
          placeholder="0"
          value={props.amount}
          readOnly={!props.editable}
          onChange={(e) => props.onAmount(e.target.value)}
        />
        <label className={`token${sel ? "" : " empty"}`}>
          {sel ? (
            <span className="avatar" style={{ background: avatarGradient(sel.ticker) }}>
              {monogram(sel.ticker)}
            </span>
          ) : (
            <span className="avatar placeholder">◎</span>
          )}
          <span>{sel ? sel.ticker : props.options.length ? "Select" : props.emptyHint || "—"}</span>
          <span className="caret">▾</span>
          <select value={props.token} onChange={(e) => props.onToken(e.target.value)}>
            <option value="">Select</option>
            {props.options.map((t) => (
              <option key={t.faucetId} value={t.faucetId}>
                {t.ticker}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field-usd">{props.usdValue > 0 ? usd(props.usdValue) : " "}</div>
    </div>
  );
}
