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

export function BrandProvider({ children, initialBrand }: { children: React.ReactNode, initialBrand?: string }) {
  const { hasCatalystAccess, hasRnAccess, isSuperAdmin } = useAdmin();
  
  // Default to the brand from the cookie, or fallback to 'all' or specific brand based on access
  const [activeBrand, setActiveBrand] = useState<BrandId | 'all'>(
    (initialBrand as BrandId) || 'all'
  );

  useEffect(() => {
    // If we have an initialBrand from the login cookie, we stick to it
    if (initialBrand) {
       setActiveBrand(initialBrand as BrandId);
       return;
    }

    if (!isSuperAdmin) {
      if (hasCatalystAccess && !hasRnAccess) setActiveBrand('catalyst');
      if (hasRnAccess && !hasCatalystAccess) setActiveBrand('ripple_nexus');
    }
  }, [isSuperAdmin, hasCatalystAccess, hasRnAccess, initialBrand]);

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
