'use client';
// src/app/invoices/page.tsx
// Full invoice list — redirect to dashboard (dashboard IS the invoice list)
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InvoicesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return null;
}
