// src/app/(protected)/rn/team/page.tsx
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { TeamManager } from '@/components/TeamManager';

export const dynamic = 'force-dynamic';

export default function RnTeamPage() {
  return (
    <RippleNexusShell>
      <div className="rn-page">
        <TeamManager />
      </div>
    </RippleNexusShell>
  );
}
