import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  className = '', 
  width = 'w-full', 
  height = 'h-4' 
}) => {
  return (
    <motion.div
      className={`bg-gradient-to-r from-bg-hover via-bg-secondary to-bg-hover bg-[length:200%_100%] rounded ${width} ${height} ${className}`}
      animate={{
        backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
};

// Специфичные скелетоны для разных типов контента
export const SkeletonCard: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div className="card animate-pulse">
      {children}
    </div>
  );
};

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 1, 
  className = '' 
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <LoadingSkeleton
          key={index}
          width={index === lines - 1 ? 'w-3/4' : 'w-full'}
          height="h-4"
        />
      ))}
    </div>
  );
};

export const SkeletonStat: React.FC = () => {
  return (
    <SkeletonCard>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <LoadingSkeleton width="w-24" height="h-3" className="mb-2" />
          <LoadingSkeleton width="w-16" height="h-6" />
        </div>
        <LoadingSkeleton width="w-6" height="h-6" className="rounded-full" />
      </div>
    </SkeletonCard>
  );
};

export const SkeletonButton: React.FC = () => {
  return (
    <LoadingSkeleton width="w-full" height="h-12" className="rounded-lg" />
  );
};

export const SkeletonInput: React.FC = () => {
  return (
    <div className="space-y-2">
      <LoadingSkeleton width="w-32" height="h-4" />
      <LoadingSkeleton width="w-full" height="h-10" className="rounded-lg" />
      <LoadingSkeleton width="w-48" height="h-3" />
    </div>
  );
};

export const SkeletonNetworkInfo: React.FC = () => {
  return (
    <SkeletonCard>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <LoadingSkeleton width="w-6" height="h-6" className="rounded-full" />
          <LoadingSkeleton width="w-48" height="h-6" />
        </div>
        <LoadingSkeleton width="w-32" height="h-8" className="rounded-lg" />
      </div>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <LoadingSkeleton width="w-24" height="h-4" className="mb-1" />
          <LoadingSkeleton width="w-full" height="h-4" />
        </div>
        <div>
          <LoadingSkeleton width="w-20" height="h-4" className="mb-1" />
          <LoadingSkeleton width="w-32" height="h-4" />
        </div>
        <div>
          <LoadingSkeleton width="w-20" height="h-4" className="mb-1" />
          <LoadingSkeleton width="w-24" height="h-4" />
        </div>
        <div>
          <LoadingSkeleton width="w-24" height="h-4" className="mb-1" />
          <LoadingSkeleton width="w-20" height="h-4" />
        </div>
      </div>
    </SkeletonCard>
  );
};

export const SkeletonInvestmentForm: React.FC = () => {
  return (
    <SkeletonCard>
      <LoadingSkeleton width="w-40" height="h-6" className="mb-4" />
      <div className="space-y-4">
        <SkeletonInput />
        <div className="bg-bg-hover rounded-lg p-3 space-y-2">
          <div className="flex justify-between">
            <LoadingSkeleton width="w-32" height="h-4" />
            <LoadingSkeleton width="w-16" height="h-4" />
          </div>
          <div className="flex justify-between">
            <LoadingSkeleton width="w-24" height="h-4" />
            <LoadingSkeleton width="w-20" height="h-4" />
          </div>
          <div className="flex justify-between">
            <LoadingSkeleton width="w-20" height="h-4" />
            <LoadingSkeleton width="w-18" height="h-4" />
          </div>
          <div className="flex justify-between">
            <LoadingSkeleton width="w-28" height="h-4" />
            <LoadingSkeleton width="w-18" height="h-4" />
          </div>
        </div>
        <SkeletonButton />
      </div>
    </SkeletonCard>
  );
};

export const SkeletonStats: React.FC = () => {
  return (
    <SkeletonCard>
      <LoadingSkeleton width="w-36" height="h-5" className="mb-3" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex justify-between">
            <LoadingSkeleton width="w-32" height="h-4" />
            <LoadingSkeleton width="w-24" height="h-4" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
};