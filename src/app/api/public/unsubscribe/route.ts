import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';

const REASONS = [
  'Too many emails',
  'Content is not relevant to me',
  "I didn't sign up for this",
  'I found what I was looking for',
  'Other',
];

function reasonPage(leadId: string, email: string, brandName: string, primaryColor: string, error?: string) {
  const options = REASONS.map(r =>
    `<label class="reason-label">
      <input type="radio" name="reason" value="${r}" required />
      <span>${r}</span>
    </label>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Unsubscribe — ${brandName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      background:#F0EDE6;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(10,11,13,.12);
      max-width:440px;width:100%;overflow:hidden}
    .header{background:linear-gradient(135deg,#0A0B0D 0%,#B8935B 55%,#1C1812 100%);
      padding:24px 32px}
    .logo-wrap{display:flex;align-items:center;gap:12px}
    .logo-box{width:40px;height:40px;background:#0A0B0D;border-radius:8px;
      border:1px solid rgba(184,147,91,.35);display:flex;align-items:center;
      justify-content:center;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#F4F1EB;flex-shrink:0}
    .brand-name{font-family:Georgia,serif;font-size:16px;letter-spacing:2px;color:#F4F1EB}
    .brand-tag{font-size:9px;color:rgba(184,147,91,.80);letter-spacing:1.8px;text-transform:uppercase;margin-top:3px}
    .body{padding:32px}
    h1{font-size:20px;font-weight:700;color:#1e293b;margin-bottom:8px}
    .sub{font-size:14px;color:#64748b;margin-bottom:24px;line-height:1.5}
    .email-pill{display:inline-block;background:#f1f5f9;border-radius:99px;
      padding:4px 12px;font-size:13px;font-weight:600;color:#334155;margin-bottom:24px}
    .reason-label{display:flex;align-items:center;gap:10px;padding:11px 14px;
      border:1.5px solid #e2e8f0;border-radius:10px;margin-bottom:8px;cursor:pointer;
      font-size:14px;color:#374151;transition:border-color .15s,background .15s}
    .reason-label:hover{border-color:${primaryColor};background:rgba(184,147,91,.06)}
    .reason-label input{accent-color:${primaryColor};width:16px;height:16px;flex-shrink:0}
    .other-input{display:none;width:100%;margin-top:8px;padding:10px 14px;
      border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none}
    .other-input:focus{border-color:${primaryColor}}
    .error{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;
      padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
    .btn{width:100%;padding:13px;background:${primaryColor};color:#fff;border:none;
      border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;margin-top:16px;
      transition:opacity .15s}
    .btn:hover{opacity:.88}
    .footer{padding:16px 32px 24px;text-align:center;font-size:12px;color:#94a3b8}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-wrap">
        <div class="logo-box">C<span style="display:inline-block;width:5px;height:5px;background:#B8935B;border-radius:50%;font-size:0;vertical-align:middle;margin-left:-7px">&nbsp;</span></div>
        <div>
          <div class="brand-name">${brandName.toUpperCase()}</div>
          <div class="brand-tag">Career Booster Services</div>
        </div>
      </div>
    </div>
    <div class="body">
      <h1>Unsubscribe</h1>
      <p class="sub">We're sorry to see you go. Before you leave, could you let us know why?</p>
      <div class="email-pill">${email}</div>
      ${error ? `<div class="error">${error}</div>` : ''}
      <form method="POST" action="/api/public/unsubscribe" onsubmit="return validate()">
        <input type="hidden" name="lead" value="${leadId}" />
        ${options}
        <input class="other-input" id="other-input" type="text" name="otherText" placeholder="Please tell us more…" maxlength="200" />
        <button type="submit" class="btn">Unsubscribe me</button>
      </form>
    </div>
    <div class="footer">You will no longer receive marketing emails from ${brandName}.</div>
  </div>
  <script>
    document.querySelectorAll('input[name=reason]').forEach(function(r){
      r.addEventListener('change',function(){
        var o=document.getElementById('other-input');
        o.style.display=this.value==='Other'?'block':'none';
        if(this.value!=='Other')o.value='';
      });
    });
    function validate(){
      var r=document.querySelector('input[name=reason]:checked');
      if(!r){alert('Please select a reason.');return false;}
      if(r.value==='Other'&&!document.getElementById('other-input').value.trim()){
        alert('Please describe your reason.');return false;
      }
      return true;
    }
  </script>
</body>
</html>`;
}

function confirmedPage(email: string, brandName: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Unsubscribed — ${brandName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      background:#F0EDE6;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(10,11,13,.12);
      max-width:400px;width:100%;text-align:center;padding:48px 32px}
    .check{width:64px;height:64px;background:#ecfdf5;border-radius:50%;
      display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px}
    h1{font-size:22px;font-weight:700;color:#1e293b;margin-bottom:8px}
    p{font-size:14px;color:#64748b;line-height:1.6}
    .email{font-weight:600;color:#374151}
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h1>You've been unsubscribed</h1>
    <p><span class="email">${email}</span> has been removed from our mailing list.<br/>You won't receive any more marketing emails from ${brandName}.</p>
  </div>
</body>
</html>`;
}

// GET — show reason selection page
export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get('lead');
  if (!leadId) return new NextResponse('Invalid link.', { status: 400 });

  try {
    const lead = await db.flywheelCampaignLead.findUnique({
      where: { id: leadId },
      include: { contact: true, campaign: true },
    });
    if (!lead || !lead.contact.email) return new NextResponse('Link expired or invalid.', { status: 404 });

    return new NextResponse(
      reasonPage(leadId, lead.contact.email, lead.campaign.brandId === 'ripple_nexus' ? 'Ripple Nexus' : 'Catalyst', '#B8935B'),
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch {
    return new NextResponse('An error occurred.', { status: 500 });
  }
}

// POST — save reason and perform unsubscribe
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const leadId  = form.get('lead') as string | null;
    const reason  = form.get('reason') as string | null;
    const otherText = (form.get('otherText') as string | null)?.trim();

    if (!leadId || !reason) {
      return new NextResponse('Missing fields.', { status: 400 });
    }

    const lead = await db.flywheelCampaignLead.findUnique({
      where: { id: leadId },
      include: { contact: true, campaign: true },
    });

    if (!lead || !lead.contact.email) {
      return new NextResponse('Link expired or invalid.', { status: 404 });
    }

    const email   = lead.contact.email;
    const brandId = lead.campaign.brandId;
    const brandName = brandId === 'ripple_nexus' ? 'Ripple Nexus' : 'Catalyst';
    const finalReason = reason === 'Other' && otherText ? otherText : reason;

    await db.$transaction(async (tx) => {
      // 1. Add to global unsubscribe list with reason
      await tx.unsubscribeList.upsert({
        where: { email_brandId: { email, brandId } },
        update: { reason: finalReason },
        create: { email, brandId, reason: finalReason },
      });

      // 2. Mark campaign lead as unsubscribed
      await tx.flywheelCampaignLead.update({
        where: { id: lead.id },
        data: { status: 'UNSUBSCRIBED' },
      });

      // 3. Record event
      await tx.flywheelEmailEvent.create({
        data: { campaignLeadId: lead.id, eventType: 'UNSUBSCRIBE' },
      });

      // 4. Revoke marketing permission on the flywheel profile
      await tx.flywheelProfile.updateMany({
        where: { contactId: lead.contact.id },
        data: { optInStatus: false },
      });
    });

    return new NextResponse(confirmedPage(email, brandName), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch {
    return new NextResponse('An error occurred. Please try again.', { status: 500 });
  }
}
