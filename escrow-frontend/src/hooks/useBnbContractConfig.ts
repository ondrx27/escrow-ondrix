import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { CONTRACTS, ESCROW_ABI } from '../config/contracts';

export interface BnbContractConfig {
  totalTokensAvailable: string;
  maxInvestmentPerUser: string;
  minInvestmentAmount: string;
  isLoading: boolean;
  error: string | null;
}

export const useBnbContractConfig = (): BnbContractConfig => {
  const [config, setConfig] = useState<BnbContractConfig>({
    totalTokensAvailable: '50000', // Fallback value
    maxInvestmentPerUser: '10000', // Fallback value 
    minInvestmentAmount: '0.001', // Fallback value
    isLoading: true,
    error: null,
  });

  const { provider } = useWallet();

  useEffect(() => {
    const fetchContractConfig = async () => {
      if (!provider) {
        setConfig(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        setConfig(prev => ({ ...prev, isLoading: true, error: null }));

        const contract = new ethers.Contract(
          CONTRACTS.bnb.escrow,
          ESCROW_ABI,
          provider
        );

        // Fetch configuration from contract
        const [escrowStatus, maxInvestment, minInvestment] = await Promise.all([
          contract.getEscrowStatus(),
          contract.maxInvestmentPerUser().catch(() => ethers.parseEther('10000')), // 10,000 BNB fallback
          contract.minInvestmentAmount().catch(() => ethers.parseEther('0.001')), // 0.001 BNB fallback
        ]);

        setConfig({
          totalTokensAvailable: escrowStatus.totalTokensAvailable.toString(),
          maxInvestmentPerUser: ethers.formatEther(maxInvestment),
          minInvestmentAmount: ethers.formatEther(minInvestment),
          isLoading: false,
          error: null,
        });

        console.log('✅ BNB Contract Config:', {
          tokens: escrowStatus.totalTokensAvailable.toString(),
          maxInvestment: ethers.formatEther(maxInvestment),
          minInvestment: ethers.formatEther(minInvestment),
        });

      } catch (error) {
        console.error('❌ Failed to fetch BNB contract config:', error);
        setConfig(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    fetchContractConfig();
  }, [provider]);

  return config;
};