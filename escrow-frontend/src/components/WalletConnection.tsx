import React, { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { Wallet, ChevronDown, ExternalLink, Copy, Check, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';

// Reown/WalletConnect integration
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bscTestnet } from '@reown/appkit/networks';

// Solana wallet modal
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// Utility function to get required environment variable
function getRequiredEnvVar(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Initialize Reown AppKit
const projectId = getRequiredEnvVar('VITE_REOWN_PROJECT_ID');

const metadata = {
  name: 'Ondrix Escrow',
  description: 'Secure Investment Platform with Time-locked Protection',
  url: 'https://ondrix-escrow.com',
  icons: ['https://ondrix-escrow.com/icon.png']
};

let appKit: any = null;

// Safe BrowserProvider creation for BSC Testnet (without ENS)
const createSafeBscProvider = async (provider: any): Promise<ethers.BrowserProvider | null> => {
  try {
    // Create provider with explicit BSC Testnet configuration to avoid ENS issues
    const ethersProvider = new ethers.BrowserProvider(provider, {
      name: "BSC Testnet",
      chainId: 97
    });
    
    // Override any methods that might trigger ENS lookups
    ethersProvider.lookupAddress = async () => null;
    ethersProvider.resolveName = async () => null;
    
    console.log('✅ Created safe BSC provider with ENS disabled');
    return ethersProvider;
    
  } catch (error) {
    console.error('❌ Error creating safe BSC provider:', error);
    return null;
  }
};

// Initialize AppKit once
const initializeAppKit = () => {
  if (appKit) return appKit;

  try {
    appKit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [bscTestnet],
      metadata,
      projectId,
      features: {
        analytics: true,
        email: false,
        socials: false,
      },
      themeMode: 'dark',
      themeVariables: {
        '--w3m-color-mix': '#00ff88',
        '--w3m-color-mix-strength': 20,
        '--w3m-accent': '#00ff88',
        '--w3m-border-radius-master': '8px',
        '--w3m-font-family': 'Inter, system-ui, sans-serif'
      }
    });

    console.log('✅ AppKit initialized');
    return appKit;
  } catch (error) {
    console.error('❌ Failed to initialize AppKit:', error);
    return null;
  }
};

