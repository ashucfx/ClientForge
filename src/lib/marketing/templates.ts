// src/lib/marketing/templates.ts
// Conversion-oriented email template library. Each template's `bodyHtml` is the
// INNER body only — sendMarketingEmail() wraps it in the premium branded shell
// (logo header, accent bar, footer + one-click unsubscribe). Bodies use merge
// tags ({{firstName}}, {{brandName}}) resolved by personalize() at send time,
// and email-safe inline styles / table buttons so they render everywhere.

export type TemplateCategory = 'WIN_BACK' | 'CONVERT_NEW' | 'GROW_EXISTING' | 'SEASONAL' | 'EXECUTIVE' | 'MID_CAREER';

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
  EXECUTIVE:     'Executive & C-suite',
  MID_CAREER:    'Mid-career professionals',
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

  // ═══ EXECUTIVE & C-SUITE ═════════════════════════════════════════════════════
  {
    id: 'exec-invisible-leaders',
    category: 'EXECUTIVE',
    name: 'The invisible leader',
    description: 'For accomplished executives whose resume undersells their impact.',
    subject: 'The most accomplished leaders are often the hardest to find on paper',
    bodyHtml: compose(
      eyebrow('Executive brand'),
      h1('Your track record speaks. Does your resume?'),
      greet(p('You’ve led teams, shaped strategy, and delivered outcomes that moved the business — yet most executive resumes read like a list of duties, burying the very impact that sets you apart.')),
      p('At the executive level, positioning is everything. We reframe your career around scale, influence, and measurable results.'),
      bullets(['A narrative led by business impact, not job descriptions', 'Board- and investor-ready language', 'Outcomes quantified to signal the scale you operate at']),
      btn('Elevate my executive brand', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'exec-headhunter-magnet',
    category: 'EXECUTIVE',
    name: 'Get found by headhunters',
    description: 'Positioning to attract retained executive search firms.',
    subject: 'Do executive search firms know you exist?',
    bodyHtml: compose(
      eyebrow('Executive search'),
      h1('Get on the radar of the firms that place leaders'),
      greet(p('The best executive roles are never advertised — they’re filled by retained search firms working from targeted lists. If your resume and LinkedIn aren’t built for how headhunters search, you’re invisible to them.')),
      bullets(['Keyword architecture tuned to executive search', 'A LinkedIn profile that pulls inbound interest', 'Language that reads as “leadership,” not “management”']),
      btn('Get found by headhunters', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'exec-board-ready',
    category: 'EXECUTIVE',
    name: 'Board-ready positioning',
    description: 'For senior leaders pursuing board or advisory seats.',
    subject: 'Positioning yourself for the boardroom',
    bodyHtml: compose(
      eyebrow('Board & advisory'),
      h1('Ready for a seat at the table?'),
      greet(p('A board or advisory role demands a very different narrative than an operating one — governance, oversight, and strategic value over day-to-day execution. Most resumes never make that shift.')),
      p('We craft the positioning that signals you’re ready to govern, not just to run.'),
      btn('Build my board profile', LINK.inquire),
      signoff(),
    ),
  },
  {
    id: 'exec-executive-presence',
    category: 'EXECUTIVE',
    name: 'Executive presence',
    description: 'Frames resume + LinkedIn as executive presence on paper.',
    subject: 'Executive presence starts before you enter the room',
    bodyHtml: compose(
      eyebrow('Executive presence'),
      h1('Your brand arrives before you do'),
      greet(p('By the time you walk into the room, decision-makers have already read your resume and looked you up on LinkedIn. That first impression is your executive presence on paper — and it sets the tone for everything that follows.')),
      p('We make sure it commands the respect your leadership has earned.')
        ,
      btn('Sharpen my executive presence', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'exec-confidential-search',
    category: 'EXECUTIVE',
    name: 'Discreet / confidential search',
    description: 'White-glove reassurance for employed senior leaders exploring quietly.',
    subject: 'A discreet way to explore your next move',
    bodyHtml: compose(
      eyebrow('Confidential'),
      h1('Exploring quietly? We understand.'),
      greet(p('For senior leaders still in seat, discretion isn’t optional. Our executive engagements are handled privately, one-to-one — no public job boards, no exposure, no risk to your current role.')),
      p('When the right opportunity appears, you’ll be ready to move — quietly and decisively.'),
      btn('Start a private conversation', LINK.inquire),
      signoff(),
    ),
  },
  {
    id: 'exec-comp-negotiation',
    category: 'EXECUTIVE',
    name: 'Command your worth',
    description: 'Positioning as leverage for higher executive compensation.',
    subject: 'Are you leaving compensation on the table?',
    bodyHtml: compose(
      eyebrow('Your value'),
      h1('Position yourself for what you’re worth'),
      greet(p('At the executive level, compensation follows perceived value — and perceived value follows positioning. A resume that frames you as a cost centre negotiates very differently from one that frames you as a driver of growth.')),
      p('We build the case for your value before the conversation ever starts.'),
      btn('Strengthen my position', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'exec-linkedin-authority',
    category: 'EXECUTIVE',
    name: 'LinkedIn authority',
    description: 'Turns an executive LinkedIn profile into visible authority.',
    subject: 'Turn your LinkedIn into executive authority',
    bodyHtml: compose(
      eyebrow('Thought leadership'),
      h1('From profile to presence'),
      greet(p('For a leader, LinkedIn is no longer optional — it’s where your reputation is researched, your network compounds, and opportunities quietly begin. A dated profile undercuts all of it.')),
      bullets(['A headline and About that establish authority in seconds', 'Experience reframed around vision and impact', 'A custom banner that looks the part']),
      btn('Command my LinkedIn', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'exec-plus-bespoke',
    category: 'EXECUTIVE',
    name: 'Premium Plus — bespoke',
    description: 'Ultra-premium, white-glove positioning for top-tier leaders.',
    subject: 'A bespoke executive brand, for leaders at the very top',
    bodyHtml: compose(
      eyebrow('Premium Plus · exclusive'),
      h1('White-glove, from first word to final polish'),
      greet(p('For leaders operating at the pinnacle of their field, a template will never do. Our Premium Plus engagement is fully bespoke — crafted to speak to boards, investors, and the world’s most discerning executive search firms.')),
      bullets(['A resume, LinkedIn, and portfolio built as one coherent brand', 'Unlimited revisions until every word is right', 'A dedicated strategist and complete confidentiality']),
      btn('Explore Premium Plus', LINK.inquire),
      signoff(),
    ),
  },

  // ═══ MID-CAREER PROFESSIONALS ════════════════════════════════════════════════
  {
    id: 'midcareer-stuck',
    category: 'MID_CAREER',
    name: 'Feeling stuck',
    description: 'For mid-career professionals plateaued at the same level.',
    subject: 'Feeling stuck at the same level?',
    bodyHtml: compose(
      eyebrow('Your next level'),
      h1('You’ve outgrown your resume'),
      greet(p('You’ve grown a lot since you last updated your resume — new skills, bigger projects, real results. If it still reads like the role you were in three years ago, it’s quietly holding you back.')),
      p('Let’s make sure your story matches where you are now — and where you’re headed.'),
      btn('Update my story', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-market-value',
    category: 'MID_CAREER',
    name: 'Know your worth',
    description: 'Highlights that a weak resume undersells real market value.',
    subject: 'You might be worth more than your resume says',
    bodyHtml: compose(
      eyebrow('Your value'),
      h1('Underselling yourself by accident?'),
      greet(p('Most professionals list what they did — not what it was worth. That gap is the difference between “does the job” and “clearly deserves more.”')),
      p('We translate your experience into the language of value, so the market sees your full worth.'),
      btn('Show my true value', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-promotion-ready',
    category: 'MID_CAREER',
    name: 'Promotion-ready',
    description: 'Positioning to look ready for the next level up.',
    subject: 'Ready for the next level? Look like it.',
    bodyHtml: compose(
      eyebrow('Level up'),
      h1('Position yourself one rung up'),
      greet(p('The candidates who get promoted — internally or elsewhere — are the ones who already look like they’re operating at the next level. Your resume should show scope and impact, not just tasks.')),
      p('We reframe your experience so the promotion feels obvious.'),
      btn('Position for the next level', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-pivot',
    category: 'MID_CAREER',
    name: 'Career pivot',
    description: 'For professionals changing industry or function.',
    subject: 'Thinking about a change of direction?',
    bodyHtml: compose(
      eyebrow('New direction'),
      h1('Make your experience translate'),
      greet(p('Switching industries or roles is hard when your resume speaks the language of your old world. The secret isn’t hiding your background — it’s reframing it around transferable, in-demand strengths.')),
      p('We help the hiring manager see exactly why you fit, not why you’re different.'),
      btn('Reposition for my pivot', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-recruiter-ready',
    category: 'MID_CAREER',
    name: 'Make recruiters chase you',
    description: 'Recruiter-optimised resume + LinkedIn.',
    subject: 'Make recruiters do the chasing',
    bodyHtml: compose(
      eyebrow('Get found'),
      h1('Get found for the roles you want'),
      greet(p('The best job search is the one where recruiters come to you. That only happens when your resume clears the ATS and your LinkedIn surfaces for the right searches.')),
      bullets(['ATS-optimised so you’re not filtered out', 'Keyword-aligned to the roles you’re targeting', 'A LinkedIn that turns up in recruiter searches']),
      btn('Get recruiter-ready', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-quantify-impact',
    category: 'MID_CAREER',
    name: 'Results, not responsibilities',
    description: 'Turning duties into quantified achievements.',
    subject: 'Turn “responsible for” into “responsible for $2M”',
    bodyHtml: compose(
      eyebrow('Prove your impact'),
      h1('Results speak louder than responsibilities'),
      greet(p('“Responsible for managing a team” tells a hiring manager nothing. “Led a team of 8 that grew revenue 30%” tells them everything. The difference is numbers — and most resumes are missing them.')),
      p('We dig out the metrics that make your experience undeniable.'),
      btn('Quantify my impact', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-confidence',
    category: 'MID_CAREER',
    name: 'Own your achievements',
    description: 'Reassurance for professionals who undersell themselves.',
    subject: 'You’ve achieved more than you give yourself credit for',
    bodyHtml: compose(
      eyebrow('Own it'),
      h1('Your work deserves better words'),
      greet(p('If writing about yourself feels awkward — like bragging — you’re not alone. That discomfort is exactly why so many capable professionals end up with modest, forgettable resumes.')),
      p('We say what you can’t comfortably say about yourself — accurately, and powerfully.'),
      btn('Let us tell your story', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-layoff-bounce',
    category: 'MID_CAREER',
    name: 'Bounce back from a layoff',
    description: 'Supportive, urgent re-entry for recently laid-off professionals.',
    subject: 'A setback isn’t the end of your story',
    bodyHtml: compose(
      eyebrow('Bounce back'),
      h1('Come back stronger'),
      greet(p('A layoff is tough — but it says nothing about your ability. What matters now is moving fast with materials that position you as the professional you are, not the circumstances you left.')),
      p('Let’s get you back in the market this week, ready to win.'),
      btn('Restart my search', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-passive-search',
    category: 'MID_CAREER',
    name: 'Keep your options open',
    description: 'For employed professionals passively exploring.',
    subject: 'Quietly keeping your options open?',
    bodyHtml: compose(
      eyebrow('Stay ready'),
      h1('Be ready before the right role appears'),
      greet(p('The best opportunities rarely arrive when you’re ready for them. The professionals who land them are the ones whose resume and LinkedIn are already sharp — so they can move the moment something great comes along.')),
      p('Get ready now, so you never have to scramble later.'),
      btn('Get quietly ready', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-salary-jump',
    category: 'MID_CAREER',
    name: 'Aim for a salary jump',
    description: 'Positioning to target a meaningful pay increase.',
    subject: 'Aiming for a real salary jump this year?',
    bodyHtml: compose(
      eyebrow('Earn more'),
      h1('Position for the pay you want'),
      greet(p('The biggest salary increases usually come from changing roles — and the size of the offer tracks closely with how strongly you’re positioned going in. A sharper resume literally pays for itself.')),
      p('Let’s build the case that justifies a bigger number.'),
      btn('Position for a raise', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-standout',
    category: 'MID_CAREER',
    name: 'Stand out in the pile',
    description: 'Differentiation for crowded applicant pools.',
    subject: 'One of 200 applicants? Be the one they call.',
    bodyHtml: compose(
      eyebrow('Stand out'),
      h1('Be the one they remember'),
      greet(p('Recruiters spend seconds on each resume before deciding. In a stack of 200 lookalikes, a clear, results-driven, well-designed resume isn’t a nice-to-have — it’s the difference between the shortlist and the reject pile.')),
      p('We make sure yours is the one that stops the scroll.'),
      btn('Make mine stand out', LINK.checkout),
      signoff(),
    ),
  },
  {
    id: 'midcareer-linkedin-visibility',
    category: 'MID_CAREER',
    name: 'Be discoverable on LinkedIn',
    description: 'LinkedIn visibility for mid-career professionals.',
    subject: 'Recruiters are searching. Can they find you?',
    bodyHtml: compose(
      eyebrow('Get discovered'),
      h1('Be discoverable to the right recruiters'),
      greet(p('Recruiters run LinkedIn searches every day for exactly the roles you want. If your profile isn’t optimised for the terms they use, you simply don’t appear — no matter how qualified you are.')),
      bullets(['A keyword-rich headline and About', 'Experience written to surface in searches', 'A profile that converts a click into a message']),
      btn('Optimise my LinkedIn', LINK.checkout),
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
    id: 'seq-executive-nurture',
    name: 'Executive Conversion',
    description: 'High-touch nurture for senior/executive leads — the highest-value segment.',
    category: 'EXECUTIVE',
    steps: [
      { templateId: 'exec-invisible-leaders',  delayHours: 1 },
      { templateId: 'exec-headhunter-magnet',  delayHours: 48 },
      { templateId: 'exec-executive-presence', delayHours: 96 },
      { templateId: 'exec-comp-negotiation',   delayHours: 168 },
    ],
  },
  {
    id: 'seq-midcareer-nurture',
    name: 'Mid-Career Conversion',
    description: 'Nurture mid-career leads from stuck → promotion-ready → get found.',
    category: 'MID_CAREER',
    steps: [
      { templateId: 'midcareer-stuck',           delayHours: 1 },
      { templateId: 'midcareer-quantify-impact', delayHours: 48 },
      { templateId: 'midcareer-recruiter-ready', delayHours: 96 },
      { templateId: 'midcareer-salary-jump',     delayHours: 168 },
    ],
  },
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
