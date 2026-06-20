import React from "react";
import ReactDOM from "react-dom/client";
import {
  WalletProvider,
  WalletModalProvider,
  MidenWalletAdapter,
  WalletAdapterNetwork,
  PrivateDataPermission,
  AllowedPrivateData,
} from "@miden-sdk/miden-wallet-adapter";
import "@miden-sdk/miden-wallet-adapter/styles.css";
import App from "./App";
import "./styles.css";

// The Miden (MidenFi) browser-extension wallet.
const wallets = [new MidenWalletAdapter({ appName: "Miden PSWAP" })];

// IMPORTANT: WalletProvider defaults are network=Testnet and
// allowedPrivateData=None. Connecting with those makes the (devnet) wallet
// reject every transaction/asset read with `NOT_GRANTED`, because the origin
// was never granted access to the account's private data on the right network.
// We therefore connect explicitly to DEVNET and grant full private-data access
// (assets + notes + storage) so create/cancel + balance reads work.
const network =
  ((import.meta.env.VITE_RPC_URL as string) || "devnet") === "testnet"
    ? WalletAdapterNetwork.Testnet
    : WalletAdapterNetwork.Devnet;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletProvider
      wallets={wallets}
      autoConnect
      network={network}
      privateDataPermission={PrivateDataPermission.Auto}
      allowedPrivateData={AllowedPrivateData.All}
    >
      <WalletModalProvider>
        <App />
      </WalletModalProvider>
    </WalletProvider>
  </React.StrictMode>
);
