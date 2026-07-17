import * as React from 'react';
import { RnEmailShell, RnHeading, RnText, RnButton, RnMetric } from './RnEmailShell';
import { Section } from '@react-email/components';

interface RnMilestonePaymentEmailProps {
  clientName: string;
  milestoneTitle: string;
  amountFormatted: string;
  portalUrl: string;
  invoiceUrl?: string;
}

export function RnMilestonePaymentEmail({ 
  clientName, 
  milestoneTitle, 
  amountFormatted, 
  portalUrl, 
  invoiceUrl 
}: RnMilestonePaymentEmailProps) {
  const firstName = clientName.split(' ')[0];

  return (
    <RnEmailShell preview={`Payment required for milestone: ${milestoneTitle}`} headerTitle="Action Required">
      <RnHeading>Milestone Payment Request</RnHeading>
      
      <RnText>
        Hello {firstName},
      </RnText>
      
      <RnText>
        We have reached a new milestone in your project. To proceed with the next phase, 
        please process the payment for the following milestone:
      </RnText>
      
      <Section style={{ marginTop: '24px', marginBottom: '24px' }}>
        <RnMetric label="Milestone" value={milestoneTitle} />
        <RnMetric label="Amount Due" value={amountFormatted} highlight />
      </Section>
      
      <RnText>
        You can securely complete this payment by accessing your client portal below.
      </RnText>

      <RnButton href={invoiceUrl || portalUrl}>
        {invoiceUrl ? 'Pay via Razorpay' : 'View in Portal'}
      </RnButton>
      
      <RnText style={{ fontSize: '13px', color: '#64748B', marginTop: '32px' }}>
        If you have any questions regarding this milestone, please reply directly to this email 
        or send us a message through your portal.
      </RnText>
    </RnEmailShell>
  );
}
