// src/lib/marketing/templates.ts
// Conversion-oriented email template library. Each template's `bodyHtml` is the
// INNER body only — sendMarketingEmail() wraps it in the premium branded shell
// (logo header, accent bar, footer + one-click unsubscribe). Bodies use merge
// tags ({{firstName}}, {{brandName}}) resolved by personalize() at send time,
// and email-safe inline styles / table buttons so they render everywhere.

export type TemplateCategory = 'WIN_BACK' | 'CONVERT_NEW' | 'GROW_EXISTING' | 'SEASONAL';

export interface MarketingTemplate {
  id: string;
  category: TemplateCategory;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  WIN_BACK:      'Win back old / dormant clients',
  CONVERT_NEW:   'Convert new leads',
  GROW_EXISTING: 'Grow existing clients',
  SEASONAL:      'Seasonal & lifecycle',
};

// ── Base URLs for CTAs (Catalyst-facing marketing) ───────────────────────────
const URL = 'https://clientforge.theripplenexus.com';
const LINK = {
  checkout:  `${URL}/checkout`,
  inquire:   `${URL}/inquire`,
  portal:    `${URL}/portal/dashboard`,
  reviews:   `${URL}/reviews`,
  referrals: `${URL}/referrals`,
};

// ── Email-safe building blocks ───────────────────────────────────────────────
const eyebrow = (t: string) =>
  `<p style="margin:0 0 10px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#B8935B;font-weight:700;">${t}</p>`;
const h1 = (t: string) =>
  `<h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#1a202c;font-weight:700;">${t}</h1>`;
const p = (t: string) =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#4a5568;">${t}</p>`;
const muted = (t: string) =>
  `<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#94a3b8;">${t}</p>`;
const bullets = (items: string[]) =>
  `<ul style="margin:0 0 18px;padding-left:20px;">${items
    .map(i => `<li style="font-size:15px;line-height:1.7;color:#4a5568;margin-bottom:6px;">${i}</li>`)
    .join('')}</ul>`;
const divider = () =>
  `<div style="height:1px;background:#EDE9DF;margin:22px 0;line-height:0;font-size:0;">&nbsp;</div>`;
