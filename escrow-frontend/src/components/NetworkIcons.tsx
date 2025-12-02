import React from 'react';

// Solana Network Icon
export const SolanaIcon: React.FC<{ size?: number; className?: string }> = ({ 
  size = 24, 
  className = '' 
}) => {
  return (
    <div 
      className={`rounded-full bg-white flex items-center justify-center p-1 ${className}`}
      style={{ 
        width: size, 
        height: size
      }}
    >
      <img 
        src="/solana-sol-logo.png"
        alt=""
        width={size * 0.85}
        height={size * 0.85}
        style={{ 
          width: size * 0.85, 
          height: size * 0.85,
          objectFit: 'contain'
        }}
        onError={(e) => {
          console.log('Solana icon failed to load');
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
};

// BNB Network Icon  
export const BnbIcon: React.FC<{ size?: number; className?: string }> = ({ 
  size = 24, 
  className = '' 
}) => {
  return (
    <img 
      src="/bnb-bnb-logo.png"
      alt=""
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      style={{ 
        width: size, 
        height: size,
        objectFit: 'cover'
      }}
      onError={(e) => {
        console.log('BNB icon failed to load');
        e.currentTarget.style.display = 'none';
      }}
    />
  );
};

// ODX Token Icon from IPFS
export const OdxTokenIcon: React.FC<{ size?: number; className?: string }> = ({ 
  size = 32, 
  className = '' 
}) => {
  return (
    <img 
      src="https://gold-secondary-clam-627.mypinata.cloud/ipfs/bafybeidjnom2r63q66gkh33t3yf7przdp3pouf7bmrvptdn56l5kkq4nhy"
      alt="ODX Token"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ 
        width: size, 
        height: size,
        objectFit: 'cover'
      }}
    />
  );
};