export const WalletConnection: React.FC = () => {
  const wallet = useWallet();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);

  // Initialize AppKit and set up event listeners
  useEffect(() => {
    const kit = initializeAppKit();
    if (!kit) return;

    // Check for existing connection on page load and restore it
    const checkExistingConnection = async () => {
      if (wallet.chain === 'bnb' && !wallet.isConnected) {
        try {
          // Try to get existing account from AppKit
          const account = kit.getAccount?.();
          if (account && account.address) {
            console.log('🔄 Found existing Reown connection, restoring...', account.address);
            const provider = kit.getWalletProvider?.();
            if (provider) {
              const ethersProvider = await createSafeBscProvider(provider);
              wallet.setReownConnection(account.address, ethersProvider);
            } else {
              wallet.setReownConnection(account.address, null);
            }
          }
        } catch (error) {
          // Silent fail - this is expected when no connection exists
          console.log('ℹ️ No existing Reown connection found (normal)');
        }
      }
    };

    // Check for connection after a brief delay to allow AppKit to initialize
    setTimeout(() => {
      checkExistingConnection();
      // Stop checking after 3 seconds if no connection is found
      setTimeout(() => setIsCheckingConnection(false), 2500);
    }, 500);

    // Global disconnect function
    (window as any).__reownDisconnect = async () => {
      try {
        await kit.disconnect();
      } catch (error) {
        console.warn('AppKit disconnect error:', error);
      }
    };

    // Event listeners for Reown state changes
    const handleStateChange = async (state: any) => {
      // Extract address and connection status from the AppKit state
      let address: string | undefined;
      let isConnected: boolean = false;
      
      // Try multiple extraction methods
      if (state?.address) {
        address = state.address;
        isConnected = state.isConnected !== undefined ? state.isConnected : !!state.address;
      } else if (state?.caipAddress) {
        // Handle CAIP format: "eip155:97:0x..."
        const parts = state.caipAddress.split(':');
        address = parts[2];
        isConnected = !!address;
      } else if (state?.selectedNetworkId && state?.caipAddress) {
        // Handle CAIP format with network: "eip155:97:0x..."
        address = state.caipAddress.split(':')[2];
        isConnected = !!address;
      } else if (typeof state === 'string' && state.startsWith('0x')) {
        // Direct address string
        address = state;
        isConnected = !!state;
      } else if (state?.account?.address) {
        // Nested account object
        address = state.account.address;
        isConnected = !!address;
      }
      
      if (isConnected && address && wallet.chain === 'bnb') {
        // Get provider from AppKit and create safe BSC provider
        const provider = kit.getWalletProvider();
        if (provider) {
          const ethersProvider = await createSafeBscProvider(provider);
          wallet.setReownConnection(address, ethersProvider);
          console.log('✅ Reown wallet connected:', address.slice(0, 6) + '...' + address.slice(-4));
          setIsCheckingConnection(false); // Stop showing checking state
        } else {
          // Set connection without provider if no provider available
          wallet.setReownConnection(address, null);
          setIsCheckingConnection(false);
        }
      } else if (!address) {
        wallet.setReownConnection(null, null);
        setIsCheckingConnection(false);
      }
    };

    // Subscribe to state changes (unified approach)
    let unsubscribe: (() => void) | undefined;
    let pollInterval: NodeJS.Timeout | undefined;
    
    try {
      // Try the newer subscribe method
      if (kit.subscribeState) {
        unsubscribe = kit.subscribeState(handleStateChange);
        console.log('✅ Subscribed to AppKit state changes');
      } else if (kit.subscribeAccount) {
        // Fallback to account subscription only
        unsubscribe = kit.subscribeAccount((address: string | undefined) => {
          handleStateChange({ address, isConnected: !!address });
        });
        console.log('✅ Subscribed to AppKit account changes');
      } else {
        console.warn('No subscription methods available in AppKit');
      }
    } catch (error) {
      console.warn('Error setting up AppKit subscriptions:', error);
    }

    // Fallback polling mechanism to ensure we catch state changes
    pollInterval = setInterval(() => {
      if (kit.getAccount && wallet.chain === 'bnb') {
        try {
          const account = kit.getAccount();
          if (account) {
            handleStateChange(account);
          }
        } catch (error) {
          // Polling error is expected when not connected, don't log
        }
      }
    }, 5000); // Poll every 5 seconds

    // Cleanup
    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('Error unsubscribing from AppKit:', error);
        }
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [wallet]);

  // Handle BNB wallet connection via AppKit
  const handleBNBConnect = async () => {
    const kit = initializeAppKit();
    if (!kit) {
      throw new Error('AppKit not initialized');
    }

    try {
      await kit.open();
    } catch (error) {
      console.error('❌ Failed to open AppKit modal:', error);
      throw error;
    }
  };

  // Handle wallet connection
  const handleConnect = async () => {
    try {
      if (wallet.chain === 'bnb') {
        await handleBNBConnect();
      } else if (wallet.chain === 'solana') {
        // For Solana, we'll use the WalletMultiButton approach
        // This will be handled by the render logic below
        return;
      } else {
        await wallet.connect();
      }
    } catch (error) {
      console.error('❌ Connection failed:', error);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      if (wallet.chain === 'bnb') {
        await wallet.disconnectReown();
      } else {
        await wallet.disconnect();
      }
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  };

  // Copy address to clipboard
  const copyAddress = async () => {
    if (!wallet.address) return;
    
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('❌ Failed to copy address:', error);
    }
  };

  // Format address for display
  const formatAddress = (address: string | null) => {
    if (!address) return 'Loading...';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Get block explorer URL
  const getExplorerUrl = () => {
    if (!wallet.address) return '';
    
    if (wallet.chain === 'solana') {
      return `https://explorer.solana.com/address/${wallet.address}?cluster=devnet`;
    } else {
      return `https://testnet.bscscan.com/address/${wallet.address}`;
    }
  };

  // Get network name
  const getNetworkName = () => {
    return wallet.chain === 'solana' ? 'Solana Devnet' : 'BSC Testnet';
  };

  // Show checking state briefly during connection restoration
  if (isCheckingConnection && !wallet.isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center space-y-4"
      >
        <motion.div
          className="flex items-center space-x-2 text-text-muted"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent-green border-t-transparent" />
          <span>Checking for existing wallet connections...</span>
        </motion.div>
      </motion.div>
    );
  }

  if (!wallet.isConnected || !wallet.address) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center space-y-4"
      >
        {wallet.chain === 'solana' ? (
          // Use Solana's WalletMultiButton for Solana connections
          <div className="wallet-adapter-button-container">
            <WalletMultiButton />
            <p className="text-text-muted text-xs text-center mt-2">
              Choose Phantom or Solflare wallet
            </p>
          </div>
        ) : (
          // Use custom button for BNB connections
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleConnect}
            disabled={wallet.isConnecting}
            className="btn-primary flex items-center justify-center space-x-2 w-full px-6 py-3"
          >
            {wallet.isConnecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Wallet size={16} />
                <span>Connect Wallet</span>
              </>
            )}
          </motion.button>
        )}

        {wallet.error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-error/20 border border-error/30 text-error px-4 py-2 rounded-lg text-sm text-center max-w-md"
          >
            {wallet.error}
          </motion.div>
        )}

        <p className="text-text-muted text-sm text-center">
          Connect your wallet to start investing
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="card flex items-center justify-between w-full hover:border-accent-green/50 transition-all duration-200 p-3 sm:p-4"
      >
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-green rounded-full flex items-center justify-center flex-shrink-0">
            <Wallet size={16} className="text-white sm:w-5 sm:h-5" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <div className="text-text-primary font-medium text-sm sm:text-base truncate">
              {formatAddress(wallet.address)}
            </div>
            <div className="text-text-muted text-xs sm:text-sm truncate">
              {getNetworkName()}
            </div>
          </div>
        </div>
        <ChevronDown 
          size={16} 
          className={`text-text-muted transition-transform duration-200 flex-shrink-0 sm:w-5 sm:h-5 ${
            isDropdownOpen ? 'rotate-180' : ''
          }`} 
        />
      </motion.button>

      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-bg-card border border-border-dark rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {/* Address Section */}
            <div className="p-4 border-b border-border-dark">
              <div className="text-text-muted text-xs uppercase tracking-wide mb-2">
                Wallet Address
              </div>
              <div className="flex items-center justify-between space-x-2">
                <code className="text-text-primary text-sm font-mono">
                  {wallet.address}
                </code>
                <button
                  onClick={copyAddress}
                  className="p-2 hover:bg-bg-hover rounded-lg transition-colors duration-200"
                  title="Copy address"
                >
                  {copied ? (
                    <Check size={16} className="text-success" />
                  ) : (
                    <Copy size={16} className="text-text-muted" />
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="p-2">
              <motion.a
                whileHover={{ backgroundColor: 'rgba(42, 42, 42, 1)' }}
                href={getExplorerUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-text-primary hover:text-accent-green transition-colors duration-200"
              >
                <ExternalLink size={16} />
                <span>View on Explorer</span>
              </motion.a>

              <motion.button
                whileHover={{ backgroundColor: 'rgba(42, 42, 42, 1)' }}
                onClick={handleDisconnect}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-error hover:text-error transition-colors duration-200"
              >
                <LogOut size={16} />
                <span>Disconnect</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </motion.div>
  );
};