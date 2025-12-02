import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../contexts/WalletContext';
import { 
  TrendingUp, 
  Clock, 
  Wallet, 
  DollarSign, 
  Lock, 
  RefreshCw,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { ethers } from 'ethers';
import { CONTRACTS, ESCROW_ABI, NETWORKS } from '../config/contracts';
import { useSolanaInvestment } from '../hooks/useSolanaInvestment';
import { useBnbContractConfig } from '../hooks/useBnbContractConfig';
import { useSolanaContractConfig } from '../hooks/useSolanaContractConfig';
import { getCurrentBnbPrice, calculateTokensForBnb, getSolanaTransparencyData } from '../utils/solana';
import { NetworkSwitchModal } from './NetworkSwitchModal';
import { 
  SkeletonNetworkInfo, 
  SkeletonInvestmentForm, 
  SkeletonStats, 
  SkeletonStat 
} from './LoadingSkeleton';
import { SolanaIcon, BnbIcon } from './NetworkIcons';

interface InvestorData {
  isInitialized: boolean;
  bnbDeposited: string;
  tokensReceived: string;
  depositTimestamp: number;
  bnbUsdPrice: string;
  firstDepositPrice: string;
  weightedAveragePrice: string;
  status: number;
  lockedBnbAmount: string;
  isUnlocked: boolean;
}

interface EscrowStatus {
  isInitialized: boolean;
  totalTokensAvailable: string;
  tokensSold: string;
  totalBnbDeposited: string;
  totalBnbWithdrawn: string;
  lockDuration: number;
}

interface TransparencyStats {
  totalDeposited: string;
  totalUnlocked: string;
  totalLocked: string;
  nextUnlockTime: number;
}

export const InvestmentDashboard: React.FC = () => {
  const wallet = useWallet();
  const [investorData, setInvestorData] = useState<InvestorData | null>(null);
  const [escrowStatus, setEscrowStatus] = useState<EscrowStatus | null>(null);
  const [transparencyStats, setTransparencyStats] = useState<TransparencyStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedData, setHasCheckedData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [isInvesting, setIsInvesting] = useState(false);
  const [unlockTimer, setUnlockTimer] = useState<string>('');
  const [currentBnbPrice, setCurrentBnbPrice] = useState<number>(580);
  const [showNetworkSwitchModal, setShowNetworkSwitchModal] = useState(false);
  const [targetNetwork, setTargetNetwork] = useState<'solana' | 'bnb'>('bnb');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [solanaTransparencyStats, setSolanaTransparencyStats] = useState<{
    totalDeposited: number;
    totalUnlocked: number;
    totalLocked: number;
  } | null>(null);
  
  // Solana hook
  const solanaInvestment = useSolanaInvestment();
  const bnbContractConfig = useBnbContractConfig();
  const solanaContractConfig = useSolanaContractConfig();

  // Demo data for both networks
  const getDemoData = () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const depositTime = currentTime - 1800; // 30 minutes ago
    
    if (wallet.chain === 'solana') {
      const solPrice = 237; // $237 per SOL (current price)
      const investmentSol = 1.0; // 1 SOL investment
      const tokensReceived = (investmentSol * solPrice) / 0.10; // 2370 tokens at $0.10 each
      const lockDuration = 0; // Demo mode - show "N/A" instead of countdown
      
      // For demo, make investment 2 minutes ago so it's still locked
      const demoDepositTime = currentTime - 120; // 2 minutes ago
      const demoUnlockTime = demoDepositTime + lockDuration;
      const demoIsUnlocked = currentTime >= demoUnlockTime;
      
      return {
        investorData: {
          isInitialized: true,
          solDeposited: investmentSol * 1e9, // Individual demo: 1 SOL
          tokensReceived: tokensReceived * 1e9, // 2370.000000000 tokens
          depositTimestamp: demoDepositTime,
          lockedSolAmount: demoIsUnlocked ? 0 : (investmentSol / 2) * 1e9, // 0.5 SOL locked
          isUnlocked: demoIsUnlocked
        },
        escrowData: {
          totalTokensAvailable: solanaContractConfig.totalTokensAvailable, // Dynamic from contract
          tokensSold: 4500, // Multiple investors: our 2370 + others
          totalSolDeposited: 8.5, // Total across all investors
          totalSolWithdrawn: 4.25, // 50% released to project (8.5 * 0.5)
          lockDuration,
          initializationTimestamp: currentTime - 3600 // 1 hour ago
        }
      };
    } else {
      // BNB demo data - FIXED: Use initialization timestamp 
      const bnbPrice = currentBnbPrice;
      const investmentBnb = 1.0; // 1 BNB investment  
      const tokensReceived = (investmentBnb * bnbPrice) / 0.10; // tokens at $0.10 each
      const lockDuration = 0; // Demo mode - show "N/A" instead of countdown
      const initializationTime = currentTime - 7200; // Contract initialized 2 hours ago
      const unlockTime = initializationTime + lockDuration; // GLOBAL unlock time
      const isUnlocked = currentTime >= unlockTime;
      
      return {
        investorData: {
          isInitialized: true,
          bnbDeposited: investmentBnb.toFixed(4),
          tokensReceived: tokensReceived.toFixed(2),
          depositTimestamp: depositTime,
          bnbUsdPrice: bnbPrice.toString(),
          firstDepositPrice: bnbPrice.toString(),
          weightedAveragePrice: bnbPrice.toString(),
          status: 1,
          lockedBnbAmount: isUnlocked ? "0.0000" : (investmentBnb / 2).toFixed(4),
          isUnlocked
        },
        escrowStatus: {
          isInitialized: true,
          totalTokensAvailable: bnbContractConfig.totalTokensAvailable,
          tokensSold: "8500", // Realistic: our ~5800 + others  
          totalBnbDeposited: "12.5", // Total across all investors
          totalBnbWithdrawn: "6.25", // 50% released (12.5 * 0.5)
          lockDuration
        },
        transparencyStats: {
          totalDeposited: "12.5", // Total deposited
          totalUnlocked: "6.25", // 50% released to project
          totalLocked: "6.25", // 50% still locked
          nextUnlockTime: unlockTime, // GLOBAL unlock time from initialization
          initializationTimestamp: initializationTime // Add initialization timestamp
        }
      };
    }
  };

  // Detect Firefox for animation optimization
  const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  
  // Optimized styles for Firefox/Linux
  const getMotionStyles = () => {
    if (isFirefox) {
      return {
        willChange: 'auto',
        transform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden' as const,
        isolation: 'isolate' as const
      };
    }
    return {
      willChange: 'transform, opacity',
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden' as const,
      perspective: '1000px'
    };
  };

  // Optimized transition settings for Firefox
  const getTransition = (delay: number) => {
    if (isFirefox) {
      return { 
        delay, 
        duration: 0.2, 
        ease: "easeOut",
        type: "tween" as const
      };
    }
    return { 
      delay, 
      duration: 0.25, 
      ease: "easeOut" 
    };
  };



  // Update intervals with network switching delay
  useEffect(() => {
    if (wallet.isConnected && wallet.chain === 'bnb') {
      // Reset check status when wallet/chain changes
      setHasCheckedData(false);
      
      // Load data once when switching networks
      const timer = setTimeout(() => {
        fetchData();
      }, wallet.chain === 'bnb' ? 1000 : 0); // Small delay for BNB switching
      
      return () => clearTimeout(timer);
    }
  }, [wallet.isConnected, wallet.address, wallet.chain, wallet.reownAddress]);

  // FIXED: Global unlock timer based on initialization timestamp
  useEffect(() => {
    if (investorData && investorData.isInitialized && !investorData.isUnlocked && transparencyStats?.nextUnlockTime && !isDemoMode) {
      const interval = setInterval(() => {
        const now = Date.now() / 1000;
        const unlockTime = transparencyStats.nextUnlockTime; // GLOBAL unlock time from initialization
        const remaining = unlockTime - now;
        
        if (remaining <= 0) {
          setUnlockTimer('Unlocked!');
        } else {
          const hours = Math.floor(remaining / 3600);
          const minutes = Math.floor((remaining % 3600) / 60);
          const seconds = Math.floor(remaining % 60);
          
          if (hours > 0) {
            setUnlockTimer(`${hours}h ${minutes}m ${seconds}s`);
          } else {
            setUnlockTimer(`${minutes}m ${seconds}s`);
          }
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [investorData, transparencyStats, isDemoMode]);

  // Update BNB price periodically
  useEffect(() => {
    if (wallet.chain === 'bnb') {
      // Update BNB price immediately
      getCurrentBnbPrice().then(setCurrentBnbPrice).catch(console.error);
      
      // Set up interval to update price every 30 seconds
      const priceInterval = setInterval(() => {
        if (wallet.chain === 'bnb') {
          getCurrentBnbPrice().then(setCurrentBnbPrice).catch(console.error);
        }
      }, 30000); // 30 seconds
      
      return () => clearInterval(priceInterval);
    }
  }, [wallet.chain]);

  // Load Solana transparency data
  useEffect(() => {
    if (wallet.chain === 'solana') {
      const loadSolanaTransparency = async () => {
        try {
          const transparencyData = await getSolanaTransparencyData();
          setSolanaTransparencyStats(transparencyData);
        } catch (error) {
          console.error('Error loading Solana transparency data:', error);
          setSolanaTransparencyStats(null);
        }
      };

      loadSolanaTransparency();
      
      // Load once on network change only - no auto-refresh
    }
  }, [wallet.chain]);

  const fetchData = async () => {
    if (!wallet.address || wallet.chain !== 'bnb') return;

    // Additional validation: ensure we have a proper BNB address (starts with 0x and 42 chars)
    if (wallet.chain === 'bnb' && (!wallet.address.startsWith('0x') || wallet.address.length !== 42)) {
      console.log('⏳ Waiting for proper BNB address, current address:', wallet.address);
      return;
    }

    // Ensure we have the BNB provider ready
    if (wallet.chain === 'bnb' && !wallet.reownAddress) {
      console.log('⏳ Waiting for Reown connection to be established');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('📊 Fetching BNB data for address:', wallet.address);

      // Fetch current BNB price
      const bnbPrice = await getCurrentBnbPrice();
      setCurrentBnbPrice(bnbPrice);

      // Use JsonRpcProvider with explicit network config to avoid ENS issues
      const provider = new ethers.JsonRpcProvider(NETWORKS.bnb.rpcUrl, {
        name: "BSC Testnet",
        chainId: 97
      });
      
      const escrowContract = new ethers.Contract(
        CONTRACTS.bnb.escrow,
        ESCROW_ABI,
        provider
      );

      // Fetch escrow status
      const status = await escrowContract.getEscrowStatus();
      setEscrowStatus({
        isInitialized: status.isInitialized,
        totalTokensAvailable: ethers.formatEther(status.totalTokensAvailable || 0),
        tokensSold: ethers.formatEther(status.tokensSold || 0),
        totalBnbDeposited: ethers.formatEther(status.totalBnbDeposited || 0),
        totalBnbWithdrawn: ethers.formatEther(status.totalBnbWithdrawn || 0),
        lockDuration: Number(status.lockDuration || 0),
      });

      // Fetch transparency statistics with FIXED global unlock time
      try {
        const [totalDeposited, totalUnlocked, totalLocked, initTimestamp, escrowStatus] = await Promise.all([
          escrowContract.totalDeposited(),
          escrowContract.totalUnlocked(), 
          escrowContract.totalLocked(),
          escrowContract.getInitializationTimestamp(),
          escrowContract.getEscrowStatus()
        ]);

        // Calculate GLOBAL unlock time from initialization timestamp
        const initializationTimestamp = Number(initTimestamp);
        const lockDuration = Number(escrowStatus.lockDuration);
        const nextUnlockTime = initializationTimestamp + lockDuration;
        
        console.log('🔒 BNB unlock time calculation (FIXED):', {
          initializationTimestamp,
          lockDuration,
          nextUnlockTime,
          currentTime: Math.floor(Date.now() / 1000),
          unlockDate: new Date(nextUnlockTime * 1000).toLocaleString()
        });

        setTransparencyStats({
          totalDeposited: ethers.formatEther(totalDeposited),
          totalUnlocked: ethers.formatEther(totalUnlocked),
          totalLocked: ethers.formatEther(totalLocked),
          nextUnlockTime,
          initializationTimestamp // Add initialization timestamp
        });
        
        console.log('📊 Transparency stats loaded:', {
          totalDeposited: ethers.formatEther(totalDeposited),
          totalUnlocked: ethers.formatEther(totalUnlocked),
          totalLocked: ethers.formatEther(totalLocked)
        });
      } catch (transparencyError) {
        console.log('⚠️ Transparency functions not available:', transparencyError);
        // Не критично, можно работать без них
      }

      // Fetch investor data
      const investor = await escrowContract.getInvestorInfo(wallet.address);
      const isUnlocked = await escrowContract.isUnlockTime(wallet.address);
      
      setInvestorData({
        isInitialized: investor.isInitialized,
        bnbDeposited: ethers.formatEther(investor.bnbDeposited || 0),
        tokensReceived: ethers.formatEther(investor.tokensReceived || 0),
        depositTimestamp: Number(investor.depositTimestamp || 0),
        bnbUsdPrice: ethers.formatEther(investor.bnbUsdPrice || investor.firstDepositPrice || 0),
        firstDepositPrice: ethers.formatEther(investor.firstDepositPrice || 0),
        weightedAveragePrice: ethers.formatEther(investor.weightedAveragePrice || 0),
        status: Number(investor.status || 0),
        lockedBnbAmount: ethers.formatEther(investor.lockedBnbAmount || 0),
        isUnlocked,
      });

    } catch (err: any) {
      console.error('Error fetching data:', err);
      
      // Handle ENS errors specifically during network switching
      if (err.message?.includes('network does not support ENS')) {
        console.log('🔄 ENS error during network switch, likely due to provider mismatch. This should resolve shortly.');
        // Don't show error to user for ENS issues during switching
        return;
      }
      
      // Handle invalid address errors
      if (err.message?.includes('invalid address') || err.message?.includes('bad address checksum')) {
        console.log('⏳ Address validation error, waiting for proper network address');
        return;
      }
      
      setError(err.message || 'Failed to fetch data');
    } finally {
      setIsLoading(false);
      setHasCheckedData(true);
    }
  };

  const handleInvest = async () => {
    if (isDemoMode) {
      setError("🎭 Demo mode is active. Please exit demo mode to make real investments.");
      return;
    }
    
    if (!wallet.address || !investAmount || parseFloat(investAmount) < 0.001) return;

    const attemptInvestment = async (attempt: number = 1): Promise<void> => {
      try {
        setIsInvesting(true);
        setError(null);
        
        if (attempt > 1) {
          console.log(`🔄 Retry attempt ${attempt}...`);
        }

      const signer = await wallet.getSigner();
      if (!signer) throw new Error('Unable to get signer');

      const escrowContract = new ethers.Contract(
        CONTRACTS.bnb.escrow,
        ESCROW_ABI,
        signer
      );

      // Check if contract is initialized and has enough tokens
      const escrowStatus = await escrowContract.getEscrowStatus();

      if (!escrowStatus.isInitialized) {
        throw new Error('Escrow contract is not initialized. Contact support.');
      }

      // Check if emergency stop is active
      const emergencyStop = await escrowContract.emergencyStop();
      if (emergencyStop) {
        throw new Error('Contract is currently paused. Investments are temporarily disabled.');
      }

      // Test price feed through contract
      try {
        console.log('💱 Testing price feed through contract...');
        const contractPriceData = await escrowContract.getChainlinkPrice();
        console.log('💱 BNB price from contract:', ethers.formatUnits(contractPriceData.price, 8), 'USD');
        console.log('⏰ Price timestamp:', new Date(Number(contractPriceData.timestamp) * 1000).toISOString());
      } catch (priceError: any) {
        console.error('❌ Contract price feed error:', priceError);
        
        // If contract says price is stale, we should retry
        if (priceError.data === '0x6234216d' || priceError.transaction?.data === '0x6234216d') {
          if (attempt < 3) {
            console.log(`⏳ Contract price data stale, retrying in 3 seconds... (attempt ${attempt + 1}/3)`);
            setError(`Price data stale, retrying... (${attempt + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return attemptInvestment(attempt + 1);
          } else {
            throw new Error('Price data is consistently stale. Please try again later.');
          }
        } else {
          throw new Error('Price feed is not working. Unable to calculate token amount.');
        }
      }

      // Check minimum investment amount
      const investmentWei = ethers.parseEther(investAmount);
      const minInvestment = ethers.parseEther('0.001'); // 0.001 BNB as per contract

      if (investmentWei < minInvestment) {
        throw new Error('Minimum investment is 0.001 BNB');
      }

      console.log('💰 Investment details:', {
        amount: investAmount + ' BNB',
        amountWei: investmentWei.toString(),
        investor: wallet.address,
        contractAddress: CONTRACTS.bnb.escrow,
        networkChainId: await signer.provider?.getNetwork()
      });

      // Skip static call for StalePriceData - try direct transaction
      console.log('💡 Skipping static call due to price staleness issues, attempting direct transaction...');

      // Estimate gas (with fallback)
      let gasLimit = 400000; // Default safe gas limit
      try {
        console.log('⛽ Estimating gas...');
        const gasEstimate = await escrowContract.depositBnb.estimateGas({
          value: investmentWei
        });
        gasLimit = Math.floor(Number(gasEstimate) * 1.2); // Add 20% buffer
        console.log('⛽ Gas estimate:', gasEstimate.toString(), '-> using:', gasLimit);
      } catch (gasError: any) {
        console.log('⚠️ Gas estimation failed, using default limit:', gasLimit);
        const errorData = gasError.data || gasError.transaction?.data;
        
        // If gas estimation fails with StalePriceData, retry
        if (errorData === '0x6234216d') {
          if (attempt < 3) {
            console.log(`⏳ Gas estimation failed due to stale price, retrying in 3 seconds... (attempt ${attempt + 1}/3)`);
            setError(`Price data stale, retrying... (${attempt + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return attemptInvestment(attempt + 1);
          } else {
            throw new Error('Price data is consistently stale. Please try again later.');
          }
        }
      }

      // Send transaction with explicit gas limit
      console.log('📤 Sending investment transaction...');
      const tx = await escrowContract.depositBnb({
        value: investmentWei,
        gasLimit: gasLimit
      });

      console.log('✅ Investment transaction sent:', tx.hash);
      console.log('⏳ Waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log('🎉 Investment confirmed! Block:', receipt.blockNumber);

      setInvestAmount('');
      fetchData(); // Refresh data

      } catch (err: any) {
      console.error('❌ Investment error:', err);
      
      // More specific error messages
      let errorMessage = 'Investment failed';
      
      if (err.message?.includes('execution reverted')) {
        if (err.data === '0x355e186c') {
          errorMessage = 'Investment amount is below minimum (0.001 BNB)';
        } else if (err.data === '0x6234216d') {
          errorMessage = 'Price data is stale. Please try again in a few seconds.';
        } else if (err.reason) {
          errorMessage = `Contract rejected transaction: ${err.reason}`;
        } else {
          errorMessage = 'Transaction was rejected by the contract. Please check investment amount and try again.';
        }
      } else if (err.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient BNB balance for this investment';
      } else if (err.message?.includes('user rejected')) {
        errorMessage = 'Transaction was rejected by user';
      } else if (err.message?.includes('gas')) {
        errorMessage = 'Gas estimation failed. Please try a smaller amount.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      } finally {
        setIsInvesting(false);
      }
    };

    // Start the investment attempt
    try {
      await attemptInvestment();
    } catch (error) {
      // Final error already handled in attemptInvestment
    }
  };

  // Network switching functions
  const handleNetworkSwitch = (network: 'solana' | 'bnb') => {
    setTargetNetwork(network);
    setShowNetworkSwitchModal(true);
  };

  const confirmNetworkSwitch = () => {
    wallet.switchChain(targetNetwork);
    setShowNetworkSwitchModal(false);
  };

  const cancelNetworkSwitch = () => {
    setShowNetworkSwitchModal(false);
  };



  if (wallet.chain === 'solana') {
    return (
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="space-y-6">

        {/* Demo Mode Toggle for Solana */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-purple-300">🎭</div>
              <div>
                <h3 className="text-purple-300 font-medium">Demo Mode</h3>
                <p className="text-purple-400 text-sm">
                  {isDemoMode 
                    ? "Viewing interface with demo investor data" 
                    : "Toggle to preview investor interface with sample data"
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDemoMode(!isDemoMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                isDemoMode ? 'bg-purple-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isDemoMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </motion.div>

        {/* Error Display for Solana */}
        <AnimatePresence>
          {(error || solanaInvestment.error) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={getMotionStyles()}
              className={`px-4 py-3 rounded-lg flex items-center justify-between ${
                (error || solanaInvestment.error)?.includes('🎭') 
                  ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
                  : (error || solanaInvestment.error)?.includes('✅') 
                    ? 'bg-accent-green/20 border border-accent-green/30 text-accent-green'
                    : 'bg-error/20 border border-error/30 text-error'
              }`}
            >
              <span>{error || solanaInvestment.error}</span>
              <button 
                onClick={() => {
                  setError(null);
                  // Note: We can't clear solanaInvestment.error directly as it's controlled by the hook
                }} 
                className={`hover:opacity-70 ${
                  (error || solanaInvestment.error)?.includes('🎭') 
                    ? 'text-purple-300'
                    : (error || solanaInvestment.error)?.includes('✅') 
                      ? 'text-accent-green'
                      : 'text-error'
                }`}
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Solana Network Info */}
        {!solanaInvestment.hasChecked ? (
          <SkeletonNetworkInfo />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-3">
                <SolanaIcon size={36} />
                <h3 className="text-lg sm:text-xl font-semibold text-text-primary">Solana Escrow Active</h3>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleNetworkSwitch('bnb')}
                className="px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center space-x-1 w-full sm:w-auto"
              >
                <BnbIcon size={24} />
                <span>Switch to BNB</span>
              </motion.button>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-text-muted mb-1">Program ID:</p>
                <p className="text-text-primary font-mono text-xs break-all">
                  {CONTRACTS.solana.programId}
                </p>
              </div>
              <div>
                <p className="text-text-muted mb-1">Token Supply:</p>
                <p className="text-text-primary">1,000 ODX (9 decimals)</p>
              </div>
              <div>
                <p className="text-text-muted mb-1">Token Price:</p>
                <p className="text-text-primary">$0.10 USD</p>
              </div>
              <div>
                <p className="text-text-muted mb-1">Lock Ends:</p>
                <p className="text-text-primary">
                  {solanaInvestment.escrowData?.initializationTimestamp ? 
                    solanaInvestment.escrowData?.lockDuration ? 
                      new Date((solanaInvestment.escrowData.initializationTimestamp + solanaInvestment.escrowData.lockDuration) * 1000).toLocaleDateString()
                      : 'N/A'
                    : 'Loading...'
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Solana Investment Interface */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Invest Section */}
          {!solanaInvestment.hasChecked ? (
            <SkeletonInvestmentForm />
          ) : (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="card"
            >
            <h3 className="text-xl font-semibold text-text-primary mb-4">Make Investment</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-text-muted text-sm mb-2">
                  Investment Amount (SOL)
                </label>
                <input
                  type="number"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  placeholder="0.001"
                  min={solanaContractConfig.minInvestmentAmount.toString()}
                  max={solanaContractConfig.maxInvestmentPerUser.toString()}
                  step="0.001"
                  className="input"
                  disabled={!wallet.isConnected}
                />
                <p className="text-text-muted text-xs mt-1">
                  Min: {solanaContractConfig.minInvestmentAmount} SOL | Max: {solanaContractConfig.maxInvestmentPerUser} SOL | Current SOL: ${solanaInvestment.currentSolPrice.toFixed(0)}
                </p>
              </div>

              {investAmount && parseFloat(investAmount) >= 0.001 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-bg-hover rounded-lg p-3 space-y-2 text-sm"
                >
                  <div className="flex justify-between">
                    <span className="text-text-muted">Investment Amount:</span>
                    <span className="text-text-primary">{investAmount} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Tokens to Receive:</span>
                    <span className="text-text-primary">
                      {solanaInvestment.calculateTokensForSol(parseFloat(investAmount)).toFixed(2)} ODX
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">To Project (50%):</span>
                    <span className="text-text-primary">{(parseFloat(investAmount) / 2).toFixed(4)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Time-locked (50%):</span>
                    <span className="text-text-primary">{(parseFloat(investAmount) / 2).toFixed(4)} SOL</span>
                  </div>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  if (isDemoMode) {
                    setError("🎭 Demo mode is active. Please exit demo mode to make real investments.");
                    return;
                  }
                  
                  if (!investAmount || parseFloat(investAmount) < 0.001) return;
                  
                  try {
                    await solanaInvestment.invest(parseFloat(investAmount));
                    setInvestAmount(''); // Clear form on success
                  } catch (err: any) {
                    setError(err.message);
                  }
                }}
                disabled={!wallet.isConnected || !investAmount || parseFloat(investAmount) < 0.001 || solanaInvestment.isInvesting}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {solanaInvestment.isInvesting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <DollarSign size={16} />
                )}
                <span>
                  {solanaInvestment.isInvesting 
                    ? 'Investing...' 
                    : `Invest ${investAmount || '0'} SOL`
                  }
                </span>
              </motion.button>
            </div>
          </motion.div>
          )}

          {/* Info Section */}
          {!solanaInvestment.hasChecked ? (
            <SkeletonStats />
          ) : (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <div className="card">
              <h4 className="text-lg font-semibold text-text-primary mb-3">Escrow Statistics</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-text-muted">Available Tokens:</span>
                  <span className="text-text-primary">
                    {isDemoMode 
                      ? getDemoData().escrowData?.totalTokensAvailable || 1000
                      : solanaInvestment.escrowData?.totalTokensAvailable || 1000
                    } ODX
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Tokens Sold:</span>
                  <span className="text-text-primary">
                    {isDemoMode 
                      ? getDemoData().escrowData?.tokensSold || 0
                      : solanaInvestment.escrowData?.tokensSold || 0
                    } ODX
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Total SOL Deposited:</span>
                  <span className="text-text-primary">
                    {isDemoMode 
                      ? getDemoData().escrowData?.totalSolDeposited?.toFixed(6) || '0.000000'
                      : solanaTransparencyStats?.totalDeposited?.toFixed(6) || '0.000000'
                    } SOL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Currently Locked:</span>
                  <span className="text-warning">
                    {isDemoMode 
                      ? ((getDemoData().escrowData?.totalSolDeposited || 0) - (getDemoData().escrowData?.totalSolWithdrawn || 0)).toFixed(6)
                      : solanaTransparencyStats?.totalLocked?.toFixed(6) || '0.000000'
                    } SOL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Released to Project:</span>
                  <span className="text-accent-green">
                    {isDemoMode 
                      ? (getDemoData().escrowData?.totalSolWithdrawn || 0).toFixed(6)
                      : solanaTransparencyStats?.totalUnlocked?.toFixed(6) || '0.000000'
                    } SOL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Token Price:</span>
                  <span className="text-text-primary">$0.10 USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Lock Ends:</span>
                  <span className="text-text-primary">
                    {isDemoMode 
                      ? (getDemoData().escrowData?.initializationTimestamp 
                          ? (getDemoData().escrowData?.lockDuration ? 
                              new Date((getDemoData().escrowData.initializationTimestamp + getDemoData().escrowData.lockDuration) * 1000).toLocaleDateString() + ' ' + new Date((getDemoData().escrowData.initializationTimestamp + getDemoData().escrowData.lockDuration) * 1000).toLocaleTimeString()
                              : 'N/A')
                          : 'N/A')
                      : (solanaInvestment.escrowData?.initializationTimestamp 
                          ? (solanaInvestment.escrowData?.lockDuration ? 
                              new Date((solanaInvestment.escrowData.initializationTimestamp + solanaInvestment.escrowData.lockDuration) * 1000).toLocaleDateString() + ' ' + new Date((solanaInvestment.escrowData.initializationTimestamp + solanaInvestment.escrowData.lockDuration) * 1000).toLocaleTimeString()
                              : 'N/A')
                          : 'Loading...')
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <h4 className="text-lg font-semibold text-text-primary mb-3">Contract Links</h4>
              <div className="space-y-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.open(`https://explorer.solana.com/address/${CONTRACTS.solana.programId}?cluster=devnet`, '_blank')}
                  className="w-full text-left p-2 bg-bg-hover border border-border-dark rounded-lg hover:border-accent-green/50 transition-all duration-200 flex items-center justify-between"
                >
                  <span className="text-text-primary text-sm">View Program</span>
                  <ExternalLink size={16} className="text-text-muted" />
                </motion.button>
                
                {CONTRACTS.solana.globalEscrow && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.open(`https://explorer.solana.com/address/${CONTRACTS.solana.globalEscrow}?cluster=devnet`, '_blank')}
                    className="w-full text-left p-2 bg-bg-hover border border-border-dark rounded-lg hover:border-accent-green/50 transition-all duration-200 flex items-center justify-between"
                  >
                    <span className="text-text-primary text-sm">View Escrow</span>
                    <ExternalLink size={16} className="text-text-muted" />
                  </motion.button>
                )}
                
                {CONTRACTS.solana.tokenMint && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.open(`https://explorer.solana.com/address/${CONTRACTS.solana.tokenMint}?cluster=devnet`, '_blank')}
                    className="w-full text-left p-2 bg-bg-hover border border-border-dark rounded-lg hover:border-accent-green/50 transition-all duration-200 flex items-center justify-between"
                  >
                    <span className="text-text-primary text-sm">View Token</span>
                    <ExternalLink size={16} className="text-text-muted" />
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
          )}
        </div>


        {/* Message when no investment found */}
        {wallet.isConnected && solanaInvestment.hasChecked && !solanaInvestment.investorData?.isInitialized && !isDemoMode && (
          <div className="card mt-6">
            <div className="text-center py-6">
              <TrendingUp className="text-text-muted mx-auto mb-4" size={48} />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Investment Found</h3>
              <p className="text-text-muted">
                This wallet hasn't made any investments yet. Make your first investment to see your statistics here.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Wallet: {wallet.address}
              </p>
            </div>
          </div>
        )}

        {/* Solana Investment Stats */}
        {(solanaInvestment.investorData?.isInitialized || isDemoMode) && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {!solanaInvestment.hasChecked ? (
              <>
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
              </>
            ) : (
              <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-sm">Total Invested</p>
                  <p className="text-xl font-semibold text-text-primary">
                    {isDemoMode 
                      ? (getDemoData().investorData.solDeposited / 1e9).toFixed(4)
                      : (solanaInvestment.investorData.solDeposited / 1e9).toFixed(4)
                    } SOL
                  </p>
                </div>
                <DollarSign className="text-accent-green" size={24} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-sm">Tokens Received</p>
                  <p className="text-xl font-semibold text-text-primary">
                    {isDemoMode 
                      ? (getDemoData().investorData.tokensReceived / 1e9).toFixed(2)
                      : (solanaInvestment.investorData.tokensReceived / 1e9).toFixed(2)
                    } ODX
                  </p>
                </div>
                <TrendingUp className="text-accent-green" size={24} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-sm">Locked Amount</p>
                  <p className="text-xl font-semibold text-text-primary">
                    {isDemoMode 
                      ? (getDemoData().investorData.lockedSolAmount / 1e9).toFixed(4)
                      : (solanaInvestment.investorData.lockedSolAmount / 1e9).toFixed(4)
                    } SOL
                  </p>
                </div>
                <Lock className="text-warning" size={24} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-sm">Unlock Status</p>
                  <p className={`text-xl font-semibold ${
                    (isDemoMode ? getDemoData().investorData.isUnlocked : solanaInvestment.investorData.isUnlocked) ? 'text-success' : 'text-warning'
                  }`}>
                    {(isDemoMode ? getDemoData().investorData.isUnlocked : solanaInvestment.investorData.isUnlocked) ? 'Unlocked' : 'Locked'}
                  </p>
                </div>
                {(isDemoMode ? getDemoData().investorData.isUnlocked : solanaInvestment.investorData.isUnlocked) ? (
                  <CheckCircle className="text-success" size={24} />
                ) : (
                  <Clock className="text-warning" size={24} />
                )}
              </div>
            </motion.div>
              </>
            )}
          </div>
        )}

        {/* Solana Investment Statistics */}
        {(solanaInvestment.investorData?.isInitialized || isDemoMode) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card mt-6"
          >
            <h3 className="text-xl font-semibold text-text-primary mb-4">Your Investment Statistics</h3>
            
            <div className="space-y-4">
              {/* Investment Flow Breakdown */}
              <div className="bg-bg-hover rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Total Sent by You:</span>
                  <span className="text-text-primary font-semibold">
                    {isDemoMode 
                      ? (getDemoData().investorData.solDeposited / 1e9).toFixed(4)
                      : (solanaInvestment.investorData.solDeposited / 1e9).toFixed(4)
                    } SOL
                  </span>
                </div>
                
                <div className="border-l-2 border-accent-green pl-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted text-sm">→ To Project (50%):</span>
                    <span className="text-accent-green font-medium">
                      {isDemoMode 
                        ? (getDemoData().investorData.solDeposited / 1e9 / 2).toFixed(4)
                        : (solanaInvestment.investorData.solDeposited / 1e9 / 2).toFixed(4)
                      } SOL
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted text-sm">→ Time-locked (50%):</span>
                    <span className="text-warning font-medium">
                      {isDemoMode 
                        ? (getDemoData().investorData.solDeposited / 1e9 / 2).toFixed(4)
                        : (solanaInvestment.investorData.solDeposited / 1e9 / 2).toFixed(4)
                      } SOL
                    </span>
                  </div>
                </div>
              </div>

              {/* Tokens Received */}
              <div className="bg-bg-hover rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Tokens Received:</span>
                  <span className="text-text-primary font-semibold">
                    {isDemoMode 
                      ? (getDemoData().investorData.tokensReceived / 1e9).toFixed(2)
                      : (solanaInvestment.investorData.tokensReceived / 1e9).toFixed(2)
                    } ODX
                  </span>
                </div>
                <div className="text-text-muted text-xs mt-1">
                  At $0.10 USD fixed price
                </div>
              </div>

              {/* Lock Status */}
              <div className="bg-bg-hover rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-muted">Currently Locked:</span>
                  <span className="text-warning font-semibold">
                    {isDemoMode 
                      ? (getDemoData().investorData.lockedSolAmount / 1e9).toFixed(4)
                      : (solanaInvestment.investorData.lockedSolAmount / 1e9).toFixed(4)
                    } SOL
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-muted">Already Released:</span>
                  <span className="text-success font-semibold">
                    {isDemoMode 
                      ? ((getDemoData().investorData.solDeposited / 1e9) - (getDemoData().investorData.lockedSolAmount / 1e9)).toFixed(4)
                      : ((solanaInvestment.investorData.solDeposited / 1e9) - (solanaInvestment.investorData.lockedSolAmount / 1e9)).toFixed(4)
                    } SOL
                  </span>
                </div>
                <div className="flex items-center space-x-2 mt-3">
                  {(isDemoMode ? getDemoData().investorData.isUnlocked : solanaInvestment.investorData.isUnlocked) ? (
                    <>
                      <CheckCircle className="text-success" size={16} />
                      <span className="text-success text-sm">Funds unlocked - awaiting project withdrawal</span>
                    </>
                  ) : (
                    <>
                      <Clock className="text-warning" size={16} />
                      <span className="text-warning text-sm">
                        {isDemoMode 
                          ? (getDemoData().escrowData?.lockDuration ? 
                              'Locked until ' + new Date((getDemoData().escrowData.initializationTimestamp + getDemoData().escrowData.lockDuration) * 1000).toLocaleDateString() + ' ' + new Date((getDemoData().escrowData.initializationTimestamp + getDemoData().escrowData.lockDuration) * 1000).toLocaleTimeString()
                              : 'N/A')
                          : (solanaInvestment.escrowData?.lockDuration ? 
                              'Locked until ' + new Date((solanaInvestment.escrowData.initializationTimestamp + solanaInvestment.escrowData.lockDuration) * 1000).toLocaleDateString() + ' ' + new Date((solanaInvestment.escrowData.initializationTimestamp + solanaInvestment.escrowData.lockDuration) * 1000).toLocaleTimeString()
                              : 'N/A')
                        }
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Investment Date */}
              <div className="bg-bg-hover rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Investment Date:</span>
                  <span className="text-text-primary">
                    {isDemoMode 
                      ? new Date(getDemoData().investorData.depositTimestamp * 1000).toLocaleDateString() + ' ' + new Date(getDemoData().investorData.depositTimestamp * 1000).toLocaleTimeString()
                      : new Date(solanaInvestment.investorData.depositTimestamp * 1000).toLocaleDateString() + ' ' + new Date(solanaInvestment.investorData.depositTimestamp * 1000).toLocaleTimeString()
                    }
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Investor Addresses Section */}
        {wallet.isConnected && solanaInvestment.investorAddresses && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card mt-6"
          >
            <h3 className="text-xl font-semibold text-text-primary mb-4">Your Investment Addresses</h3>
            <p className="text-text-muted text-sm mb-4">
              These are the blockchain addresses where your investment data and funds are stored. 
              You can verify them on Solscan or other Solana explorers.
            </p>
            
            <div className="space-y-4">
              {/* Investor PDA */}
              <div className="bg-bg-hover rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-muted text-sm font-medium">Investment Data Account (PDA)</span>
                  <div className="flex items-center space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => window.open(`https://solscan.io/account/${solanaInvestment.investorAddresses?.investorPDA}?cluster=devnet`, '_blank')}
                      className="text-accent-green hover:text-accent-green/80 text-xs flex items-center space-x-1"
                    >
                      <span>Solscan</span>
                      <ExternalLink size={10} />
                    </motion.button>
                    <span className="text-text-muted">|</span>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => window.open(`https://solana.fm/address/${solanaInvestment.investorAddresses?.investorPDA}?cluster=devnet-solana`, '_blank')}
                      className="text-accent-green hover:text-accent-green/80 text-xs flex items-center space-x-1"
                    >
                      <span>SolanaFM</span>
                      <ExternalLink size={10} />
                    </motion.button>
                  </div>
                </div>
                <p className="font-mono text-xs text-text-primary break-all bg-bg-secondary p-2 rounded">
                  {solanaInvestment.investorAddresses.investorPDA}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Contains your investment history, token balance, and lock status
                </p>
              </div>

              {/* SOL Vault PDA */}
              <div className="bg-bg-hover rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-muted text-sm font-medium">Locked SOL Vault (PDA)</span>
                  <div className="flex items-center space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => window.open(`https://solscan.io/account/${solanaInvestment.investorAddresses?.solVaultPDA}?cluster=devnet`, '_blank')}
                      className="text-accent-green hover:text-accent-green/80 text-xs flex items-center space-x-1"
                    >
                      <span>Solscan</span>
                      <ExternalLink size={10} />
                    </motion.button>
                    <span className="text-text-muted">|</span>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => window.open(`https://solana.fm/address/${solanaInvestment.investorAddresses?.solVaultPDA}?cluster=devnet-solana`, '_blank')}
                      className="text-accent-green hover:text-accent-green/80 text-xs flex items-center space-x-1"
                    >
                      <span>SolanaFM</span>
                      <ExternalLink size={10} />
                    </motion.button>
                  </div>
                </div>
                <p className="font-mono text-xs text-text-primary break-all bg-bg-secondary p-2 rounded">
                  {solanaInvestment.investorAddresses.solVaultPDA}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Holds your time-locked SOL (50% of investment) until unlock time
                </p>
              </div>

              {/* Token Account */}
              {solanaInvestment.investorAddresses.tokenAccount && (
                <div className="bg-bg-hover rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-text-muted text-sm font-medium">ODX Token Account (ATA)</span>
                    <div className="flex items-center space-x-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.open(`https://solscan.io/account/${solanaInvestment.investorAddresses?.tokenAccount}?cluster=devnet`, '_blank')}
                        className="text-accent-green hover:text-accent-green/80 text-xs flex items-center space-x-1"
                      >
                        <span>Solscan</span>
                        <ExternalLink size={10} />
                      </motion.button>
                      <span className="text-text-muted">|</span>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.open(`https://solana.fm/address/${solanaInvestment.investorAddresses?.tokenAccount}?cluster=devnet-solana`, '_blank')}
                        className="text-accent-green hover:text-accent-green/80 text-xs flex items-center space-x-1"
                      >
                        <span>SolanaFM</span>
                        <ExternalLink size={10} />
                      </motion.button>
                    </div>
                  </div>
                  <p className="font-mono text-xs text-text-primary break-all bg-bg-secondary p-2 rounded">
                    {solanaInvestment.investorAddresses.tokenAccount}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Your ODX token balance (received immediately upon investment)
                  </p>
                </div>
              )}

              {/* Help text */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-300 text-xs">
                  💡 <strong>Pro tip:</strong> These addresses are derived deterministically from your wallet address. 
                  You can always reconstruct them and verify your funds independently.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Network Switch Modal */}
        <NetworkSwitchModal
          isOpen={showNetworkSwitchModal}
          onClose={cancelNetworkSwitch}
          onConfirm={confirmNetworkSwitch}
          currentChain={wallet.chain}
          targetChain={targetNetwork}
        />
        </div>
      </div>
    );
  }

  // BNB Chain (default case)
  return (
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 space-y-6">

      {/* Demo Mode Toggle */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-purple-300">🎭</div>
            <div>
              <h3 className="text-purple-300 font-medium">Demo Mode</h3>
              <p className="text-purple-400 text-sm">
                {isDemoMode 
                  ? "Viewing interface with demo investor data" 
                  : "Toggle to preview investor interface with sample data"
                }
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDemoMode(!isDemoMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
              isDemoMode ? 'bg-purple-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isDemoMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </motion.div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`px-4 py-3 rounded-lg flex items-center justify-between ${
              error?.includes('🎭') 
                ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
                : 'bg-error/20 border border-error/30 text-error'
            }`}
            style={getMotionStyles()}
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className={`hover:opacity-70 ${
              error?.includes('🎭') ? 'text-purple-300' : 'text-error'
            }`}>
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BNB Network Info */}
      {!hasCheckedData ? (
        <SkeletonNetworkInfo />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <BnbIcon size={36} />
            <h3 className="text-lg sm:text-xl font-semibold text-text-primary">BNB Chain Escrow Active</h3>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleNetworkSwitch('solana')}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center space-x-1 w-full sm:w-auto"
          >
            <SolanaIcon size={24} />
            <span>Switch to Solana</span>
          </motion.button>
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-muted mb-1">Escrow Contract:</p>
            <p className="text-text-primary font-mono text-xs break-all">
              {CONTRACTS.bnb.escrow}
            </p>
          </div>
          <div>
            <p className="text-text-muted mb-1">Token Supply:</p>
            <p className="text-text-primary">
              {escrowStatus?.totalTokensAvailable 
                ? parseFloat(escrowStatus.totalTokensAvailable).toFixed(0) 
                : (wallet.chain === 'solana' 
                  ? solanaContractConfig.totalTokensAvailable.toLocaleString() 
                  : parseFloat(bnbContractConfig.totalTokensAvailable).toLocaleString())} ODX (18 decimals)
            </p>
          </div>
          <div>
            <p className="text-text-muted mb-1">Token Price:</p>
            <p className="text-text-primary">$0.10 USD</p>
          </div>
          <div>
            <p className="text-text-muted mb-1">Lock Ends:</p>
            <p className="text-text-primary">
              {isDemoMode 
                ? 'N/A'
                : (transparencyStats?.nextUnlockTime 
                    ? new Date(transparencyStats.nextUnlockTime * 1000).toLocaleDateString()
                    : 'Loading...')
              }
            </p>
          </div>
        </div>
      </motion.div>
      )}

      {/* BNB Investment Interface */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Invest Section */}
        {!hasCheckedData ? (
          <SkeletonInvestmentForm />
        ) : (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={getTransition(0.1)}
            className="card"
            style={getMotionStyles()}
          >
          <h3 className="text-xl font-semibold text-text-primary mb-4">Make Investment</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-text-muted text-sm mb-2">
                Investment Amount (BNB)
              </label>
              <input
                type="number"
                value={investAmount}
                onChange={(e) => setInvestAmount(e.target.value)}
                placeholder="0.001"
                min={bnbContractConfig.minInvestmentAmount}
                max={bnbContractConfig.maxInvestmentPerUser}
                step="0.001"
                className="input"
                disabled={isInvesting}
              />
              <p className="text-text-muted text-xs mt-1">
                Min: {bnbContractConfig.minInvestmentAmount} BNB | Max: {parseFloat(bnbContractConfig.maxInvestmentPerUser).toLocaleString()} BNB | Current BNB: ${currentBnbPrice.toFixed(0)}
              </p>
            </div>

            {investAmount && parseFloat(investAmount) >= 0.001 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="bg-bg-hover rounded-lg p-3 space-y-2 text-sm"
                style={{ willChange: 'height, opacity', overflow: 'hidden' }}
              >
                <div className="flex justify-between">
                  <span className="text-text-muted">Investment Amount:</span>
                  <span className="text-text-primary">{investAmount} BNB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Tokens (Est.):</span>
                  <span className="text-text-primary">
                    {calculateTokensForBnb(parseFloat(investAmount), currentBnbPrice).toFixed(2)} ODX
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">To Project:</span>
                  <span className="text-accent-green">{(parseFloat(investAmount) / 2).toFixed(4)} BNB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Time-locked:</span>
                  <span className="text-warning">{(parseFloat(investAmount) / 2).toFixed(4)} BNB</span>
                </div>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleInvest}
              disabled={isInvesting || !investAmount || parseFloat(investAmount) < 0.001}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isInvesting ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Wallet size={16} />
              )}
              <span>
                {isInvesting 
                  ? 'Investing...' 
                  : `Invest ${investAmount || '0'} BNB`
                }
              </span>
            </motion.button>
          </div>
        </motion.div>
        )}

        {/* Info Section */}
        {!hasCheckedData ? (
          <SkeletonStats />
        ) : (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={getTransition(0.2)}
            className="space-y-4"
          >
          <div className="card">
            <h4 className="text-lg font-semibold text-text-primary mb-3">Escrow Statistics</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-text-muted">Available Tokens:</span>
                <span className="text-text-primary">
                  {isDemoMode 
                    ? parseFloat(getDemoData().escrowStatus?.totalTokensAvailable || 
                      (wallet.chain === 'solana' ? solanaContractConfig.totalTokensAvailable.toString() : bnbContractConfig.totalTokensAvailable)).toFixed(0)
                    : (escrowStatus?.totalTokensAvailable 
                      ? parseFloat(escrowStatus.totalTokensAvailable).toFixed(0) 
                      : (wallet.chain === 'solana' ? solanaContractConfig.totalTokensAvailable : parseFloat(bnbContractConfig.totalTokensAvailable)))
                  } ODX
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Tokens Sold:</span>
                <span className="text-text-primary">
                  {isDemoMode 
                    ? parseFloat(getDemoData().escrowStatus?.tokensSold || "0").toFixed(0)
                    : (escrowStatus?.tokensSold ? parseFloat(escrowStatus.tokensSold).toFixed(2) : 0)
                  } ODX
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Total BNB Deposited:</span>
                <span className="text-text-primary">
                  {isDemoMode 
                    ? parseFloat(getDemoData().escrowStatus?.totalBnbDeposited || "0").toFixed(4)
                    : (escrowStatus?.totalBnbDeposited ? parseFloat(escrowStatus.totalBnbDeposited).toFixed(4) : 0)
                  } BNB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Token Price:</span>
                <span className="text-text-primary">$0.10 USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Lock Ends:</span>
                <span className="text-text-primary">
                  {isDemoMode 
                    ? 'N/A'
                    : (transparencyStats?.nextUnlockTime 
                        ? new Date(transparencyStats.nextUnlockTime * 1000).toLocaleDateString() + ' ' + new Date(transparencyStats.nextUnlockTime * 1000).toLocaleTimeString()
                        : 'Loading...')
                  }
                </span>
              </div>
              
              {/* NEW: Transparency stats */}
              {(transparencyStats || isDemoMode) && (
                <>
                  <div className="border-t border-border-dark my-3"></div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Total Deposited:</span>
                    <span className="text-text-primary">
                      {isDemoMode 
                        ? parseFloat(getDemoData().transparencyStats?.totalDeposited || "0").toFixed(6)
                        : parseFloat(transparencyStats.totalDeposited).toFixed(6)
                      } BNB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Currently Locked:</span>
                    <span className="text-warning">
                      {isDemoMode 
                        ? parseFloat(getDemoData().transparencyStats?.totalLocked || "0").toFixed(6)
                        : parseFloat(transparencyStats.totalLocked).toFixed(6)
                      } BNB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Released to Project:</span>
                    <span className="text-accent-green">
                      {isDemoMode 
                        ? parseFloat(getDemoData().transparencyStats?.totalUnlocked || "0").toFixed(6)
                        : parseFloat(transparencyStats.totalUnlocked).toFixed(6)
                      } BNB
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h4 className="text-lg font-semibold text-text-primary mb-3">Contract Links</h4>
            <div className="space-y-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.open(`${NETWORKS.bnb.blockExplorer}/address/${CONTRACTS.bnb.escrow}`, '_blank')}
                className="w-full text-left p-2 bg-bg-hover border border-border-dark rounded-lg hover:border-accent-green/50 transition-all duration-200 flex items-center justify-between"
              >
                <span className="text-text-primary text-sm">View Escrow Contract</span>
                <ExternalLink size={16} className="text-text-muted" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.open(`${NETWORKS.bnb.blockExplorer}/address/${CONTRACTS.bnb.token}`, '_blank')}
                className="w-full text-left p-2 bg-bg-hover border border-border-dark rounded-lg hover:border-accent-green/50 transition-all duration-200 flex items-center justify-between"
              >
                <span className="text-text-primary text-sm">View ODX Token</span>
                <ExternalLink size={16} className="text-text-muted" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.open(`${NETWORKS.bnb.blockExplorer}/address/${CONTRACTS.bnb.priceFeed}`, '_blank')}
                className="w-full text-left p-2 bg-bg-hover border border-border-dark rounded-lg hover:border-accent-green/50 transition-all duration-200 flex items-center justify-between"
              >
                <span className="text-text-primary text-sm">View Price Feed</span>
                <ExternalLink size={16} className="text-text-muted" />
              </motion.button>
            </div>
          </div>
        </motion.div>
        )}
      </div>


      {/* Message when no investment found */}
      {wallet.isConnected && wallet.chain === 'bnb' && hasCheckedData && !investorData?.isInitialized && !isDemoMode && (
        <div className="card mt-6">
          <div className="text-center py-6">
            <TrendingUp className="text-text-muted mx-auto mb-4" size={48} />
            <h3 className="text-lg font-semibold text-text-primary mb-2">No Investment Found</h3>
            <p className="text-text-muted">
              This wallet hasn't made any investments yet. Make your first investment to see your statistics here.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Wallet: {wallet.address}
            </p>
          </div>
        </div>
      )}

      {/* BNB Investment Stats Cards */}
      {(investorData?.isInitialized || isDemoMode) && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-muted text-sm">Total Invested</p>
                <p className="text-xl font-semibold text-text-primary">
                  {isDemoMode 
                    ? getDemoData().investorData.bnbDeposited
                    : parseFloat(investorData.bnbDeposited).toFixed(4)
                  } BNB
                </p>
              </div>
              <DollarSign className="text-accent-green" size={24} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-muted text-sm">Tokens Received</p>
                <p className="text-xl font-semibold text-text-primary">
                  {isDemoMode 
                    ? getDemoData().investorData.tokensReceived
                    : parseFloat(investorData.tokensReceived).toFixed(2)
                  } ODX
                </p>
              </div>
              <TrendingUp className="text-accent-green" size={24} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-muted text-sm">Locked Amount</p>
                <p className="text-xl font-semibold text-text-primary">
                  {isDemoMode 
                    ? getDemoData().investorData.lockedBnbAmount
                    : parseFloat(investorData.lockedBnbAmount).toFixed(4)
                  } BNB
                </p>
              </div>
              <Lock className="text-warning" size={24} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-muted text-sm">Unlock Status</p>
                <p className={`text-xl font-semibold ${
                  (isDemoMode ? getDemoData().investorData.isUnlocked : investorData.isUnlocked) ? 'text-success' : 'text-warning'
                }`}>
                  {(isDemoMode ? getDemoData().investorData.isUnlocked : investorData.isUnlocked) ? 'Unlocked' : 'Locked'}
                </p>
              </div>
              {(isDemoMode ? getDemoData().investorData.isUnlocked : investorData.isUnlocked) ? (
                <CheckCircle className="text-success" size={24} />
              ) : (
                <Clock className="text-warning" size={24} />
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* BNB Investment Statistics */}
      {(investorData?.isInitialized || isDemoMode) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mt-6"
        >
          <h3 className="text-xl font-semibold text-text-primary mb-4">Your Investment Statistics</h3>
          
          <div className="space-y-4">
            {/* Investment Flow Breakdown */}
            <div className="bg-bg-hover rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Total Sent by You:</span>
                <span className="text-text-primary font-semibold">
                  {isDemoMode 
                    ? getDemoData().investorData.bnbDeposited
                    : parseFloat(investorData.bnbDeposited).toFixed(4)
                  } BNB
                </span>
              </div>
              
              <div className="border-l-2 border-accent-green pl-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-sm">→ To Project (50%):</span>
                  <span className="text-accent-green font-medium">
                    {isDemoMode 
                      ? (parseFloat(getDemoData().investorData.bnbDeposited) / 2).toFixed(4)
                      : (parseFloat(investorData.bnbDeposited) / 2).toFixed(4)
                    } BNB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-sm">→ Time-locked (50%):</span>
                  <span className="text-warning font-medium">
                    {isDemoMode 
                      ? (parseFloat(getDemoData().investorData.bnbDeposited) / 2).toFixed(4)
                      : (parseFloat(investorData.bnbDeposited) / 2).toFixed(4)
                    } BNB
                  </span>
                </div>
              </div>
            </div>

            {/* Tokens Received */}
            <div className="bg-bg-hover rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Tokens Received:</span>
                <span className="text-text-primary font-semibold">
                  {isDemoMode 
                    ? getDemoData().investorData.tokensReceived
                    : parseFloat(investorData.tokensReceived).toFixed(2)
                  } ODX
                </span>
              </div>
              <div className="text-text-muted text-xs mt-1">
                At $0.10 USD fixed price
              </div>
            </div>

            {/* Lock Status */}
            <div className="bg-bg-hover rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-muted">Currently Locked:</span>
                <span className="text-warning font-semibold">
                  {isDemoMode 
                    ? getDemoData().investorData.lockedBnbAmount
                    : parseFloat(investorData.lockedBnbAmount).toFixed(4)
                  } BNB
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-muted">Already Released:</span>
                <span className="text-success font-semibold">
                  {isDemoMode 
                    ? (parseFloat(getDemoData().investorData.bnbDeposited) - parseFloat(getDemoData().investorData.lockedBnbAmount)).toFixed(4)
                    : (parseFloat(investorData.bnbDeposited) - parseFloat(investorData.lockedBnbAmount)).toFixed(4)
                  } BNB
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-3">
                {(isDemoMode ? getDemoData().investorData.isUnlocked : investorData.isUnlocked) ? (
                  <>
                    <CheckCircle className="text-success" size={16} />
                    <span className="text-success text-sm">Funds unlocked - awaiting project withdrawal</span>
                  </>
                ) : (
                  <>
                    <Clock className="text-warning" size={16} />
                    <span className="text-warning text-sm">
                      Locked until {isDemoMode 
                        ? (getDemoData().transparencyStats?.nextUnlockTime 
                            ? new Date(getDemoData().transparencyStats.nextUnlockTime * 1000).toLocaleDateString() + ' ' + new Date(getDemoData().transparencyStats.nextUnlockTime * 1000).toLocaleTimeString()
                            : 'Loading...')
                        : (transparencyStats?.nextUnlockTime 
                            ? new Date(transparencyStats.nextUnlockTime * 1000).toLocaleDateString() + ' ' + new Date(transparencyStats.nextUnlockTime * 1000).toLocaleTimeString()
                            : 'Loading...')
                      }
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Investment Date */}
            <div className="bg-bg-hover rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Investment Date:</span>
                <span className="text-text-primary">
                  {isDemoMode 
                    ? new Date(getDemoData().investorData.depositTimestamp * 1000).toLocaleDateString() + ' ' + new Date(getDemoData().investorData.depositTimestamp * 1000).toLocaleTimeString()
                    : new Date(investorData.depositTimestamp * 1000).toLocaleDateString() + ' ' + new Date(investorData.depositTimestamp * 1000).toLocaleTimeString()
                  }
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* BNB Investment Addresses Section */}
      {wallet.isConnected && wallet.chain === 'bnb' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={getTransition(0.2)}
          className="card"
          style={getMotionStyles()}
        >
          <h3 className="text-xl font-semibold text-text-primary mb-4">Your Investment Addresses</h3>
          <div className="space-y-4">
            {/* Escrow Contract (where your locked BNB is stored) */}
            <div className="bg-bg-hover rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-muted text-sm font-medium">Locked BNB Vault (Contract)</span>
                <div className="flex items-center space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.open(`${NETWORKS.bnb.blockExplorer}/address/${CONTRACTS.bnb.escrow}`, '_blank')}
                    className="text-accent-green hover:text-accent-green/80 text-xs flex items-center space-x-1"
                  >
                    <span>BSCScan</span>
                    <ExternalLink size={10} />
                  </motion.button>
                </div>
              </div>
              <p className="font-mono text-xs text-text-primary break-all bg-bg-secondary p-2 rounded">
                {CONTRACTS.bnb.escrow}
              </p>
              <p className="text-xs text-text-muted mt-1">
                Holds your time-locked BNB (50% of investment) until unlock time
              </p>
            </div>

            {/* Your Wallet Address */}
            <div className="bg-bg-hover rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-muted text-sm font-medium">ODX Token Account (Wallet)</span>
                <div className="flex items-center space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.open(`${NETWORKS.bnb.blockExplorer}/address/${wallet.address}`, '_blank')}
                    className="text-accent-green hover:text-accent-green/80 text-xs flex items-center space-x-1"
                  >
                    <span>BSCScan</span>
                    <ExternalLink size={10} />
                  </motion.button>
                </div>
              </div>
              <p className="font-mono text-xs text-text-primary break-all bg-bg-secondary p-2 rounded">
                {wallet.address}
              </p>
              <p className="text-xs text-text-muted mt-1">
                Your ODX token balance (received immediately upon investment)
              </p>
            </div>

            {/* Help text */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-300 text-xs">
                💡 <strong>Pro tip:</strong> These addresses show where your investment is stored. 
                You can always verify your locked BNB and token balance independently on BSCScan.
              </p>
            </div>
          </div>
        </motion.div>
      )}


      {/* Message when no investment found */}
      {wallet.isConnected && wallet.chain === 'bnb' && hasCheckedData && !investorData?.isInitialized && !isDemoMode && (
        <div className="card mt-6">
          <div className="text-center py-6">
            <TrendingUp className="text-text-muted mx-auto mb-4" size={48} />
            <h3 className="text-lg font-semibold text-text-primary mb-2">No Investment Found</h3>
            <p className="text-text-muted">
              This wallet hasn't made any investments yet. Make your first investment to see your statistics here.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Wallet: {wallet.address}
            </p>
          </div>
        </div>
      )}


      {/* Network Switch Modal */}
      <NetworkSwitchModal
        isOpen={showNetworkSwitchModal}
        onClose={cancelNetworkSwitch}
        onConfirm={confirmNetworkSwitch}
        currentChain={wallet.chain}
        targetChain={targetNetwork}
      />
    </div>
  );
};