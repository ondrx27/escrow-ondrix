import { useState, useEffect } from 'react';
import * as React from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { useWallet } from '../contexts/WalletContext';
import {
  connection,
  createDepositSolInstruction,
  solToLamports,
  calculateTokensForSol,
  getCurrentSolPrice,
  getEscrowStatus,
  getInvestorData,
  findInvestorPDA,
  findSolVaultPDA,
  GLOBAL_ESCROW,
  TOKEN_MINT,
} from '../utils/solana';

export interface SolanaEscrowData {
  isInitialized: boolean;
  totalTokensAvailable: number;
  tokensSold: number;
  totalSolDeposited: number;
  totalSolWithdrawn: number;
  lockDuration: number;
}

export interface SolanaInvestorData {
  isInitialized: boolean;
  solDeposited: number;
  tokensReceived: number;
  depositTimestamp: number;
  status: number;
  lockedSolAmount: number;
  isUnlocked: boolean;
}

export function useSolanaInvestment() {
  const wallet = useWallet();
  const [escrowData, setEscrowData] = useState<SolanaEscrowData | null>(null);
  const [investorData, setInvestorData] = useState<SolanaInvestorData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInvesting, setIsInvesting] = useState(false);
  const [currentSolPrice, setCurrentSolPrice] = useState<number>(140);

  // Fetch data when wallet connects
  useEffect(() => {
    if (wallet.isConnected && wallet.chain === 'solana' && wallet.solanaPublicKey) {
      setHasChecked(false);
      fetchData();
      const interval = setInterval(fetchData, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [wallet.isConnected, wallet.solanaPublicKey, wallet.chain]);

  // Update SOL price periodically (separate from main data fetching)
  useEffect(() => {
    if (wallet.chain === 'solana') {
      // Update SOL price immediately
      getCurrentSolPrice().then(setCurrentSolPrice).catch(console.error);
      
      // Set up interval to update price every 30 seconds
      const priceInterval = setInterval(() => {
        if (wallet.chain === 'solana') {
          getCurrentSolPrice().then(setCurrentSolPrice).catch(console.error);
        }
      }, 30000); // 30 seconds
      
      return () => clearInterval(priceInterval);
    }
  }, [wallet.chain]);

  const fetchData = async () => {
    if (!wallet.solanaPublicKey) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch current SOL price
      const solPrice = await getCurrentSolPrice();
      setCurrentSolPrice(solPrice);

      // Fetch escrow status
      const escrowStatus = await getEscrowStatus();
      setEscrowData(escrowStatus);

      // Fetch investor data
      const investorStatus = await getInvestorData(wallet.solanaPublicKey);
      setInvestorData(investorStatus);

    } catch (err: any) {
      console.error('Error fetching Solana data:', err);
      setError(err.message || 'Failed to fetch escrow data');
    } finally {
      setIsLoading(false);
      setHasChecked(true);
    }
  };

  const invest = async (solAmount: number): Promise<void> => {
    if (!wallet.solanaWallet || !wallet.solanaPublicKey) {
      throw new Error('Solana wallet not connected');
    }

    if (solAmount <= 0 || solAmount < 0.001 || solAmount > 10) {
      throw new Error('Investment amount must be between 0.001 and 10 SOL');
    }

    try {
      setIsInvesting(true);
      setError(null);

      // Check SOL balance first
      const balance = await connection.getBalance(wallet.solanaPublicKey);
      const lamports = solToLamports(solAmount);
      
      if (balance < Number(lamports) + 10000000) { // Add 0.01 SOL for transaction fees
        throw new Error(`Insufficient SOL balance. You need at least ${(Number(lamports) + 10000000) / 1e9} SOL (including fees)`);
      }

      const recipientWallet = new PublicKey(import.meta.env.VITE_SOLANA_RECIPIENT_WALLET || 'EJ6bPvsTXfzk1WS9eXKDQ3KL5x9a2wy15XPxL48FdeAc');

      // Check if investor token account exists, create if not
      const investorTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT,
        wallet.solanaPublicKey
      );

      const transaction = new Transaction();

      // Check if token account exists
      const tokenAccountInfo = await connection.getAccountInfo(investorTokenAccount);
      if (!tokenAccountInfo) {
        // Account doesn't exist, create it
        console.log('Creating token account for investor:', investorTokenAccount.toString());
        const createTokenAccountIx = createAssociatedTokenAccountInstruction(
          wallet.solanaPublicKey,
          investorTokenAccount,
          wallet.solanaPublicKey,
          TOKEN_MINT
        );
        transaction.add(createTokenAccountIx);
      }

      // Create deposit instruction
      const depositIx = await createDepositSolInstruction(
        wallet.solanaPublicKey,
        GLOBAL_ESCROW,
        TOKEN_MINT,
        recipientWallet,
        lamports
      );

      transaction.add(depositIx);

      // Set recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.solanaPublicKey;

      // Simulate transaction first (no signers needed for simulation)
      const simulation = await connection.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        console.error('Transaction simulation failed:', simulation.value.err);
        console.error('Logs:', simulation.value.logs);
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }

      // Sign and send transaction
      const signedTx = await wallet.solanaWallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Calculate expected tokens with current price
      const expectedTokens = calculateTokensForSol(solAmount, currentSolPrice);

      // Show success message
      setError(`✅ Investment successful! You received ${expectedTokens.toFixed(2)} ODX tokens. Transaction: ${signature.slice(0, 8)}...`);

      // Refresh data
      await fetchData();

    } catch (err: any) {
      console.error('Investment error:', err);
      let errorMessage = 'Investment failed: ';
      
      if (err.message?.includes('insufficient funds')) {
        errorMessage += 'Insufficient SOL balance';
      } else if (err.message?.includes('User rejected')) {
        errorMessage += 'Transaction was rejected by user';
      } else if (err.message?.includes('blockhash')) {
        errorMessage += 'Transaction expired, please try again';
      } else {
        errorMessage += err.message || 'Unknown error occurred';
      }
      
      throw new Error(errorMessage);
    } finally {
      setIsInvesting(false);
    }
  };

  // Calculate investor addresses when wallet is connected
  const investorAddresses = wallet.solanaPublicKey ? {
    investorPDA: findInvestorPDA(wallet.solanaPublicKey, GLOBAL_ESCROW)[0].toString(),
    solVaultPDA: findSolVaultPDA(wallet.solanaPublicKey, GLOBAL_ESCROW)[0].toString(),
    tokenAccount: null as string | null, // Will be calculated async
  } : null;

  // Calculate token account address
  React.useEffect(() => {
    if (wallet.solanaPublicKey && investorAddresses) {
      getAssociatedTokenAddress(TOKEN_MINT, wallet.solanaPublicKey)
        .then(address => {
          investorAddresses.tokenAccount = address.toString();
        })
        .catch(console.error);
    }
  }, [wallet.solanaPublicKey]);

  return {
    escrowData,
    investorData,
    isLoading,
    hasChecked,
    error,
    isInvesting,
    invest,
    fetchData,
    calculateTokensForSol: (amount: number) => calculateTokensForSol(amount, currentSolPrice),
    currentSolPrice,
    investorAddresses,
  };
}