const offerBox = (t: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="background:#FBF8F3;border:1px solid #F0EAE0;border-radius:12px;padding:18px 20px;font-size:15px;line-height:1.6;color:#4a5568;">${t}</td></tr></table>`;
const quote = (t: string, author: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="border-left:3px solid #B8935B;padding:6px 0 6px 16px;"><p style="margin:0 0 6px;font-family:Georgia,serif;font-style:italic;font-size:16px;line-height:1.6;color:#4a5568;">&ldquo;${t}&rdquo;</p><p style="margin:0;font-size:12px;font-weight:700;color:#B8935B;letter-spacing:0.5px;">— ${author}</p></td></tr></table>`;
const btn = (label: string, url: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr><td align="center" bgcolor="#B8935B" style="border-radius:10px;background:linear-gradient(135deg,#B8935B 0%,#9A7540 100%);"><a href="${url}" style="display:inline-block;padding:14px 34px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">${label}</a></td></tr></table>`;
const greet = (t: string) => p(`Hi {{firstName}},`) + t;
const signoff = () => p(`Warm regards,<br/><strong style="color:#1a202c;">The {{brandName}} Team</strong>`);

const compose = (...parts: string[]) => parts.join('\n');

// ── Templates ────────────────────────────────────────────────────────────────
export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  // ═══ WIN BACK ═══════════════════════════════════════════════════════════════
  {
    id: 'winback-we-miss-you',
    category: 'WIN_BACK',
    name: 'We miss you',
    description: 'Warm re-engagement for past clients who have gone quiet.',
    subject: 'We were just thinking about you, {{firstName}}',
    bodyHtml: compose(
      eyebrow('It’s been a while'),
      h1('Your career story isn’t finished'),
      greet(p('It’s been some time since we last worked together — and a lot can change in a few months. New role in mind? A promotion on the horizon? We’d love to help you take the next step.')),
      p('Your details are still on file, so picking back up is effortless.'),
      btn('Start where you left off', LINK.portal),
      signoff(),
    ),
  },
  {
    id: 'winback-career-checkup',
    category: 'WIN_BACK',
    name: 'Career check-up',
    description: 'Positions a refresh as a proactive career health check.',
    subject: 'When did you last give your resume a check-up?',
    bodyHtml: compose(
      eyebrow('Career check-up'),
      h1('Is your resume still working as hard as you are?'),
      greet(p('Roles evolve, skills stack up, and the market shifts. A resume that landed you your last role may already be a step behind where you are today.')),
      bullets(['New achievements you haven’t captured yet', 'Keywords recruiters are searching for right now', 'A sharper story for the role you want next']),
      btn('Refresh my resume', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'winback-new-year-move',
    category: 'WIN_BACK',
    name: 'New year, new role',
    description: 'January re-engagement tied to fresh-start motivation.',
    subject: 'Make this the year you make the move',
    bodyHtml: compose(
      eyebrow('New year'),
      h1('A new year is the perfect runway'),
      greet(p('January is when hiring managers open new budgets and the best roles hit the market. The candidates who move first, win first.')),
      p('Let’s make sure your resume and LinkedIn are ready before the rush.')
        ,
      btn('Get interview-ready', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'winback-anniversary-refresh',
    category: 'WIN_BACK',
    name: 'One-year refresh',
    description: 'Anniversary nudge with a returning-client refresh offer.',
    subject: 'It’s been a year — time for a refresh?',
    bodyHtml: compose(
      eyebrow('Anniversary'),
      h1('A year of growth deserves an updated story'),
      greet(p('It’s been about a year since we crafted your documents. If you’ve grown, taken on more, or shifted direction — your resume should reflect it.')),
      offerBox('<strong>Returning-client refresh:</strong> a fully updated resume at a special rate, because you’re already part of the family.'),
      btn('Claim my refresh', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'winback-comeback-offer',
    category: 'WIN_BACK',
    name: 'Comeback offer',
    description: 'Exclusive discount to reactivate dormant clients.',
    subject: 'A little something to welcome you back, {{firstName}}',
    bodyHtml: compose(
      eyebrow('Exclusive'),
      h1('Welcome back — this one’s on us'),
      greet(p('We’d genuinely love to work with you again, so here’s an exclusive offer reserved for past clients.')),
      offerBox('<strong style="color:#B8935B;font-size:18px;">Special returning-client pricing</strong><br/>Available for the next 7 days — just for you.'),
      btn('Redeem my offer', LINK.checkout),
      muted('Offer valid for 7 days from the date of this email.'),
      signoff(),
    ),
  },
  {
    id: 'winback-whats-new',
    category: 'WIN_BACK',
    name: 'What’s new at Catalyst',
    description: 'Re-introduces new services to lapsed clients.',
    subject: 'We’ve added a few things you’ll want to see',
    bodyHtml: compose(
      eyebrow('What’s new'),
      h1('We’ve grown since we last spoke'),
      greet(p('We’ve been busy building new ways to help you stand out:')),
      bullets(['Portfolio websites that showcase your work', 'Deep LinkedIn optimisation with custom banners', 'Executive-tier positioning for senior roles']),
      btn('See what’s new', LINK.inquire),
      signoff(),
    ),
  },

  // ═══ CONVERT NEW LEADS ═══════════════════════════════════════════════════════
  {
    id: 'lead-abandoned-1',
    category: 'CONVERT_NEW',
    name: 'Abandoned checkout — reminder',
    description: 'Gentle 1-hour nudge for an unfinished checkout.',
    subject: 'You left something behind, {{firstName}}',
    bodyHtml: compose(
      eyebrow('Almost there'),
      h1('Your order is waiting for you'),
      greet(p('You were moments away from investing in your career — then life happened. No worries, we saved your spot.')),
      p('Your selection is still ready. Pick up right where you left off.'),
      btn('Complete my order', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'lead-abandoned-2',
    category: 'CONVERT_NEW',
    name: 'Abandoned checkout — urgency',
    description: '24-hour follow-up with gentle scarcity.',
    subject: 'Still thinking it over?',
    bodyHtml: compose(
      eyebrow('A quick nudge'),
      h1('The best time to act is before the role is posted'),
      greet(p('Opportunities don’t wait — and neither should your job search. The candidates who are ready when a role opens are the ones who get the interview.')),
      p('Your order is still saved, but our delivery calendar fills quickly.'),
      btn('Secure my spot', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'lead-abandoned-3',
    category: 'CONVERT_NEW',
    name: 'Abandoned checkout — social proof',
    description: 'Final 72-hour nudge backed by results.',
    subject: 'What our clients say (and one last nudge)',
    bodyHtml: compose(
      eyebrow('Last reminder'),
      h1('Don’t just take our word for it'),
      greet(p('Before your saved order expires, here’s what clients like you experienced:')),
      quote('Three interview calls in the first week after my new resume went out. I only wish I’d done it sooner.', 'A recent Catalyst client'),
      btn('Complete my order', LINK.checkout),
      muted('This is the last reminder we’ll send about your saved order.'),
      signoff(),
    ),
  },
  {
    id: 'lead-post-inquiry',
    category: 'CONVERT_NEW',
    name: 'Post-inquiry nurture',
    description: 'Value-first follow-up after someone inquires.',
    subject: 'Thanks for reaching out, {{firstName}} — here’s what’s next',
    bodyHtml: compose(
      eyebrow('Great to meet you'),
      h1('Let’s get your career moving'),
      greet(p('Thanks for reaching out. Here’s how we help professionals like you land better roles, faster:')),
      bullets(['A resume engineered to pass ATS filters and impress humans', 'A LinkedIn profile that brings recruiters to you', 'Positioning tailored to the exact roles you want']),
      btn('Explore packages', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'lead-first-purchase-offer',
    category: 'CONVERT_NEW',
    name: 'First-purchase offer',
    description: 'Welcome discount to convert a first-time buyer.',
    subject: 'A welcome gift for your first step',
    bodyHtml: compose(
      eyebrow('Welcome offer'),
      h1('Your first step, made easier'),
      greet(p('Investing in yourself is the smartest move you can make — so let’s make your first one easy.')),
      offerBox('<strong style="color:#B8935B;font-size:18px;">A special welcome rate</strong><br/>on your first order with Catalyst.'),
      btn('Start now', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'lead-social-proof',
    category: 'CONVERT_NEW',
    name: 'Results & social proof',
    description: 'Builds trust with outcomes and testimonials.',
    subject: 'How professionals like you are landing interviews',
    bodyHtml: compose(
      eyebrow('Proven results'),
      h1('Real people. Real callbacks.'),
      greet(p('The difference a strategically written resume makes isn’t subtle:')),
      quote('I went from silence to five interviews in two weeks. The investment paid for itself immediately.', 'Catalyst client, Product Manager'),
      p('Ready to write your own success story?'),
      btn('Get started', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'lead-objection-buster',
    category: 'CONVERT_NEW',
    name: 'Objection buster',
    description: 'Addresses hesitation with reassurance and revisions.',
    subject: 'Worried it won’t make a difference?',
    bodyHtml: compose(
      eyebrow('Let’s be honest'),
      h1('We get it — you’ve been burned before'),
      greet(p('Maybe you’ve tried templates, or a service that delivered something generic. That’s exactly why we work differently:')),
      bullets(['Every document is written from scratch around your goals', 'Revisions are included until it’s right', 'Real strategists, not a template generator']),
      btn('See how we work', LINK.inquire),
      signoff(),
    ),
  },

  // ═══ GROW EXISTING CLIENTS ═══════════════════════════════════════════════════
  {
    id: 'grow-upsell-linkedin',
    category: 'GROW_EXISTING',
    name: 'Upsell — LinkedIn',
    description: 'Encourages resume clients to add LinkedIn optimisation.',
    subject: 'Your resume is ready — now let recruiters find you',
    bodyHtml: compose(
      eyebrow('Complete the picture'),
      h1('87% of recruiters check LinkedIn first'),
      greet(p('Your resume is sharp — but most recruiters will look you up on LinkedIn before they ever open it. An unoptimised profile quietly costs you opportunities.')),
      p('We’ll transform your headline, About section, and experience into a magnet for the right roles — plus a custom banner.'),
      btn('Optimise my LinkedIn', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'grow-upsell-portfolio',
    category: 'GROW_EXISTING',
    name: 'Upsell — Portfolio website',
    description: 'Offers a portfolio site to showcase work online.',
    subject: 'Stand out with a portfolio that speaks for you',
    bodyHtml: compose(
      eyebrow('Go beyond the resume'),
      h1('Give your work a home online'),
      greet(p('For senior and creative roles, a personal portfolio website is the edge that sets you apart. It’s the difference between telling people you’re great and showing them.')),
      p('We design and build a clean, professional site that showcases your projects and personal brand.'),
      btn('See portfolio packages', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'grow-referral-ask',
    category: 'GROW_EXISTING',
    name: 'Referral request',
    description: 'Invites happy clients to refer friends for mutual reward.',
    subject: 'Know someone who deserves a career glow-up?',
    bodyHtml: compose(
      eyebrow('Refer a friend'),
      h1('Great careers are contagious'),
      greet(p('If we helped you, chances are you know someone else who’s ready for their next move. Refer them — and you both benefit.')),
      offerBox('Share your referral link. When a friend orders, <strong>you both get rewarded.</strong>'),
      btn('Get my referral link', LINK.referrals),
      signoff(),
    ),
  },
  {
    id: 'grow-review-request',
    category: 'GROW_EXISTING',
    name: 'Review request',
    description: 'Asks satisfied clients for a testimonial/review.',
    subject: 'Mind sharing how it went, {{firstName}}?',
    bodyHtml: compose(
      eyebrow('Your opinion matters'),
      h1('How did we do?'),
      greet(p('We hope your new documents are already opening doors. If they’ve helped, would you take a moment to share your experience? It means the world to us — and helps others take the leap.')),
      btn('Leave a quick review', LINK.reviews),
      signoff(),
    ),
  },
  {
    id: 'grow-tier-upgrade',
    category: 'GROW_EXISTING',
    name: 'Tier upgrade',
    description: 'Nudges established clients toward executive positioning.',
    subject: 'Ready to position yourself for leadership?',
    bodyHtml: compose(
      eyebrow('Level up'),
      h1('Senior roles need senior positioning'),
      greet(p('As you move up, the way you present yourself has to move up too. Executive-tier writing reframes your experience around leadership, impact, and vision — the language that opens director and C-suite doors.')),
      btn('Explore executive tier', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'grow-addon-coverletter',
    category: 'GROW_EXISTING',
    name: 'Add-on — Cover letter',
    description: 'Offers a tailored cover letter add-on.',
    subject: 'One thing that still gets you noticed',
    bodyHtml: compose(
      eyebrow('Small add, big edge'),
      h1('A tailored cover letter still moves the needle'),
      greet(p('For competitive roles, a compelling cover letter is often the tiebreaker. We’ll craft one that connects your story directly to the role you’re chasing.')),
      btn('Add a cover letter', LINK.checkout),
      signoff(),
    ),
  },

  // ═══ SEASONAL & LIFECYCLE ════════════════════════════════════════════════════
  {
    id: 'seasonal-festive-offer',
    category: 'SEASONAL',
    name: 'Festive offer',
    description: 'Festive-season promotion (Diwali / holidays).',
    subject: 'A festive gift for your future self 🎉',
    bodyHtml: compose(
      eyebrow('Festive season'),
      h1('Celebrate the season — and your next chapter'),
      greet(p('This festive season, give your future self the gift that keeps giving: a career that moves forward.')),
      offerBox('<strong style="color:#B8935B;font-size:18px;">Festive special</strong><br/>A limited-time offer to start your next chapter.'),
      btn('Unwrap the offer', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'seasonal-hiring-season',
    category: 'SEASONAL',
    name: 'Hiring season push',
    description: 'Timed for peak hiring windows (Jan / Sep).',
    subject: 'Hiring season is here — are you ready?',
    bodyHtml: compose(
      eyebrow('Peak hiring'),
      h1('The roles are opening. Be first.'),
      greet(p('Companies are filling budgets and posting new roles right now. This is the window where a strong resume and profile pay off the most.')),
      p('Don’t let a rushed application cost you the role. Let’s get you ready this week.'),
      btn('Get ready now', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'seasonal-milestone-thankyou',
    category: 'SEASONAL',
    name: 'Milestone thank-you',
    description: 'Warm thank-you after delivery to build loyalty.',
    subject: 'Thank you for trusting us, {{firstName}}',
    bodyHtml: compose(
      eyebrow('Thank you'),
      h1('It was a pleasure working with you'),
      greet(p('Your documents are delivered — and we couldn’t be prouder of how they turned out. Thank you for trusting us with something as important as your career.')),
      p('We’re always here for your next step, whenever it comes.'),
      btn('Visit your portal', LINK.portal),
      signoff(),
    ),
  },
  {
    id: 'seasonal-birthday',
    category: 'SEASONAL',
    name: 'Birthday wish',
    description: 'Birthday greeting with a small gift.',
    subject: 'Happy birthday, {{firstName}}! 🎂',
    bodyHtml: compose(
      eyebrow('Happy birthday'),
      h1('Here’s to you, {{firstName}}'),
      greet(p('Wishing you a wonderful birthday from all of us. May this year bring the growth, recognition, and opportunities you deserve.')),
      offerBox('🎁 <strong>A little birthday gift:</strong> a special rate on your next order, valid all month.'),
      btn('Claim my birthday gift', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'seasonal-testimonial-spotlight',
    category: 'SEASONAL',
    name: 'Testimonial spotlight',
    description: 'Features a client win to inspire action.',
    subject: 'From overlooked to offer letter',
    bodyHtml: compose(
      eyebrow('Client spotlight'),
      h1('This could be your story next'),
      greet(p('We love sharing wins from our community. Here’s one that stuck with us:')),
      quote('After months of silence, I landed two offers within three weeks of my Catalyst rewrite. It changed everything.', 'Catalyst client, Data Analyst'),
      btn('Start my success story', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'seasonal-year-end-review',
    category: 'SEASONAL',
    name: 'Year-end reflection',
    description: 'End-of-year reflection that leads into a fresh plan.',
    subject: 'Before the year ends, {{firstName}}…',
    bodyHtml: compose(
      eyebrow('Year in review'),
      h1('What do you want next year to look like?'),
      greet(p('As the year winds down, it’s worth asking: is your career where you hoped it would be? If the answer is “not quite,” next year can be different — and it starts with being ready.')),
      p('Let’s set you up to make your move early.'),
      btn('Plan my next move', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'seasonal-weekend-flash',
    category: 'SEASONAL',
    name: 'Weekend flash sale',
    description: 'Short-window weekend promotion with urgency.',
    subject: 'This weekend only, {{firstName}} ⏳',
    bodyHtml: compose(
      eyebrow('48 hours only'),
      h1('A weekend worth acting on'),
      greet(p('For this weekend only, we’re running a special rate on our most popular packages. Come Monday, it’s gone.')),
      offerBox('<strong style="color:#B8935B;font-size:18px;">Weekend-only pricing</strong><br/>Ends Sunday at midnight.'),
      btn('Grab the weekend rate', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'nurture-linkedin-tips',
    category: 'CONVERT_NEW',
    name: 'Value — LinkedIn tips',
    description: 'Pure-value nurture that builds trust before selling.',
    subject: '3 LinkedIn tweaks that get you noticed',
    bodyHtml: compose(
      eyebrow('Free value'),
      h1('3 quick LinkedIn wins you can do today'),
      greet(p('No pitch today — just three changes that consistently help our clients get seen:')),
      bullets([
        '<strong>Headline:</strong> lead with the value you deliver, not just your job title',
        '<strong>About:</strong> write in first person and open with a hook, not a summary',
        '<strong>Keywords:</strong> mirror the exact terms in the jobs you want',
      ]),
      p('Want us to handle it end-to-end? We’re here when you’re ready.'),
      btn('See LinkedIn packages', LINK.checkout),
      signoff(),
    ),
  },
];

export function getTemplatesByCategory(category: TemplateCategory): MarketingTemplate[] {
  return MARKETING_TEMPLATES.filter(t => t.category === category);
}

export function getTemplateById(id: string): MarketingTemplate | undefined {
  return MARKETING_TEMPLATES.find(t => t.id === id);
}

// ── Drip sequences ───────────────────────────────────────────────────────────
// A sequence is an ordered set of templates with delays. Launching one creates a
// DRIP FlywheelCampaign whose steps the existing cron (process-campaigns) sends
// automatically, one after another, at the given delays.
export interface SequenceStep { templateId: string; delayHours: number }
export interface MarketingSequence {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  steps: SequenceStep[];
}

export const MARKETING_SEQUENCES: MarketingSequence[] = [
  {
    id: 'seq-abandoned-checkout',
    name: 'Abandoned Checkout Recovery',
    description: 'Three-touch recovery for people who started checkout but didn’t finish.',
    category: 'CONVERT_NEW',
    steps: [
      { templateId: 'lead-abandoned-1', delayHours: 1 },
      { templateId: 'lead-abandoned-2', delayHours: 24 },
      { templateId: 'lead-abandoned-3', delayHours: 72 },
    ],
  },
  {
    id: 'seq-new-lead-nurture',
    name: 'New Lead Nurture',
    description: 'Warm up a fresh inquiry with value, proof, and a clear offer.',
    category: 'CONVERT_NEW',
    steps: [
      { templateId: 'lead-post-inquiry',   delayHours: 1 },
      { templateId: 'nurture-linkedin-tips', delayHours: 48 },
      { templateId: 'lead-social-proof',   delayHours: 96 },
      { templateId: 'lead-first-purchase-offer', delayHours: 144 },
    ],
  },
  {
    id: 'seq-winback',
    name: 'Win-Back (Dormant Clients)',
    description: 'Re-engage past clients and bring them back with a returning-client offer.',
    category: 'WIN_BACK',
    steps: [
      { templateId: 'winback-we-miss-you',    delayHours: 0 },
      { templateId: 'winback-career-checkup', delayHours: 72 },
      { templateId: 'winback-comeback-offer', delayHours: 168 },
    ],
  },
  {
    id: 'seq-post-delivery-grow',
    name: 'Post-Delivery — Grow & Refer',
    description: 'Thank clients after delivery, ask for a review, then invite referrals & upsells.',
    category: 'GROW_EXISTING',
    steps: [
      { templateId: 'seasonal-milestone-thankyou', delayHours: 0 },
      { templateId: 'grow-review-request',         delayHours: 72 },
      { templateId: 'grow-referral-ask',           delayHours: 120 },
      { templateId: 'grow-upsell-linkedin',        delayHours: 240 },
    ],
  },
];

export function getSequenceById(id: string): MarketingSequence | undefined {
  return MARKETING_SEQUENCES.find(s => s.id === id);
}
