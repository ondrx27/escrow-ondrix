import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';

export type SupportedChain = 'solana' | 'bnb';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chain: SupportedChain;
  isConnecting: boolean;
  isChainSwitching: boolean;
  error: string | null;

  // EVM specific
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  reownAddress: string | null;
  reownProvider: ethers.BrowserProvider | null;

  // Solana specific
  solanaConnection: Connection | null;
  solanaPublicKey: PublicKey | null;
  solanaWallet: any;

  // Methods
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: (chain: SupportedChain) => void;
  setReownConnection: (address: string | null, provider: ethers.BrowserProvider | null) => void;
  disconnectReown: () => Promise<void>;
  getSigner: () => Promise<ethers.JsonRpcSigner | null>;
}

export interface EscrowData {
  isInitialized: boolean;
  totalTokensAvailable: string;
  tokensSold: string;
  totalDeposited: string;
  totalWithdrawn: string;
  lockDuration: number;
  saleEndTimestamp: number;
  tokenPrice: number; // in USD
  minimumInvestment: string;
  maximumInvestment: string;
}

export interface InvestorData {
  isInitialized: boolean;
  deposited: string;
  tokensReceived: string;
  depositTimestamp: number;
  status: InvestorStatus;
  lockedAmount: string;
  canUnlock: boolean;
  unlockTimestamp: number;
  // Enhanced price tracking for secure contract
  firstDepositPrice?: string;
  weightedAveragePrice?: string;
  bnbUsdPrice?: string;
}

export enum InvestorStatus {
  Uninitialized = 0,
  Deposited = 1,
  Withdrawn = 2
}

export interface PriceData {
  price: number; // Current price in USD
  lastUpdate: number;
  isStale: boolean;
}

export interface ContractAddresses {
  solana: {
    programId: string;
    globalEscrow?: string;
    tokenMint?: string;
  };
  bnb: {
    escrow: string;
    token: string;
    priceFeed: string;
  };
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply?: string;
  description?: string;
}

export interface NetworkInfo {
  name: string;
  chainId: number | string;
  rpcUrl: string;
  blockExplorer: string;
  currency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// UI Component Props
export interface InvestmentFormProps {
  onInvest: (amount: string) => Promise<void>;
  isLoading: boolean;
  maxAmount: string;
  minAmount: string;
}

export interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  loading?: boolean;
}

export interface ChainSelectorProps {
  selectedChain: SupportedChain;
  onChainChange: (chain: SupportedChain) => void;
  disabled?: boolean;
}

// API Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: number;
}

export interface TransactionResult {
  hash: string;
  blockNumber?: number;
  gasUsed?: string;
  status: 'success' | 'failed' | 'pending';
}

// Error Types
export interface EscrowError {
  code: string;
  message: string;
  details?: any;
}

// Configuration Types
export interface EscrowConfig {
  networks: {
    solana: NetworkInfo;
    bnb: NetworkInfo;
  };
  contracts: ContractAddresses;
  ui: {
    updateInterval: number;
    animationDuration: number;
    showTestnetWarning: boolean;
  };
}