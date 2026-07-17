// src/app/(protected)/team/page.tsx
import AppShell from '@/components/AppShell';
import { TeamManager } from '@/components/TeamManager';

export const dynamic = 'force-dynamic';

export default function TeamPage() {
  return (
    <AppShell>
      <TeamManager />
    </AppShell>
  );
}
