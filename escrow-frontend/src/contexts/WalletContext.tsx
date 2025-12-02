import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { Connection } from '@solana/web3.js';
import { ethers } from 'ethers';

import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

import { WalletState, SupportedChain } from '../types';
import { NETWORKS } from '../config/contracts';

const WalletContext = createContext<WalletState | null>(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

// Get Solana wallets with unique filtering  
function getSolanaWallets() {
  // Only include specific, known Solana wallets to avoid auto-detection issues
  const allowedWallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];
  
  // Create a safe list by explicitly filtering by exact wallet names we want
  const safeWallets = allowedWallets.filter(wallet => {
    const walletName = wallet.name.toLowerCase();
    return walletName === 'phantom' || walletName === 'solflare';
  });
  
  // Additional filtering to ensure no duplicate keys
  const uniqueWallets = safeWallets.filter((wallet, index, self) => 
    index === self.findIndex(w => w.name === wallet.name)
  );
  
  console.log('Configured Solana wallets:', uniqueWallets.map(w => w.name));
  
  return uniqueWallets;
}

// Solana provider wrapper with strict wallet isolation
const SolanaProviderWrapper: React.FC<{ children: ReactNode; enabled: boolean }> = ({ children, enabled }) => {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  
  // Use empty array when disabled to avoid any wallet detection
  const wallets = useMemo(() => enabled ? getSolanaWallets() : [], [enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider 
        wallets={wallets} 
        autoConnect={false}
        localStorageKey="solana-wallet-ondrix"
        onError={(error) => {
          // Silent error handling to avoid console spam
          if (!error.message?.includes('User rejected')) {
            console.warn('Solana wallet error:', error.message);
          }
        }}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

// Main wallet provider implementation
const WalletProviderInner: React.FC<WalletProviderProps> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [chain, setChain] = useState<SupportedChain>(() => {
    // Restore chain from localStorage on page load
    const savedChain = localStorage.getItem('ondrix-selected-chain') as SupportedChain;
    return savedChain || 'bnb';
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isChainSwitching, setIsChainSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // EVM state
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [reownAddress, setReownAddress] = useState<string | null>(null);
  const [reownProvider, setReownProvider] = useState<ethers.BrowserProvider | null>(null);

  // Solana state
  const [solanaConnection, setSolanaConnection] = useState<Connection | null>(null);

  // Get Solana wallet (always call hook, but only use when Solana chain is selected)
  let solanaWallet: any = null;
  try {
    solanaWallet = useSolanaWallet();
  } catch (error) {
    console.warn('Solana wallet not available:', error);
    solanaWallet = null;
  }

  // Calculate isConnected based on current chain and available wallets
  const isConnected = useMemo(() => {
    if (chain === 'solana') {
      return solanaWallet?.connected && solanaWallet?.publicKey != null;
    } else if (chain === 'bnb') {
      return reownAddress != null;
    }
    return false;
  }, [chain, solanaWallet?.connected, solanaWallet?.publicKey, reownAddress]);

  // Update address when chain changes
  useEffect(() => {
    if (chain === 'solana' && solanaWallet?.connected && solanaWallet?.publicKey) {
      setAddress(solanaWallet.publicKey.toString());
    } else if (chain === 'bnb' && reownAddress) {
      setAddress(reownAddress);
    } else {
      setAddress(null);
    }
  }, [chain, solanaWallet?.connected, solanaWallet?.publicKey, reownAddress]);

  // Initialize Solana connection
  useEffect(() => {
    const connection = new Connection(NETWORKS.solana.rpcUrl, 'confirmed');
    setSolanaConnection(connection);
  }, []);

  // Auto-restore wallet state after page reload
  useEffect(() => {
    const autoRestoreWalletState = async () => {
      console.log('🔄 Attempting to restore wallet state after page reload...');
      
      // Check if Solana wallet is already connected
      if (chain === 'solana' && solanaWallet) {
        if (solanaWallet.connected && solanaWallet.publicKey) {
          console.log('✅ Restored Solana wallet state:', solanaWallet.publicKey.toString());
          setAddress(solanaWallet.publicKey.toString());
          setError(null);
          return;
        }
        
        // Try to auto-connect Solana if wallet is available
        try {
          if (solanaWallet.wallet) {
            await solanaWallet.connect();
            console.log('✅ Auto-reconnected Solana wallet');
          }
        } catch (error) {
          console.log('ℹ️ Solana wallet auto-reconnect not needed or failed (normal)');
        }
      }
      
      // Check if BNB/Reown wallet is already connected
      if (chain === 'bnb') {
        // Check localStorage for Reown connection state
        const reownConnected = localStorage.getItem('wc@2:client:0.3//session') || 
                              localStorage.getItem('reown.connected') ||
                              localStorage.getItem('walletconnect');
        
        if (reownConnected) {
          console.log('🔍 Found Reown connection data, attempting to restore...');
          
          // Initialize AppKit to check current connection
          await import('../components/WalletConnection');
          // AppKit should automatically restore connection through its own mechanisms
          
          // Give AppKit some time to restore connection
          setTimeout(() => {
            console.log('⏰ Checking for restored Reown connection...');
          }, 2000);
        }
      }
    };

    // Only run auto-restore when we don't have an address and we're not connecting
    // Also run when chain changes to restore the appropriate wallet for that chain
    if (!address && !isConnecting) {
      autoRestoreWalletState();
    }
  }, [chain, solanaWallet?.wallet, address, isConnecting]);

  // Additional effect to trigger connection check when switching to a new chain
  useEffect(() => {
    const checkConnectionForChain = async () => {
      // Small delay to allow AppKit or Solana wallet to settle
      setTimeout(() => {
        console.log(`🔍 Checking existing connections for ${chain} chain...`);
        
        if (chain === 'solana' && solanaWallet?.connected && solanaWallet?.publicKey && !address) {
          console.log('✅ Found connected Solana wallet, updating address');
          setAddress(solanaWallet.publicKey.toString());
        }
        
        if (chain === 'bnb' && !address) {
          // Check if there's a stored Reown connection
          const reownData = localStorage.getItem('wc@2:client:0.3//session');
          if (reownData) {
            console.log('🔍 Found stored Reown session, triggering connection check');
            // The WalletConnection component will handle the actual restoration
          }
        }
      }, 1000);
    };

    checkConnectionForChain();
  }, [chain]);

  // Handle Solana wallet state changes
  useEffect(() => {
    if (chain === 'solana' && solanaWallet) {
      if (solanaWallet.connected && solanaWallet.publicKey) {
        setAddress(solanaWallet.publicKey.toString());
        setError(null);
        console.log('✅ Solana wallet connected:', solanaWallet.publicKey.toString());
      } else {
        if (isConnected && address) {
          setAddress(null);
          console.log('❌ Solana wallet disconnected');
        }
      }
    }
  }, [solanaWallet?.connected, solanaWallet?.publicKey, chain]);

  // Handle Solana wallet connecting state
  useEffect(() => {
    if (chain === 'solana' && solanaWallet) {
      setIsConnecting(solanaWallet.connecting);
    }
  }, [solanaWallet?.connecting, chain]);

  // Debug: log address changes
  useEffect(() => {
    console.log('🔍 WalletContext state changed:', {
      address,
      isConnected,
      chain,
      reownAddress,
      source: address === reownAddress ? 'reown' : address ? 'other' : 'none'
    });
  }, [address, isConnected, chain, reownAddress]);

  // Connect to BNB (handled by Reown)
  const connectBNB = async () => {
    throw new Error('BNB connections are handled through WalletConnect/Reown. Use the WalletConnect button.');
  };

  // Connect to Solana
  const connectSolana = async () => {
    if (chain !== 'solana') {
      throw new Error('Switch to Solana chain first');
    }

    if (!solanaWallet) {
      throw new Error('Solana wallet provider not available');
    }

    console.log('👻 Connecting to Solana wallet...');
    
    // The WalletMultiButton will handle the wallet selection and connection
    // This function is mainly for direct programmatic connections
    if (solanaWallet.wallet) {
      await solanaWallet.connect();
    } else {
      throw new Error('Please use the wallet selection button to choose and connect your wallet');
    }
  };

  // Main connect function
  const connect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (chain === 'bnb') {
        await connectBNB();
      } else if (chain === 'solana') {
        await connectSolana();
      }
    } catch (err: any) {
      setError(err.message);
      console.error('❌ Connection error:', err);
      throw err;
    } finally {
      if (chain === 'bnb') {
        setIsConnecting(false);
      }
    }
  };

  // Disconnect wallet
  const disconnect = async () => {
    console.log('🔌 Disconnecting wallet...');
    
    setAddress(null);
    setError(null);

    if (chain === 'bnb') {
      setProvider(null);
      setSigner(null);
      // Clear Reown state
      setReownAddress(null);
      setReownProvider(null);
    } else if (chain === 'solana' && solanaWallet) {
      try {
        await solanaWallet.disconnect();
        console.log('✅ Solana wallet disconnected');
      } catch (error) {
        console.warn('⚠️ Error disconnecting Solana wallet:', error);
      }
    }
  };

  // Switch chain (keeps wallets connected)
  const switchChain = (newChain: SupportedChain) => {
    if (newChain !== chain) {
      console.log(`🔄 Switching from ${chain} to ${newChain} (keeping wallets connected)`);
      
      // Start chain switching state
      setIsChainSwitching(true);
      
      // Clear any previous provider states when switching to prevent ENS issues
      if (newChain === 'bnb' && chain === 'solana') {
        // When switching to BNB from Solana, clear provider state
        setProvider(null);
        setSigner(null);
        console.log('🔄 Switching to BNB: cleared Solana state, waiting for Reown connection...');
      } else if (newChain === 'solana' && chain === 'bnb') {
        // When switching to Solana from BNB, clear BNB provider state
        setProvider(null);
        setSigner(null);
        setReownAddress(null);
        setReownProvider(null);
        console.log('🔄 Switching to Solana: cleared BNB state, waiting for Solana connection...');
      }
      
      setChain(newChain);
      setError(null); // Clear any previous errors
      
      // Save selected chain to localStorage for persistence across reloads
      localStorage.setItem('ondrix-selected-chain', newChain);
      
      // End chain switching after a delay to allow wallet connections to settle
      setTimeout(() => {
        setIsChainSwitching(false);
      }, 1500); // 1.5 seconds to allow data loading
      
      // Note: We keep wallets connected to allow seamless switching
    }
  };

  // Handle Reown connection (called by Reown AppKit)
  const setReownConnection = (reownAddr: string | null, reownProv: ethers.BrowserProvider | null) => {
    console.log('🔗 WalletContext setReownConnection called:', {
      reownAddr,
      hasProvider: !!reownProv,
      currentChain: chain
    });

    setReownAddress(reownAddr);
    setReownProvider(reownProv);

    // If BNB chain and Reown is connecting, set as active connection
    if (chain === 'bnb' && reownAddr && reownProv) {
      console.log('✅ Setting Reown as active connection for BNB');
      
      setAddress(reownAddr);
      setProvider(reownProv);
      setSigner(null); // Lazy load signer when needed

    } else if (!reownAddr) {
      // Reown disconnected
      if (reownAddress === address) {
        setAddress(null);
        setProvider(null);
        setSigner(null);
      }
    }
  };

  // Disconnect Reown completely
  const disconnectReown = async () => {
    console.log('🔌 WalletContext disconnectReown called');

    try {
      // Call AppKit disconnect if available
      const reownDisconnectFn = (window as any).__reownDisconnect;
      if (reownDisconnectFn) {
        console.log('🔄 Calling AppKit.disconnect()...');
        await reownDisconnectFn();
        console.log('✅ AppKit.disconnect() completed');
      }

      // Clear storage
      localStorage.clear();
      sessionStorage.clear();

      // Clear state
      setReownAddress(null);
      setReownProvider(null);
      setAddress(null);
      setProvider(null);
      setSigner(null);

      console.log('✅ Reown completely disconnected');

    } catch (error) {
      console.error('❌ Error disconnecting Reown:', error);
    }
  };

  // Get signer when needed (lazy loading to prevent -32002 error)
  const getSigner = async (): Promise<ethers.JsonRpcSigner | null> => {
    if (chain === 'bnb' && reownProvider && isConnected) {
      try {
        if (!signer) {
          console.log('🔄 Getting signer from provider...');
          const newSigner = await reownProvider.getSigner();
          setSigner(newSigner);
          return newSigner;
        }
        return signer;
      } catch (error) {
        console.error('❌ Error getting signer:', error);
        return null;
      }
    }
    return null;
  };

  const value: WalletState = {
    isConnected,
    address,
    chain,
    isConnecting,
    isChainSwitching,
    error,
    provider,
    signer,
    solanaConnection,
    solanaPublicKey: solanaWallet?.publicKey || null,
    solanaWallet,
    reownAddress,
    reownProvider,
    setReownConnection,
    disconnectReown,
    connect,
    disconnect,
    switchChain,
    getSigner, // Add getSigner method
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

// Main export
export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  return (
    <SolanaProviderWrapper enabled={true}>
      <WalletProviderInner>
        {children}
      </WalletProviderInner>
    </SolanaProviderWrapper>
  );
};

// Global window interface extensions
declare global {
  interface Window {
    ethereum?: any;
    solana?: any;
    phantom?: {
      solana?: any;
    };
    __reownDisconnect?: () => Promise<void>;
  }
}