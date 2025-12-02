import { 
  Connection, 
  PublicKey, 
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SYSVAR_CLOCK_PUBKEY
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { CONTRACTS, NETWORKS, PRICE_FEED_ABI } from '../config/contracts';
import { ethers } from 'ethers';

// Connection to Solana devnet
export const connection = new Connection(NETWORKS.solana.rpcUrl, 'confirmed');

// Program ID and contract addresses
export const PROGRAM_ID = new PublicKey(CONTRACTS.solana.programId);
export const GLOBAL_ESCROW = new PublicKey(CONTRACTS.solana.globalEscrow!);
export const TOKEN_MINT = new PublicKey(CONTRACTS.solana.tokenMint!);

// Instruction types
export enum EscrowInstruction {
  InitializeEscrow = 0,
  DepositSol = 1,
  WithdrawLockedSol = 2,
  GetEscrowStatus = 3,
  CloseSale = 4,
  TotalDeposited = 5,
  TotalUnlocked = 6,
  TotalLocked = 7,
  NextUnlockTime = 8,
  GetInvestorLockStatus = 9,
}

// Investor status enum
export enum InvestorStatus {
  Uninitialized = 0,
  Deposited = 1,
  SolWithdrawn = 2,
}


// Helper to create instruction data
export class EscrowInstructionData {
  constructor(
    public instruction: EscrowInstruction,
    public params?: {
      tokenAmount?: bigint;
      lockDuration?: bigint;
      solAmount?: bigint;
      investorPubkey?: PublicKey;
    }
  ) {}

  serialize(): Buffer {
    const buffers: Buffer[] = [];
    
    // Add instruction type
    buffers.push(Buffer.from([this.instruction]));

    if (this.instruction === EscrowInstruction.DepositSol && this.params?.solAmount) {
      // Add SOL amount (8 bytes, little endian)
      const solAmountBuffer = Buffer.alloc(8);
      solAmountBuffer.writeBigUInt64LE(this.params.solAmount);
      buffers.push(solAmountBuffer);
    } else if (this.instruction === EscrowInstruction.NextUnlockTime && this.params?.investorPubkey) {
      // Add investor pubkey (32 bytes)
      buffers.push(this.params.investorPubkey.toBuffer());
    } else if (this.instruction === EscrowInstruction.GetInvestorLockStatus && this.params?.investorPubkey) {
      // Add investor pubkey (32 bytes)
      buffers.push(this.params.investorPubkey.toBuffer());
    }
    // For TotalDeposited, TotalUnlocked, TotalLocked - no additional data needed

    return Buffer.concat(buffers);
  }
}

// PDA helpers
export function findGlobalEscrowPDA(initializer: PublicKey, tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('global_escrow'),
      initializer.toBuffer(),
      tokenMint.toBuffer(),
    ],
    PROGRAM_ID
  );
}

export function findInvestorPDA(investor: PublicKey, globalEscrow: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('investor'),
      investor.toBuffer(),
      globalEscrow.toBuffer(),
    ],
    PROGRAM_ID
  );
}

export function findSolVaultPDA(investor: PublicKey, globalEscrow: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('sol_vault'),
      investor.toBuffer(),
      globalEscrow.toBuffer(),
    ],
    PROGRAM_ID
  );
}

export function findTokenVaultPDA(globalEscrow: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('token_vault'),
      globalEscrow.toBuffer(),
    ],
    PROGRAM_ID
  );
}

// Hardcoded oracle addresses (from contract)
export const ORACLE_PROGRAM = new PublicKey([241, 75, 246, 90, 213, 107, 210, 186, 113, 94, 69, 116, 44, 35, 31, 39, 214, 54, 33, 207, 91, 119, 143, 55, 193, 162, 72, 149, 29, 23, 86, 2]);
export const PRICE_FEED = new PublicKey([120, 245, 122, 225, 25, 94, 140, 73, 122, 139, 224, 84, 173, 82, 173, 244, 200, 151, 111, 132, 54, 115, 35, 9, 226, 42, 247, 6, 119, 36, 173, 150]);

