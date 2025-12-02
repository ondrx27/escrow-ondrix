import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { SupportedChain } from '../types';
import { SolanaIcon, BnbIcon } from './NetworkIcons';

interface NetworkSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentChain: SupportedChain;
  targetChain: SupportedChain;
}

const CHAIN_NAMES = {
  solana: 'Solana Devnet',
  bnb: 'BSC Testnet'
};

const CHAIN_ICONS = {
  solana: SolanaIcon,
  bnb: BnbIcon
};

export const NetworkSwitchModal: React.FC<NetworkSwitchModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentChain,
  targetChain,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-bg-card rounded-xl border border-border-dark max-w-md w-full p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-accent-green/20 rounded-lg">
                    <RefreshCw className="text-accent-green" size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    Switch to {CHAIN_NAMES[targetChain]}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
                >
                  <X size={20} className="text-text-muted" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                <p className="text-text-secondary">
                  You'll be switched to {CHAIN_NAMES[targetChain]}. Your wallets will remain connected, and you can continue investing on the new network.
                </p>

                {/* Network Transition */}
                <div className="bg-bg-hover rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    {/* From */}
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 flex items-center justify-center">
                        {React.createElement(CHAIN_ICONS[currentChain], { size: 32 })}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary">From</div>
                        <div className="text-xs text-text-muted">{CHAIN_NAMES[currentChain]}</div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="px-4">
                      <div className="text-text-muted">→</div>
                    </div>

                    {/* To */}
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 flex items-center justify-center">
                        {React.createElement(CHAIN_ICONS[targetChain], { size: 32 })}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary">To</div>
                        <div className="text-xs text-text-muted">{CHAIN_NAMES[targetChain]}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-300 text-sm">
                    💡 <strong>What happens next:</strong> You'll be switched to {CHAIN_NAMES[targetChain]} with your wallets still connected. You can immediately start investing on the new network.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-bg-hover border border-border-dark rounded-lg text-text-primary hover:bg-bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 px-4 py-2 bg-gradient-green text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Switch to {CHAIN_NAMES[targetChain]}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};