import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import { GlobalLockStatus } from './GlobalLockStatus';
import { useWallet } from '../contexts/WalletContext';
import { ethers } from 'ethers';
import { CONTRACTS, ESCROW_ABI } from '../config/contracts';
import { getEscrowStatus as getSolanaEscrowStatus } from '../utils/solana';
import { useBnbContractConfig } from '../hooks/useBnbContractConfig';
import { useSolanaContractConfig } from '../hooks/useSolanaContractConfig';

export const LandingPage: React.FC = () => {
  const wallet = useWallet();
  const [lockDuration, setLockDuration] = useState<string>('Loading...');
  const bnbContractConfig = useBnbContractConfig();
  const solanaContractConfig = useSolanaContractConfig();
  
  // Function to get total token supply based on current chain
  const getTotalTokenSupply = () => {
    if (wallet.chain === 'solana') {
      return solanaContractConfig.isLoading 
        ? 'Loading...' 
        : solanaContractConfig.totalTokensAvailable.toLocaleString();
    } else {
      return bnbContractConfig.isLoading 
        ? 'Loading...' 
        : parseFloat(bnbContractConfig.totalTokensAvailable).toLocaleString();
    }
  };
  
  // Function to get investment limits based on current chain
  const getInvestmentLimits = () => {
    if (wallet.chain === 'solana') {
      return solanaContractConfig.isLoading 
        ? '0.001 - 10 SOL' 
        : `${solanaContractConfig.minInvestmentAmount} - ${solanaContractConfig.maxInvestmentPerUser} SOL`;
    } else {
      return bnbContractConfig.isLoading 
        ? '0.001 - 10,000 BNB' 
        : `${bnbContractConfig.minInvestmentAmount} - ${parseFloat(bnbContractConfig.maxInvestmentPerUser).toLocaleString()} BNB`;
    }
  };
  
  // Dynamic steps based on current chain
  const steps = [
    {
      step: '1',
      title: 'Connect Wallet',
      description: 'Connect your Solana or BNB wallet to get started with investing.',
    },
    {
      step: '2',
      title: 'Choose Amount',
      description: `Select your investment amount (${getInvestmentLimits()}).`,
    },
    {
      step: '3',
      title: 'Invest Securely',
      description: 'Your funds are split: 50% to project, 50% time-locked for protection.',
    },
    {
      step: '4',
      title: 'Get Tokens',
      description: 'Receive all your tokens immediately and track your time-locked funds.',
    },
  ];

  // Получаем lockDuration из контракта
  const fetchLockDuration = async () => {
    try {
      if (wallet.chain === 'bnb') {
        const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
        const contract = new ethers.Contract(CONTRACTS.bnb.escrow, ESCROW_ABI, provider);
        const escrowStatus = await contract.getEscrowStatus();
        const duration = Number(escrowStatus[5]) || 14400; // lockDuration из контракта
        setLockDuration(formatDuration(duration));
      } else if (wallet.chain === 'solana') {
        const escrowData = await getSolanaEscrowStatus();
        const duration = escrowData.lockDuration || 14400;
        setLockDuration(formatDuration(duration));
      } else {
        // По умолчанию показываем 4 часа, пока нет сети
        setLockDuration('4h');
      }
    } catch (error) {
      console.error('Error fetching lock duration:', error);
      setLockDuration('4h'); // fallback
    }
  };

  // Форматируем продолжительность в читаемый вид
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  useEffect(() => {
    fetchLockDuration();
  }, [wallet.chain]);

  const features = [
    {
      icon: Shield,
      title: 'Secure Investment',
      description: 'Your investment is protected by smart contract escrow with automatic 50/50 split.',
    },
    {
      icon: Lock,
      title: 'Time-Locked Protection',
      description: '50% of your funds are time-locked, providing maximum security for your investment.',
    },
    {
      icon: Clock,
      title: 'Immediate Access',
      description: 'Get all your tokens immediately upon investment, with 50% of your funds time-locked.',
    },
    {
      icon: TrendingUp,
      title: 'Fair Token Price',
      description: 'Fixed token price of $0.10 USD with real-time price feed integration.',
    },
  ];


  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="space-y-16">
      {/* Features Section */}
      <motion.section
        id="features"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            Why Choose <span className="gradient-text">Ondrix Escrow</span>?
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto">
            Our platform provides maximum security for your investments through smart contract escrow 
            with automatic fund splitting and time-lock protection.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ scale: 1.05 }}
              className="card text-center hover:border-accent-green/50 transition-all duration-300"
            >
              <div className="w-16 h-16 bg-gradient-green rounded-full flex items-center justify-center mx-auto mb-4">
                <feature.icon size={28} className="text-white" />
              </div>
              <h3 className="text-text-primary font-semibold mb-2">{feature.title}</h3>
              <p className="text-text-muted text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Global Lock Status */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            Live <span className="gradient-text">Transparency</span> Status
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto">
            Real-time data from the smart contract showing current lock status and unlock progress.
          </p>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <GlobalLockStatus />
        </motion.div>
      </motion.section>

      {/* How It Works */}
      <motion.section
        id="how-it-works"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto">
            Simple 4-step process to securely invest in projects with maximum protection.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="relative"
            >
              {/* Step Number */}
              <div className="w-12 h-12 bg-gradient-green rounded-full flex items-center justify-center text-white font-bold text-lg mb-4 mx-auto md:mx-0">
                {step.step}
              </div>
              
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-12 w-full h-0.5 bg-gradient-to-r from-accent-green to-accent-green/20" />
              )}
              
              <div className="text-center md:text-left">
                <h3 className="text-text-primary font-semibold mb-2">{step.title}</h3>
                <p className="text-text-muted text-sm">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Security Section */}
      <motion.section
        id="security"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            Maximum <span className="gradient-text">Security</span>
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto">
            Your investments are protected by battle-tested smart contracts and industry-standard security practices.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          <motion.div variants={itemVariants} className="card">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle className="text-success" size={24} />
              <h3 className="text-text-primary font-semibold">Smart Contract Escrow</h3>
            </div>
            <ul className="space-y-2 text-text-muted text-sm">
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-accent-green rounded-full" />
                <span>Automated fund splitting (50/50)</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-accent-green rounded-full" />
                <span>Time-lock protection mechanism</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-accent-green rounded-full" />
                <span>Immutable contract logic</span>
              </li>
            </ul>
          </motion.div>

          <motion.div variants={itemVariants} className="card">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle className="text-success" size={24} />
              <h3 className="text-text-primary font-semibold">Multi-Chain Support</h3>
            </div>
            <ul className="space-y-2 text-text-muted text-sm">
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-accent-green rounded-full" />
                <span>Solana Program integration</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-accent-green rounded-full" />
                <span>BNB Smart Chain compatibility</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-accent-green rounded-full" />
                <span>Real-time price feed integration</span>
              </li>
            </ul>
          </motion.div>

        </div>
      </motion.section>

      {/* Stats Section */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bg-bg-card rounded-xl p-8 border border-border-dark"
      >
        <div className="grid md:grid-cols-4 gap-8 text-center">
          <motion.div variants={itemVariants}>
            <div className="text-3xl font-bold gradient-text mb-2">$0.10</div>
            <div className="text-text-muted text-sm">Token Price USD</div>
          </motion.div>
          <motion.div variants={itemVariants}>
            <div className="text-3xl font-bold gradient-text mb-2">50/50</div>
            <div className="text-text-muted text-sm">Fund Split Ratio</div>
          </motion.div>
          <motion.div variants={itemVariants}>
            <div className="text-3xl font-bold gradient-text mb-2">{lockDuration}</div>
            <div className="text-text-muted text-sm">Time-lock Period</div>
          </motion.div>
          <motion.div variants={itemVariants}>
            <div className="text-3xl font-bold gradient-text mb-2">{getTotalTokenSupply()}</div>
            <div className="text-text-muted text-sm">Total Token Supply</div>
          </motion.div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="text-center space-y-6"
      >
        <motion.div variants={itemVariants}>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            Ready to <span className="gradient-text">Invest Securely</span>?
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto mb-8">
            Connect your wallet above to start investing with maximum security and protection.
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <div className="text-text-muted text-sm">
            ↑ Choose your network and connect wallet to begin
          </div>
        </motion.div>
      </motion.section>
    </div>
  );
};