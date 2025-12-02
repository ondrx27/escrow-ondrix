import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { SupportedChain } from '../types';
import { motion } from 'framer-motion';
import { NetworkSwitchModal } from './NetworkSwitchModal';
import { SolanaIcon, BnbIcon } from './NetworkIcons';

const CHAIN_CONFIG = {
  solana: {
    name: 'Solana',
    displayName: 'Solana',
    color: 'from-purple-500 to-pink-500',
    currency: 'SOL'
  },
  bnb: {
    name: 'BNB Chain',
    displayName: 'BSC',
    color: 'from-yellow-500 to-orange-500',
    currency: 'BNB'
  }
};

export const ChainSelector: React.FC = () => {
  const wallet = useWallet();
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [targetChain, setTargetChain] = useState<SupportedChain | null>(null);

  const handleChainSwitch = (chain: SupportedChain) => {
    if (chain === wallet.chain) return;
    
    // If wallet is connected, show confirmation modal
    if (wallet.isConnected) {
      setTargetChain(chain);
      setShowSwitchModal(true);
    } else {
      // If not connected, switch immediately
      wallet.switchChain(chain);
    }
  };

  const confirmNetworkSwitch = () => {
    if (targetChain) {
      wallet.switchChain(targetChain);
      setShowSwitchModal(false);
      setTargetChain(null);
    }
  };

  const cancelNetworkSwitch = () => {
    setShowSwitchModal(false);
    setTargetChain(null);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-text-muted text-sm mb-3 text-center">
        Select Network
      </div>
      
      <div className="bg-bg-card rounded-xl p-2 border border-border-dark">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CHAIN_CONFIG) as SupportedChain[]).map((chain) => {
            const config = CHAIN_CONFIG[chain];
            const isSelected = wallet.chain === chain;
            
            return (
              <motion.button
                key={chain}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChainSwitch(chain)}
                className={`
                  relative p-3 sm:p-4 rounded-lg transition-all duration-200 cursor-pointer
                  ${isSelected 
                    ? 'bg-gradient-green text-white shadow-lg shadow-accent-green/25' 
                    : 'bg-bg-dark hover:bg-bg-hover border border-border-dark hover:border-border-green/50'
                  }
                `}
              >
                <div className="flex flex-col items-center space-y-1.5 sm:space-y-2">
                  {/* Chain Icon */}
                  <div className={`
                    w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center
                    ${isSelected 
                      ? 'bg-white/20' 
                      : `bg-gradient-to-br ${config.color}`
                    }
                  `}>
                    {chain === 'solana' ? (
                      <SolanaIcon size={isSelected ? 48 : 40} className="sm:w-12 sm:h-12" />
                    ) : (
                      <BnbIcon size={isSelected ? 48 : 40} className="sm:w-12 sm:h-12" />
                    )}
                  </div>
                  
                  {/* Chain Name */}
                  <div className="text-center">
                    <div className={`text-sm sm:text-base font-semibold ${
                      isSelected ? 'text-white' : 'text-text-primary'
                    }`}>
                      {config.name}
                    </div>
                    <div className={`text-xs ${
                      isSelected ? 'text-white/70' : 'text-text-muted'
                    }`}>
                      {config.displayName}
                    </div>
                  </div>
                  
                  {/* Currency */}
                  <div className={`
                    text-xs px-2 py-1 rounded-full
                    ${isSelected 
                      ? 'bg-white/20 text-white' 
                      : 'bg-bg-hover text-text-muted'
                    }
                  `}>
                    {config.currency}
                  </div>
                </div>
                
                {/* Selection indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2"
                  >
                    <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-accent-green rounded-full" />
                    </div>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
      
      {wallet.isConnected && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-text-muted text-xs text-center mt-2"
        >
          Click to switch networks (wallets stay connected)
        </motion.p>
      )}
      

      {/* Network Switch Confirmation Modal */}
      <NetworkSwitchModal
        isOpen={showSwitchModal}
        onClose={cancelNetworkSwitch}
        onConfirm={confirmNetworkSwitch}
        currentChain={wallet.chain}
        targetChain={targetChain || wallet.chain}
      />
    </div>
  );
};