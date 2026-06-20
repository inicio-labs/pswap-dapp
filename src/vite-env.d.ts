/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_PRICE_API_URL?: string;
  readonly VITE_PRICE_API_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
