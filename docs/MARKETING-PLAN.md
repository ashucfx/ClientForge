# Catalyst Marketing Plan

A practical, repeatable email marketing system built on the tools already in the
app: the **Flywheel Campaigns** builder, the **template library**
(`src/lib/marketing/templates.ts`), the **drip sequences**, and the **daily cron**
(`process-campaigns`) that sends them.

Nothing here changes client or invoice data. Campaigns only send to contacts who
are opted in (Do-Not-Contact and unsubscribes are filtered automatically).

---

## 1. Audience segments

| Segment | Who | Primary goal | Templates / sequences |
|---|---|---|---|
| **New leads** | Inquired or started checkout, not yet paid | Convert to first purchase | `seq-new-lead-nurture`, `seq-abandoned-checkout` |
| **Dormant / past clients** | Bought before, gone quiet | Reactivate | `seq-winback`, win-back templates |
| **Active clients** | Currently in delivery | Satisfaction, reviews, referrals, upsell | `seq-post-delivery-grow`, grow templates |
| **Everyone (opted-in)** | Whole list | Seasonal offers, brand touchpoints | Seasonal templates |

In the campaign builder these map to the **Audience** step: `ALL`, a lifecycle
stage, or a hand-picked list.

---

## 2. The template library (27 ready templates)

Grouped into four categories, all send-ready with `{{firstName}}` personalization
and preview in the builder gallery ("Start from a template"):

- **Win back old / dormant clients** — we-miss-you, career check-up, new-year move,
  one-year refresh, comeback offer, what's new.
- **Convert new leads** — abandoned-checkout ×3, post-inquiry nurture, first-purchase
  offer, social proof, objection buster, LinkedIn value email.
- **Grow existing clients** — upsell LinkedIn, upsell portfolio, referral ask,
  review request, tier upgrade, cover-letter add-on.
- **Seasonal & lifecycle** — festive offer, hiring-season push, milestone thank-you,
  birthday, testimonial spotlight, year-end reflection, weekend flash sale.

---

## 3. Drip sequences (the automation)

Defined in `MARKETING_SEQUENCES`. Each becomes a multi-step DRIP campaign; the
daily cron advances every enrolled contact through the steps at their delays.

| Sequence | Steps | Cadence |
|---|---|---|
| **Abandoned Checkout Recovery** | reminder → urgency → social proof | +1h, +24h, +72h |
| **New Lead Nurture** | post-inquiry → LinkedIn tips → social proof → first-purchase offer | +1h, +2d, +4d, +6d |
| **Win-Back (Dormant)** | we-miss-you → check-up → comeback offer | 0, +3d, +7d |
| **Post-Delivery — Grow & Refer** | thank-you → review → referral → upsell | 0, +3d, +5d, +10d |

**How to launch one:**
`POST /api/admin/marketing/sequences { "sequenceId": "seq-winback" }` creates a
DRAFT drip campaign. Open it in Flywheel → Campaigns, pick the audience, and
dispatch. From there the cron sends each step automatically.

---

## 4. How the automation fires

`vercel.json` schedules `/api/admin/flywheel/cron/process-campaigns` **daily at
10:30 UTC**. On each run it finds enrolled contacts whose next step is due,
personalizes and sends it, records the event, and schedules the next step.

⚠️ **Timing caveat:** because the cron runs once a day, delays shorter than 24h
(e.g. the 1-hour abandoned-checkout touch) won't actually fire faster than the
next daily run. For true time-sensitive recovery, increase the cron frequency to
hourly in `vercel.json`:

```json
{ "path": "/api/admin/flywheel/cron/process-campaigns", "schedule": "0 * * * *" }
```

That single change makes every sub-day delay in the sequences accurate.

---

## 5. Suggested always-on setup

1. **Abandoned Checkout Recovery** — enroll anyone who starts checkout and doesn't
   pay within an hour. (Requires the hourly cron above to be meaningful.)
2. **New Lead Nurture** — enroll every new inquiry.
3. **Post-Delivery — Grow & Refer** — enroll clients when their status hits COMPLETED.
4. **Win-Back** — run monthly against clients who haven't ordered in 6+ months.

Plus a **monthly seasonal blast** from the seasonal templates (festive, hiring
season, weekend flash, year-end).

---

## 6. Campaign calendar (repeatable year)

| Month | Theme | Template |
|---|---|---|
| Jan | New year, new role | `winback-new-year-move`, `seasonal-hiring-season` |
| Mar | Spring refresh | `winback-career-checkup` |
| Jun | Mid-year check-in | `winback-we-miss-you` |
| Aug–Sep | Hiring season | `seasonal-hiring-season` |
| Oct–Nov | Festive offer | `seasonal-festive-offer` |
| Dec | Year-end reflection | `seasonal-year-end-review` |
| Any weekend | Flash sale | `seasonal-weekend-flash` |
| Ongoing | Birthdays | `seasonal-birthday` |

---

## 7. KPIs to watch

The campaigns list already tracks **sent / opens / open-rate** per campaign
(clicks and unsubscribes are recorded too). Targets to aim for:

| Metric | Healthy | Great |
|---|---|---|
| Open rate | 30%+ | 45%+ |
| Click rate | 2%+ | 5%+ |
| Unsubscribe | < 0.5% | < 0.2% |
| Win-back reactivation | 3%+ | 8%+ |
| Abandoned-checkout recovery | 5%+ | 15%+ |

Review monthly. If open rates dip, test subject lines (the templates' subjects are
a strong starting point). If unsubscribes climb, reduce frequency to that segment.

---

## 8. Deliverability hygiene

- Sends already include one-click **List-Unsubscribe** headers and a visible
  unsubscribe link — keep both.
- Only opted-in contacts are targeted; DNC is filtered in dispatch and cron.
- Warm up volume gradually; avoid blasting the whole list on day one.
- Keep SMTP credentials (`SMTP_USER`/`SMTP_PASS`) on a domain with SPF/DKIM set up.
