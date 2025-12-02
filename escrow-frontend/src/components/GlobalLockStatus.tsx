import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, Timer, TrendingUp, DollarSign } from 'lucide-react';
import { ethers } from 'ethers';
import { CONTRACTS, ESCROW_ABI } from '../config/contracts';
import { getEscrowStatus as getSolanaEscrowStatus, getSolanaTransparencyData, getSolanaNextUnlockTime } from '../utils/solana';
import { useWallet } from '../contexts/WalletContext';

interface GlobalLockData {
  totalDeposited: string;
  totalUnlocked: string;
  totalLocked: string;
  nextUnlockTime: number;
  progress: number;
  timeUntilNextUnlock: number;
  lockDuration: number;
  network: 'bnb' | 'solana';
  currency: string;
  initializationTimestamp: number;
  isFullyUnlocked: boolean;
}

export const GlobalLockStatus: React.FC = () => {
  const wallet = useWallet();
  const [lockData, setLockData] = useState<GlobalLockData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const fetchGlobalLockStatus = async () => {
    try {
      if (wallet.chain === 'bnb') {
        await fetchBnbLockStatus();
      } else if (wallet.chain === 'solana') {
        await fetchSolanaLockStatus();
      }
    } catch (error) {
      console.error('Error fetching global lock status:', error);
      setLockData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBnbLockStatus = async () => {
    const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
    const contract = new ethers.Contract(CONTRACTS.bnb.escrow, ESCROW_ABI, provider);

    try {
      // Get contract data and initialization timestamp
      const [totalDeposited, totalUnlocked, totalLocked, escrowStatus, initializationTimestamp] = await Promise.all([
        contract.totalDeposited(),
        contract.totalUnlocked(), 
        contract.totalLocked(),
        contract.getEscrowStatus(),
        contract.getInitializationTimestamp()
      ]);
      
      const lockDuration = Number(escrowStatus[5]) || 14400;
      const currentTime = Math.floor(Date.now() / 1000);
      const initTimestamp = Number(initializationTimestamp);
      
      // Calculate timing based on initialization
      const unlockTime = initTimestamp + lockDuration;
      const hasUnlockTimePassed = currentTime >= unlockTime;
      const timeUntilNextUnlock = Math.max(0, unlockTime - currentTime);
      
      // Calculate progress
      let progress = 0;
      if (initTimestamp > 0) {
        const elapsed = currentTime - initTimestamp;
        progress = Math.min(100, Math.max(0, (elapsed / lockDuration) * 100));
      }
      
      const totalDepositedFormatted = ethers.formatEther(totalDeposited);
      const totalUnlockedFormatted = ethers.formatEther(totalUnlocked);
      const totalLockedFormatted = ethers.formatEther(totalLocked);
      
      console.log('🔍 BNB lock status - using contract totalUnlocked:', {
        currentTime,
        initTimestamp,
        unlockTime,
        hasUnlockTimePassed,
        totalDeposited: totalDepositedFormatted,
        totalLocked: totalLockedFormatted,
        totalUnlocked: totalUnlockedFormatted,
        timeRemaining: unlockTime - currentTime
      });

      setLockData({
        totalDeposited: totalDepositedFormatted,
        totalUnlocked: totalUnlockedFormatted,
        totalLocked: totalLockedFormatted,
        nextUnlockTime: unlockTime,
        progress,
        timeUntilNextUnlock,
        lockDuration,
        network: 'bnb',
        currency: 'BNB',
        initializationTimestamp: initTimestamp,
        isFullyUnlocked: hasUnlockTimePassed && parseFloat(totalLockedFormatted) <= 0
      });
    } catch (error) {
      console.error('Error fetching BNB lock status:', error);
      throw error;
    }
  };

  const fetchSolanaLockStatus = async () => {
    console.log('📊 Fetching Solana lock status from smart contract...');
    
    try {
      // Get all data from contract using unified approach
      const [transparencyData, escrowData, nextUnlockTime] = await Promise.all([
        getSolanaTransparencyData(),
        getSolanaEscrowStatus(),
        getSolanaNextUnlockTime()
      ]);
      
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilNextUnlock = Math.max(0, nextUnlockTime - currentTime);
      const hasUnlockTimePassed = currentTime >= nextUnlockTime;
      
      // Calculate progress based on initialization timestamp
      let progress = 0;
      if (escrowData.initializationTimestamp > 0 && escrowData.lockDuration > 0) {
        const elapsed = currentTime - escrowData.initializationTimestamp;
        progress = Math.min(100, Math.max(0, (elapsed / escrowData.lockDuration) * 100));
      }
      
      const totalDepositedFormatted = transparencyData.totalDeposited.toFixed(6);
      const totalUnlockedFormatted = transparencyData.totalUnlocked.toFixed(6);
      const totalLockedFormatted = transparencyData.totalLocked.toFixed(6);
      
      console.log('📊 Solana lock status - using contract totalUnlocked:', {
        totalDeposited: totalDepositedFormatted,
        totalUnlocked: totalUnlockedFormatted,
        totalLocked: totalLockedFormatted,
        initializationTimestamp: escrowData.initializationTimestamp,
        nextUnlockTime,
        hasUnlockTimePassed,
        progress: progress.toFixed(1),
        timeUntilNextUnlock
      });
      
      setLockData({
        totalDeposited: totalDepositedFormatted,
        totalUnlocked: totalUnlockedFormatted,
        totalLocked: totalLockedFormatted,
        nextUnlockTime,
        progress,
        timeUntilNextUnlock,
        lockDuration: escrowData.lockDuration,
        network: 'solana',
        currency: 'SOL',
        initializationTimestamp: escrowData.initializationTimestamp,
        isFullyUnlocked: hasUnlockTimePassed && transparencyData.totalLocked <= 0
      });
    } catch (error) {
      console.error('Error fetching Solana lock status:', error);
      throw error;
    }
  };

  // Real-time timer updates with progress recalculation
  useEffect(() => {
    if (!lockData) return;

    const updateTimer = () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const timeLeft = Math.max(0, lockData.nextUnlockTime - currentTime);
      
      if (timeLeft <= 0) {
        setTimeLeft('Unlocked');
        // Trigger refresh when unlock time is reached
        if (lockData.timeUntilNextUnlock > 0) {
          fetchGlobalLockStatus();
        }
        return;
      }

      const days = Math.floor(timeLeft / (24 * 60 * 60));
      const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
      const seconds = timeLeft % 60;

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockData]);

  // Load data once on mount and network change
  useEffect(() => {
    fetchGlobalLockStatus();
  }, [wallet.chain]);

  if (isLoading) {
    return (
      <div className="bg-bg-card rounded-xl border border-border-dark p-6 animate-pulse">
        <div className="h-6 bg-bg-hover rounded mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-bg-hover rounded-lg p-4">
              <div className="h-4 bg-bg-secondary rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-bg-secondary rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!lockData) return null;

  const formatBnb = (value: string) => {
    const num = parseFloat(value);
    return num.toFixed(6);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-card rounded-xl border border-border-dark p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-text-primary flex items-center">
          <Lock className="mr-3 text-accent-primary" size={24} />
          Global Lock Status
        </h3>
        <div className="text-sm text-text-muted">
          Live on {lockData.network === 'bnb' ? 'BSC Testnet' : 'Solana Devnet'}
        </div>
      </div>

      {/* Главная статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium">Total Deposited</p>
              <p className="text-2xl font-bold text-blue-200">
                {formatBnb(lockData.totalDeposited)} {lockData.currency}
              </p>
            </div>
            <DollarSign className="text-blue-400" size={24} />
          </div>
        </div>


        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium">Total in Lock</p>
              <p className="text-2xl font-bold text-purple-200">
                {formatBnb(lockData.totalLocked)} {lockData.currency}
              </p>
            </div>
            <Lock className="text-purple-400" size={24} />
          </div>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-sm font-medium">Available to Project</p>
              <p className="text-2xl font-bold text-green-200">
                {formatBnb(lockData.totalUnlocked)} {lockData.currency}
              </p>
            </div>
            <Unlock className="text-green-400" size={24} />
          </div>
        </div>
      </div>

      {/* Progress bar with initialization timestamp info */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-text-muted mb-2">
          <span>
            Lock Progress 
            {lockData.initializationTimestamp > 0 && (
              <span className="text-xs">
                (started {new Date(lockData.initializationTimestamp * 1000).toLocaleDateString()})
              </span>
            )}
          </span>
          <span>{lockData.progress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-bg-hover rounded-full h-4 overflow-hidden">
          <motion.div
            className={`h-4 rounded-full ${
              lockData.progress >= 100 
                ? 'bg-gradient-to-r from-green-500 to-green-400' 
                : 'bg-gradient-to-r from-orange-500 to-yellow-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, lockData.progress)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Timer to next unlock */}
      {lockData.timeUntilNextUnlock > 0 ? (
        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium flex items-center">
                <Timer className="mr-2" size={16} />
                Unlock Timer
              </p>
              <p className="text-xl font-mono text-purple-200">{timeLeft}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-purple-400">Unlocks at:</p>
              <p className="text-sm text-purple-300">
                {new Date(lockData.nextUnlockTime * 1000).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-900/40 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center">
            <Unlock className="mr-3 text-green-400" size={20} />
            <div>
              <p className="text-green-300 font-medium">
                {lockData.isFullyUnlocked ? 'All Funds Unlocked' : 'Unlock Time Reached'}
              </p>
              <p className="text-green-400 text-sm">
                {lockData.isFullyUnlocked ? 'Ready for withdrawal' : 'Waiting for contract update'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transparency info with initialization details */}
      <div className="mt-4 pt-4 border-t border-border-dark">
        <p className="text-xs text-text-muted text-center">
          🔍 All data read from smart contract on {lockData.network === 'bnb' ? 'BSC Testnet' : 'Solana Devnet'}.
          {lockData.initializationTimestamp > 0 && (
            <span className="block mt-1">
              ⏰ Timer started: {new Date(lockData.initializationTimestamp * 1000).toLocaleString()}
            </span>
          )}
          <span className="block mt-1">
            {lockData.network === 'bnb' && `Contract: ${CONTRACTS.bnb.escrow}`}
            {lockData.network === 'solana' && `Program: ${CONTRACTS.solana.programId}`}
          </span>
        </p>
      </div>
    </motion.div>
  );
};