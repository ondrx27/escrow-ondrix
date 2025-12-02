/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENVIRONMENT: string
  readonly VITE_REOWN_PROJECT_ID: string
  readonly VITE_SOLANA_PROGRAM_ID: string
  readonly VITE_SOLANA_GLOBAL_ESCROW: string
  readonly VITE_SOLANA_TOKEN_MINT: string
  readonly VITE_SOLANA_RECIPIENT_WALLET: string
  readonly VITE_BNB_ESCROW_ADDRESS: string
  readonly VITE_BNB_TOKEN_ADDRESS: string
  readonly VITE_BNB_PRICE_FEED: string
  readonly DEV: boolean
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}