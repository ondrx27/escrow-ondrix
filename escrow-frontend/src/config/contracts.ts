import { ContractAddresses, NetworkInfo } from '../types';

// Utility function to get required environment variable
function getRequiredEnvVar(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const CONTRACTS: ContractAddresses = {
  solana: {
    programId: getRequiredEnvVar('VITE_SOLANA_PROGRAM_ID'),
    globalEscrow: getRequiredEnvVar('VITE_SOLANA_GLOBAL_ESCROW'),
    tokenMint: getRequiredEnvVar('VITE_SOLANA_TOKEN_MINT'),
  },
  bnb: {
    escrow: getRequiredEnvVar('VITE_BNB_ESCROW_ADDRESS'),
    token: getRequiredEnvVar('VITE_BNB_TOKEN_ADDRESS'),
    priceFeed: getRequiredEnvVar('VITE_BNB_PRICE_FEED'),
  }
};

export const NETWORKS: { solana: NetworkInfo; bnb: NetworkInfo } = {
  solana: {
    name: "Solana Devnet",
    chainId: "devnet",
    rpcUrl: "https://api.devnet.solana.com",
    blockExplorer: "https://explorer.solana.com",
    currency: {
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
    },
  },
  bnb: {
    name: "BSC Testnet",
    chainId: 97,
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    blockExplorer: "https://testnet.bscscan.com",
    currency: {
      name: "Test BNB",
      symbol: "tBNB",
      decimals: 18,
    },
  },
};

// Contract ABIs for SECURE version with enhanced functions
export const ESCROW_ABI = [
  // View functions
  "function getEscrowStatus() view returns (bool isInitialized, uint256 totalTokensAvailable, uint256 tokensSold, uint256 totalBnbDeposited, uint256 totalBnbWithdrawn, uint256 lockDuration)",
  "function getInvestorInfo(address investor) view returns (bool isInitialized, uint256 bnbDeposited, uint256 tokensReceived, uint256 depositTimestamp, uint256 firstDepositPrice, uint256 weightedAveragePrice, uint8 status, uint256 lockedBnbAmount)",
  "function isUnlockTime(address investor) view returns (bool)",
  "function getLockedBnbAmount(address investor) view returns (uint256)",
  "function calculateTokensForBnb(uint256 bnbAmount, uint256 bnbUsdPrice) view returns (uint256)",
  "function getPendingWithdrawal(address user) view returns (uint256)",
  "function emergencyStop() view returns (bool)",
  "function getChainlinkPrice() view returns (uint256 price, uint256 timestamp)",
  "function getInitializationTimestamp() view returns (uint256)",
  
  // Configuration functions for dynamic UI limits
  "function maxInvestmentPerUser() view returns (uint256)",
  "function minInvestmentAmount() view returns (uint256)",
  
  // NEW: Transparency functions for lock status
  "function totalDeposited() view returns (uint256)",
  "function totalUnlocked() view returns (uint256)", 
  "function totalLocked() view returns (uint256)",
  "function nextUnlockTime(address investor) view returns (uint256)",
  "function getInvestorLockStatus(address investor) view returns (uint256 totalInvested, uint256 immediateAmount, uint256 lockedAmount, uint256 unlockTime, bool isUnlocked, uint256 timeRemaining)",
  
  // Write functions
  "function depositBnb() payable",
  "function withdrawLockedBnb(address investor)",
  "function withdrawPendingBnb()",
  "function activateEmergencyStop()",
  "function deactivateEmergencyStop()",
  
  // Events
  "event BnbDeposited(address indexed investor, uint256 bnbAmount, uint256 tokensReceived, uint256 bnbPrice)",
  "event LockedBnbWithdrawn(address indexed investor, uint256 bnbAmount, address indexed recipientWallet)",
  "event WithdrawalQueued(address indexed recipient, uint256 amount)",
  "event EmergencyStopActivated()",
  "event EmergencyStopDeactivated()"
];

export const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

export const PRICE_FEED_ABI = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)"
];

// Constants
export const TOKEN_PRICE_USD = 0.1; // $0.10 per token
export const TOTAL_TOKEN_SUPPLY = 10000; // 10,000 tokens total supply (updated for secure contract)
export const MINIMUM_INVESTMENT_BNB = "0.001"; // 0.001 BNB minimum
export const MAXIMUM_INVESTMENT_BNB = "10"; // 10 BNB maximum
export const MINIMUM_INVESTMENT_SOL = "0.001"; // 0.001 SOL minimum  
export const MAXIMUM_INVESTMENT_SOL = "10"; // 10 SOL maximum

// Reown/WalletConnect configuration
export const REOWN_PROJECT_ID = getRequiredEnvVar('VITE_REOWN_PROJECT_ID')

// Update intervals (in milliseconds)
export const UPDATE_INTERVALS = {
  ESCROW_DATA: 10000, // 10 seconds
  PRICE_DATA: 30000,  // 30 seconds
  INVESTOR_DATA: 5000, // 5 seconds
  UNLOCK_TIMER: 1000,  // 1 second
};
