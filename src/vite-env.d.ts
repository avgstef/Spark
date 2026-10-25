/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional build-time key for the browser/dev build only. */
  readonly VITE_SPARK_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
