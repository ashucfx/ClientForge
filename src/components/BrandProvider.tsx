'use client';
// src/components/BrandProvider.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import type { BrandId } from '@/lib/brand/types';
import { useAdmin } from '@/components/AdminProvider';

type BrandContextType = {
  activeBrand: BrandId | 'all';
  setActiveBrand: (brand: BrandId | 'all') => void;
};

const BrandContext = createContext<BrandContextType | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode, initialBrand?: string }) {
  const [activeBrand, setActiveBrand] = useState<BrandId | 'all'>('catalyst');

  return (
    <BrandContext.Provider value={{ activeBrand, setActiveBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within a BrandProvider');
  return ctx;
}
