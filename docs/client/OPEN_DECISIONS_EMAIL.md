# Client email — Phase 1 status + open decisions

> Draft to send Josh. Long-form (his preferred channel for substantive items).
> Fill in the demo link / Loom URL before sending. Each decision has a suggested
> default so he can reply with a one-word "yes".

---

**Subject:** Phase 1 dashboard is live — a few quick decisions to keep momentum

Hi Josh,

Quick update, and a short list of decisions whenever you get a window — no rush, I know you're across a lot.

**Where things stand.** The Phase‑1 platform is built and running against a live database (not a mock):

- **Page 1** — the six standardized KPI dials with quarterly trend, traffic‑light compliance, cohort mix and a sentiment summary.
- **Pages 2–4** — the respondent‑typology deep‑dives (construction‑adjacent / Build‑to‑Rent / private‑sale), each showing that channel's questions.
- **Open Feedback (Page 4)** — a paginated ledger (30/page) with sentiment, channel and text‑search filters, plus a thematic keyword‑cluster chart whose bars are clickable filters.
- **Raw Survey Data** — every captured field/online question, with a raw / numeric / normalized toggle.
- **KPI Engine** — a configurable screen to edit weights, thresholds and units, and add or retire KPIs; the dashboard recomputes live.
- **Backend** — multi‑tenant with row‑level security, the full KPI calculation engine, and the two‑channel survey model built directly from your mock data.

▶️ Live demo: **[link]**  ·  2‑minute walkthrough: **[Loom link]**

**A few decisions to unblock the next stretch.** If a default works, a one‑word "yes" is all I need.

*Would really help to have these soon:*

1. **Build approach** — I've built this as a full‑stack app (React + a live Postgres backend with genuine per‑client data isolation) rather than inside Base44. It's more robust and gives us real security for the dual‑data split later; the model still maps 1:1 to Base44 if you ever need it there. Happy to keep this course? *(Default: yes.)*
2. **KPI set** — the six KPIs, weights and thresholds are in and editable live. Lock the current set for now, or send the refined list when ready? *(Default: lock current; adjust weights later.)*
3. **Question → KPI links** — each KPI is tagged to the relevant survey questions (e.g. *Public Realm Safety* ← public‑space + off‑peak security + public‑realm contribution). Good to proceed on this mapping? *(Default: yes.)*
4. **Compliance thresholds** — you mentioned being unsure on red‑state triggers. I've set fixed platform‑wide bands. Keep fixed, or make them per‑project later? *(Default: fixed for now.)*
5. **Housing Affordability** — none of the survey questions capture cost‑to‑income, so this KPI currently runs on a placeholder. Feed it from an external housing‑data source later, swap it for a survey‑backed KPI, or drop it? *(Default: placeholder now, external feed in Phase 3.)*

*When you get a chance / just flagging:*

6. **Categorical answers** — accessibility cohort, offerings, energy‑awareness, etc. are captured but descriptive only. Should any of these feed the KPI scores, and if so how weighted? *(Default: descriptive‑only for now.)*
7. **Real data** — when do you expect real survey responses, and through which channels (MailChimp/Typeform online + the field PWA)? This drives Phase 2.
8. **Sentiment** — how would you like Q10 sentiment generated in production — a specific NLP service, or a simple lexicon to start? *(Default: simple to start, upgrade later.)*
9. **Private Ownership sheet** — still planning to send it? The third channel is stubbed and ready. No rush.
10. **Data retention** — you described access during report creation, revoked ~6 months post‑completion, with an export file to hand back. When convenient: what triggers the cut‑off, and what format should the export take? *(Phase 3.)*
11. **Phase boundary** — could we confirm what marks Phase 1 complete vs. Phase 2/3, so milestones stay clean?

No need to tackle all at once — even answering 1–5 keeps me moving. Everything is documented in the repo (architecture, API connections, synchronization rules) per our continuation agreement.

Thanks again — genuinely enjoying building this.

Andrii
