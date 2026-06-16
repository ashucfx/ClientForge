// src/app/(career-portal)/layout.tsx

import { PortalBugReporter } from '@/components/PortalBugReporter';

export const dynamic = 'force-dynamic';

export default function CareerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PortalBugReporter />
    </>
  );
}
