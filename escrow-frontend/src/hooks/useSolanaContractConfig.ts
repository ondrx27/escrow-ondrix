import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { getEscrowStatus } from '../utils/solana';

export interface SolanaContractConfig {
  totalTokensAvailable: number;
  maxInvestmentPerUser: number; // In SOL
  minInvestmentAmount: number; // In SOL
  isLoading: boolean;
  error: string | null;
}

export const useSolanaContractConfig = (): SolanaContractConfig => {
  const [config, setConfig] = useState<SolanaContractConfig>({
    totalTokensAvailable: 50000, // Fallback value
    maxInvestmentPerUser: 10, // 10 SOL fallback
    minInvestmentAmount: 0.001, // 0.001 SOL fallback
    isLoading: true,
    error: null,
  });

  const { chain } = useWallet();

  useEffect(() => {
    const fetchContractConfig = async () => {
      if (chain !== 'solana') {
        setConfig(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        setConfig(prev => ({ ...prev, isLoading: true, error: null }));

        // Fetch escrow status to get total tokens available
        const escrowData = await getEscrowStatus();

        setConfig({
          totalTokensAvailable: escrowData.totalTokensAvailable,
          maxInvestmentPerUser: 10, // Keep current SOL limit for now
          minInvestmentAmount: 0.001, // Keep current SOL minimum
          isLoading: false,
          error: null,
        });

        console.log('✅ Solana Contract Config:', {
          tokens: escrowData.totalTokensAvailable,
          maxInvestment: 10,
          minInvestment: 0.001,
        });

      } catch (error) {
        console.error('❌ Failed to fetch Solana contract config:', error);
        setConfig(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    fetchContractConfig();
  }, [chain]);

  return config;
};