// Create deposit SOL instruction
export async function createDepositSolInstruction(
  investor: PublicKey,
  globalEscrow: PublicKey,
  tokenMint: PublicKey,
  recipientWallet: PublicKey,
  solAmount: bigint
): Promise<TransactionInstruction> {
  const [investorPDA] = findInvestorPDA(investor, globalEscrow);
  const [solVaultPDA] = findSolVaultPDA(investor, globalEscrow);
  const [tokenVaultPDA] = findTokenVaultPDA(globalEscrow);
  const investorTokenAccount = await getAssociatedTokenAddress(tokenMint, investor);

  const data = new EscrowInstructionData(EscrowInstruction.DepositSol, { solAmount });

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: investor, isSigner: true, isWritable: true },
      { pubkey: globalEscrow, isSigner: false, isWritable: true },
      { pubkey: investorPDA, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: tokenVaultPDA, isSigner: false, isWritable: true },
      { pubkey: investorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: recipientWallet, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ORACLE_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: PRICE_FEED, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    data: data.serialize(),
  });
}

// Convert SOL to lamports
export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * LAMPORTS_PER_SOL));
}

// Convert lamports to SOL
export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

// Get SOL price from DexScreener (reliable, no CORS issues)
export async function getSolPriceFromDexScreener(): Promise<number> {
  try {
    const SOL_ADDRESS = "So11111111111111111111111111111111111111112";
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SOL_ADDRESS}`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        // Find the pair with highest volume (most reliable)
        const bestPair = data.pairs.reduce((best: any, pair: any) => {
          const volume = parseFloat(pair.volume?.h24 || 0);
          const bestVolume = parseFloat(best.volume?.h24 || 0);
          return volume > bestVolume ? pair : best;
        });
        
        const price = parseFloat(bestPair.priceUsd);
        console.log(`📊 SOL price from DexScreener: $${price.toFixed(2)}`);
        return price;
      }
    }
    
    throw new Error('No price data from DexScreener');
  } catch (error) {
    console.error('❌ DexScreener error:', error);
    throw error;
  }
}

// Get current SOL price with fallback
export async function getCurrentSolPrice(): Promise<number> {
  try {
    // Try to get real-time SOL price from DexScreener
    return await getSolPriceFromDexScreener();
  } catch (error) {
    console.warn('Failed to fetch SOL price from DexScreener, using fallback');
    // Use a reasonable fallback price
    return 140; // Fallback price for stability
  }
}

// Get BNB price directly from Chainlink price feed
export async function getBnbPriceFromChainlink(): Promise<number> {
  try {
    // BSC Testnet RPC URL
    const rpcUrl = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Chainlink BNB/USD price feed on BSC Testnet
    const priceFeedAddress = CONTRACTS.bnb.priceFeed;
    const priceFeed = new ethers.Contract(priceFeedAddress, PRICE_FEED_ABI, provider);
    
    // Get latest price data
    const priceData = await priceFeed.latestRoundData();
    const decimals = await priceFeed.decimals();
    
    // Convert price to number (Chainlink prices have 8 decimals)
    const price = Number(ethers.formatUnits(priceData.answer, decimals));
    
    console.log(`📊 BNB price from Chainlink: $${price.toFixed(2)}`);
    return price;
  } catch (error) {
    console.error('❌ Error fetching BNB price from Chainlink:', error);
    throw error;
  }
}

export async function getCurrentBnbPrice(): Promise<number> {
  try {
    // Get BNB price from Chainlink on-chain feed instead of CoinGecko
    return await getBnbPriceFromChainlink();
  } catch (error) {
    console.warn('Failed to fetch BNB price from Chainlink, using fallback');
    return 580; // Current realistic BNB price
  }
}

export function calculateTokensForSol(solAmount: number, solPrice: number = 140): number {
  // Use actual SOL price instead of hardcoded $250
  // Token price remains $0.10 as per contract
  const tokenPriceUsd = 0.10;
  return (solAmount * solPrice) / tokenPriceUsd;
}

export function calculateTokensForBnb(bnbAmount: number, bnbPrice: number = 580): number {
  // Use actual BNB price instead of hardcoded $250
  // Token price remains $0.10 as per contract
  const tokenPriceUsd = 0.10;
  return (bnbAmount * bnbPrice) / tokenPriceUsd;
}

// Manual parsing function for GlobalEscrow account data
function parseGlobalEscrowData(data: Buffer): {
  isInitialized: number;
  totalTokensAvailable: bigint;
  tokensSold: bigint;
  totalSolDeposited: bigint;
  totalSolWithdrawn: bigint;
  lockDuration: bigint;
  initializationTimestamp: bigint;
} {
  const reader = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  
  const isInitialized = data[offset]; offset += 1; // u8
  offset += 32; // initializerPubkey 
  offset += 32; // tokenMintPubkey
  offset += 32; // recipientWallet
  
  const totalTokensAvailable = reader.getBigUint64(offset, true); offset += 8;
  const tokensSold = reader.getBigUint64(offset, true); offset += 8;
  const totalSolDeposited = reader.getBigUint64(offset, true); offset += 8;
  const totalSolWithdrawn = reader.getBigUint64(offset, true); offset += 8;
  const lockDuration = reader.getBigInt64(offset, true); offset += 8;
  offset += 1; // bump_seed
  offset += 32; // oracle_program_id
  offset += 32; // price_feed_pubkey
  offset += 8; // min_sol_investment
  offset += 8; // max_sol_investment
  offset += 8; // price_staleness_threshold
  offset += 8; // sale_end_timestamp
  const initializationTimestamp = reader.getBigInt64(offset, true); offset += 8;
  
  return {
    isInitialized,
    totalTokensAvailable,
    tokensSold,
    totalSolDeposited,
    totalSolWithdrawn,
    lockDuration,
    initializationTimestamp
  };
}

// Get escrow status from global escrow account
export async function getEscrowStatus(): Promise<{
  isInitialized: boolean;
  totalTokensAvailable: number;
  tokensSold: number;
  totalSolDeposited: number;
  totalSolWithdrawn: number;
  lockDuration: number;
  initializationTimestamp: number;
}> {
  try {
    const accountInfo = await connection.getAccountInfo(GLOBAL_ESCROW);
    
    if (!accountInfo || !accountInfo.data) {
      throw new Error('Global escrow account not found');
    }

    // Parse the account data manually
    const escrowData = parseGlobalEscrowData(accountInfo.data);

    return {
      isInitialized: escrowData.isInitialized === 1,
      totalTokensAvailable: Number(escrowData.totalTokensAvailable) / 1e9, // Convert from base units to tokens
      tokensSold: Number(escrowData.tokensSold) / 1e9,
      totalSolDeposited: Number(escrowData.totalSolDeposited) / LAMPORTS_PER_SOL, // Convert to SOL
      totalSolWithdrawn: Number(escrowData.totalSolWithdrawn) / LAMPORTS_PER_SOL,
      lockDuration: Number(escrowData.lockDuration),
      initializationTimestamp: Number(escrowData.initializationTimestamp),
    };
  } catch (error) {
    console.error('Error fetching escrow status:', error);
    throw error;
  }
}

// Manual parsing function for InvestorAccount data
function parseInvestorData(data: Buffer): {
  isInitialized: number;
  solDeposited: bigint;
  tokensReceived: bigint;
  depositTimestamp: bigint;
  status: number;
} {
  const reader = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  
  const isInitialized = data[offset]; offset += 1; // u8
  offset += 32; // investorPubkey
  offset += 32; // globalEscrowPubkey
  
  const solDeposited = reader.getBigUint64(offset, true); offset += 8;
  const tokensReceived = reader.getBigUint64(offset, true); offset += 8;
  const depositTimestamp = reader.getBigInt64(offset, true); offset += 8;
  offset += 8; // solUsdPrice
  const status = data[offset]; offset += 1; // u8 status
  
  return {
    isInitialized,
    solDeposited,
    tokensReceived,
    depositTimestamp,
    status
  };
}

// Get investor data from investor PDA
export async function getInvestorData(investor: PublicKey): Promise<{
  isInitialized: boolean;
  solDeposited: number;
  tokensReceived: number;
  depositTimestamp: number;
  status: number;
  lockedSolAmount: number;
  isUnlocked: boolean;
} | null> {
  try {
    // Find the investor PDA
    const [investorPDA] = findInvestorPDA(investor, GLOBAL_ESCROW);
    
    // Fetch the investor account data
    const accountInfo = await connection.getAccountInfo(investorPDA);
    
    if (!accountInfo || !accountInfo.data) {
      // Account doesn't exist, return null (no investment)
      return null;
    }

    // Check if account is owned by our program
    if (!accountInfo.owner.equals(PROGRAM_ID)) {
      console.warn('Investor account not owned by program');
      return null;
    }

    // Parse the account data manually
    const investorData = parseInvestorData(accountInfo.data);

    // Check if account is initialized
    if (investorData.isInitialized !== 1) {
      return null;
    }

    // Get global escrow data to check lock duration
    const escrowStatus = await getEscrowStatus();
    
    // Calculate if unlocked (GLOBAL TIMING - current time > initialization time + lock duration)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const unlockTimestamp = escrowStatus.initializationTimestamp + escrowStatus.lockDuration;
    const isUnlocked = currentTimestamp >= unlockTimestamp;

    return {
      isInitialized: true,
      solDeposited: Number(investorData.solDeposited), // Keep in lamports
      tokensReceived: Number(investorData.tokensReceived), // Keep in base units  
      depositTimestamp: Number(investorData.depositTimestamp),
      status: investorData.status,
      lockedSolAmount: Number(investorData.solDeposited) / 2, // 50% is locked (in lamports)
      isUnlocked,
    };
  } catch (error) {
    console.error('Error fetching investor data:', error);
    return null;
  }
}

// Get all investors (for admin or debugging purposes)
export async function getAllInvestors(): Promise<Array<{
  address: string;
  solDeposited: number;
  tokensReceived: number;
  depositTimestamp: number;
  status: number;
}>> {
  try {
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { dataSize: 99 }, // InvestorAccount size: 1+32+32+8+8+8+8+1+1 = 99
      ]
    });
    
    const investors = [];
    
    for (const account of allAccounts) {
      try {
        const investorData = parseInvestorData(account.account.data);
        
        if (investorData.isInitialized === 1) {
          investors.push({
            address: account.pubkey.toString(),
            solDeposited: Number(investorData.solDeposited),
            tokensReceived: Number(investorData.tokensReceived),
            depositTimestamp: Number(investorData.depositTimestamp),
            status: investorData.status,
          });
        }
      } catch (parseError) {
        console.warn(`Failed to parse investor account ${account.pubkey.toString()}:`, parseError);
      }
    }
    
    return investors;
  } catch (error) {
    console.error('Error fetching all investors:', error);
    return [];
  }
}

// TRANSPARENCY FUNCTIONS - Call smart contract directly

// Create instruction for TotalDeposited
export async function createTotalDepositedInstruction(): Promise<TransactionInstruction> {
  const data = new EscrowInstructionData(EscrowInstruction.TotalDeposited);
  
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: GLOBAL_ESCROW, isSigner: false, isWritable: false },
    ],
    data: data.serialize(),
  });
}

// Create instruction for TotalUnlocked
export async function createTotalUnlockedInstruction(): Promise<TransactionInstruction> {
  const data = new EscrowInstructionData(EscrowInstruction.TotalUnlocked);
  
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: GLOBAL_ESCROW, isSigner: false, isWritable: false },
    ],
    data: data.serialize(),
  });
}

// Create instruction for TotalLocked
export async function createTotalLockedInstruction(): Promise<TransactionInstruction> {
  const data = new EscrowInstructionData(EscrowInstruction.TotalLocked);
  
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: GLOBAL_ESCROW, isSigner: false, isWritable: false },
    ],
    data: data.serialize(),
  });
}

// Create instruction for NextUnlockTime
export async function createNextUnlockTimeInstruction(investor: PublicKey): Promise<TransactionInstruction> {
  const [investorPDA] = findInvestorPDA(investor, GLOBAL_ESCROW);
  const data = new EscrowInstructionData(EscrowInstruction.NextUnlockTime, { investorPubkey: investor });
  
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: GLOBAL_ESCROW, isSigner: false, isWritable: false },
      { pubkey: investorPDA, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: data.serialize(),
  });
}

// Get transparency data from smart contract
export async function getSolanaTransparencyData(): Promise<{
  totalDeposited: number;
  totalUnlocked: number;
  totalLocked: number;
}> {
  try {
    // Use the existing getEscrowStatus function and calculate transparency values
    const escrowData = await getEscrowStatus();
    
    // NEW LOGIC: Based on initialization-based timing (not individual deposit timing)
    // - totalDeposited: direct from contract
    // - Check if global unlock time has passed based on contract initialization
    // - totalUnlocked: immediate 50% + time-unlocked portion (if unlock time passed)
    // - totalLocked: only locked portion that hasn't been time-unlocked yet
    
    const totalDeposited = escrowData.totalSolDeposited;
    const immediate50Percent = totalDeposited / 2; // 50% released immediately to project
    const locked50Percent = totalDeposited / 2; // 50% time-locked
    
    // Check if global unlock time has passed
    const currentTime = Math.floor(Date.now() / 1000);
    const globalUnlockTime = escrowData.initializationTimestamp + escrowData.lockDuration;
    const hasGlobalUnlockTimePassed = currentTime >= globalUnlockTime;
    
    // Calculate unlocked and locked amounts
    let totalUnlocked: number;
    let totalLocked: number;
    
    if (hasGlobalUnlockTimePassed) {
      // Time has passed: 50% immediate + 50% time-unlocked = 100% available
      totalUnlocked = totalDeposited; // All funds are now unlocked for withdrawal
      totalLocked = 0; // Nothing is locked anymore
    } else {
      // Time hasn't passed: only 50% immediate is available
      totalUnlocked = immediate50Percent; // Only immediate 50% available
      totalLocked = locked50Percent; // 50% still locked by time
    }
    
    console.log('🔍 Solana transparency calculation:', {
      totalDeposited,
      immediate50Percent,
      locked50Percent,
      currentTime,
      globalUnlockTime,
      hasGlobalUnlockTimePassed,
      initializationTimestamp: escrowData.initializationTimestamp,
      lockDuration: escrowData.lockDuration,
      calculatedUnlocked: totalUnlocked,
      calculatedLocked: totalLocked
    });
    
    return {
      totalDeposited,
      totalUnlocked,
      totalLocked: Math.max(0, totalLocked), // Ensure never negative
    };
  } catch (error) {
    console.error('Error getting Solana transparency data:', error);
    throw error;
  }
}

// Get next unlock time (based on contract initialization, not individual deposits)
export async function getSolanaNextUnlockTime(): Promise<number> {
  try {
    const escrowData = await getEscrowStatus();
    
    if (!escrowData.isInitialized) {
      return 0; // Contract not initialized
    }
    
    // Timer starts from contract initialization
    const unlockTime = escrowData.initializationTimestamp + escrowData.lockDuration;
    
    return unlockTime;
  } catch (error) {
    console.error('Error getting next unlock time:', error);
    return 0;
  }
}