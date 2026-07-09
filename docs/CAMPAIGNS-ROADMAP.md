# Campaign System — Feature Roadmap (50+)

What "drip sequence" means: **a series of emails sent automatically over days** —
e.g. Day 0 welcome → Day 2 tips → Day 5 offer. One enrolment, many touches. The
cron advances each lead through the steps at the configured delays.

## ✅ Shipped (already live)

1. Multi-email **day-by-day drip builder** — add follow-up emails, each with its
   own subject, content/template, and "send N days after previous"
2. Sequence schedule review (Day 0 / Day 2 / Day 5…) with per-email preview
3. **Launch lead picker** — review the resolved audience, search, select/deselect
   individual leads, select-all/none, then send to exactly who you chose
4. Add new leads to a **running** campaign — dedup guaranteed, no re-sends
5. Accurate dispatch feedback (enrolled / already-in / DNC-skipped)
6. 47-template gallery with live preview + categories (exec, mid-career, …)
7. Prebuilt sequences API (`/api/admin/marketing/sequences`)
8. `{{firstName}}` / `{{brandName}}` personalization with safe fallbacks
9. Open/click/unsubscribe tracking, DNC + unsubscribe filtering, one-click
   List-Unsubscribe headers
10. Pause / resume / delete, campaign stats (sent, opens, open rate)

## 🔜 Next (high value, low risk — say the word)

11. **Edit campaign after creation** (subject/content/steps; safe rules for active campaigns)
12. Duplicate campaign
13. Send **test email to yourself** before launch
14. Schedule launch for a specific date/time
15. Per-step analytics (sent/opens per email in a sequence)
16. Click tracking shown in UI (already recorded in DB)
17. Hourly cron for accurate sub-day delays (one-line vercel.json change)
18. Campaign archive (hide old without deleting)
19. Enrolled-leads list per campaign (who's on which step)
20. Remove/pause a single lead from a sequence
21. A/B subject-line test (50/50 split)
22. Quiet hours / send-window (e.g. only 9am–6pm IST)
23. Merge tags for {{company}}, {{jobTitle}}, {{city}}
24. Unsubscribe page with preference options (all vs marketing only)
25. Bounce handling (mark BOUNCED on SMTP failure — partially exists)

## 📦 Later (needs schema or infra)

26. Goal-based exit: stop the sequence when the lead pays/converts
27. Trigger-based enrolment (auto-enrol on inquiry created, checkout abandoned,
    status → COMPLETED)
28. Branching sequences (if opened → path A, else path B)
29. Reply detection → pause sequence
30. Per-lead timeline of every email received
31. Frequency capping across campaigns (max N emails/week per contact)
32. Suppression lists (exclude segment/tag from a campaign)
33. Tags & segments as first-class audience filters
34. Saved audiences (reusable named filters)
35. Custom fields on contacts + merge tags for them
36. Template editor with live block preview side-by-side
37. Save your own templates to the gallery (My Templates)
38. Shared team drafts / approval flow before launch
39. Campaign calendar view (what goes out when)
40. UTM auto-tagging on all links
41. Revenue attribution (campaign → invoice paid)
42. Deliverability dashboard (bounce/spam rates by domain)
43. Custom sending domain + SPF/DKIM checker
44. Warm-up mode (ramp daily send volume)
45. Localised templates (Hindi/Arabic variants)
46. Time-zone aware sending (send at 9am in the LEAD's timezone)
47. Resend-to-non-openers (same email, new subject, after N days)
48. Winner auto-send for A/B tests
49. Webhooks/Zapier events on open/click/convert
50. AI subject-line suggestions from the email body
51. AI template generation from a short brief
52. Import HTML template (paste external designs)
53. Export campaign stats to CSV
54. Roles: restrict who can launch vs draft (RBAC exists app-wide; scope to campaigns)

Priorities are my recommendation as defaults — reshuffle freely. Items 11–25 are
each roughly a session of work; 26+ mostly need schema additions and should ride
the prisma-migrations adoption (see docs/AUDIT-DEFERRED.md).
