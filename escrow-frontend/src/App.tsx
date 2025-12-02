import React from 'react';
import { WalletProvider } from './contexts/WalletContext';
import { Header } from './components/Header';
import { ChainSelector } from './components/ChainSelector';
import { WalletConnection } from './components/WalletConnection';
import { LandingPage } from './components/LandingPage';
import { InvestmentDashboard } from './components/InvestmentDashboard';
import { useWallet } from './contexts/WalletContext';
import { motion, AnimatePresence } from 'framer-motion';

// App content component (inside wallet provider)
const AppContent: React.FC = () => {
  const wallet = useWallet();

  return (
    <div className="min-h-screen bg-bg-dark">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {!wallet.isConnected && !wallet.isChainSwitching ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Hero Section */}
              <div className="text-center space-y-6 mb-12">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-4xl md:text-6xl font-bold"
                >
                  <span className="gradient-text">Secure</span>{' '}
                  <span className="text-text-primary">Investment</span>
                  <br />
                  <span className="text-text-primary">Platform</span>
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl text-text-secondary max-w-2xl mx-auto"
                >
                  Invest in projects with maximum security. 50% goes to the project instantly, 
                  50% is time-locked for your protection.
                </motion.p>
              </div>

              {/* Chain Selector and Wallet Connection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col items-center space-y-4 max-w-md mx-auto"
              >
                <ChainSelector />
                <div className="w-full">
                  <WalletConnection />
                </div>
              </motion.div>

              {/* Landing Page Content */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <LandingPage />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Connected Header */}
              <div className="flex flex-col space-y-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary">
                    Investment Dashboard
                  </h1>
                  <p className="text-text-secondary mt-2">
                    Manage your investments and track your returns
                  </p>
                </div>
                
                <div className="flex flex-col items-center space-y-4 max-w-md mx-auto">
                  <ChainSelector />
                  <WalletConnection />
                </div>
              </div>

              {/* Investment Dashboard */}
              {wallet.isChainSwitching ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center py-12"
                >
                  <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-accent-primary border-t-transparent mx-auto"></div>
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">Switching Networks</h3>
                      <p className="text-text-muted">Loading {wallet.chain.toUpperCase()} data...</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <InvestmentDashboard />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-dark mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-text-muted">
            <p>&copy; 2025 Ondrix Escrow. Secure investment platform.</p>
            <p className="text-sm mt-2">
              Built with security and transparency in mind.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Main App component
const App: React.FC = () => {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
};

export default App;