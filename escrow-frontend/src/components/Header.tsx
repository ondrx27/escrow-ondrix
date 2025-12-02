import React from 'react';
import { motion } from 'framer-motion';
import { OdxTokenIcon } from './NetworkIcons';

export const Header: React.FC = () => {
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-card border-b border-border-dark sticky top-0 z-50 backdrop-blur-sm bg-bg-card/95"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center space-x-3"
          >
            <OdxTokenIcon size={40} className="shadow-lg" />
            <div>
              <h1 className="text-text-primary font-bold text-lg">
                Ondrix <span className="gradient-text">Escrow</span>
              </h1>
            </div>
          </motion.div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-text-secondary hover:text-accent-green transition-colors duration-200">
              Features
            </a>
            <a href="#how-it-works" className="text-text-secondary hover:text-accent-green transition-colors duration-200">
              How It Works
            </a>
            <a href="#security" className="text-text-secondary hover:text-accent-green transition-colors duration-200">
              Security
            </a>
          </nav>

          {/* Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-accent-green rounded-full animate-pulse" />
            <span className="text-text-muted text-sm hidden sm:block">Live</span>
          </div>
        </div>
      </div>
    </motion.header>
  );
};