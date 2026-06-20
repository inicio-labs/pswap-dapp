/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_PRICE_API_URL?: string;
  readonly VITE_PRICE_API_KEY?: string;
  readonly VITE_SUPPORTED_FAUCETS?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
