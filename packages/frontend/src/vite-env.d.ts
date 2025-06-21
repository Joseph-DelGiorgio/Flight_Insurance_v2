/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AVIATION_API_KEY: string
  readonly VITE_AVIATION_API_URL: string
  readonly VITE_SUI_NETWORK: string
  readonly VITE_PACKAGE_ID: string
  readonly VITE_INSURANCE_POOL_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 