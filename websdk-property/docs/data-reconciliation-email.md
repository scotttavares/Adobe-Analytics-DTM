# Client email — data-collection reconciliation (cover + decisions)

Send this alongside **`data-collection-reconciliation.xlsx`**. It confirms migration
parity and asks for the handful of decisions the reconciliation surfaced. Nothing
here blocks the migration — every item has a documented "carry forward as-is"
default. Fill in `[name]` and `[Your name]` before sending.

---

**To:** [analytics stakeholder]
**Subject:** AboutAmazon Web SDK migration — reconciliation results + a few decisions before cutover
**Attachment:** data-collection-reconciliation.xlsx

Hi [name],

Attached is the **data-collection reconciliation** for the new AboutAmazon Web SDK
property — a variable-by-variable comparison of what the new setup collects against
your current production report suite (`aboutamznprod`).

**Headline: the migration is at full parity.** Every dimension and metric the current
property collects, the new Web SDK property collects — 43 eVars, 19 props, 30 events,
and both list variables — all verified against live data, not old documentation.

The review also surfaced a short list of **decisions** and a few clean-ups. None of them
block the migration, but four are worth your call **before we cut over**.

**Decisions before cutover**

1. **User Type (eVar15)** — returns empty today and never has collected. Do you want a
   "user type" dimension (logged-in vs. anonymous, subscriber tier, …), and where does
   that value live on the page / in the data layer? Or shall we retire it?
2. **Login ID** — defined but never sent (orphan today). Do you want it captured, and in
   which variable? **Privacy:** if it can identify a person we hash it before collection —
   we won't send a raw identifier without your sign-off.
3. **Audio tracking** — fully defined in the report suite (events 35–39, eVars 51–54) but
   never built. Video is tracked; audio isn't, and never has been. If you want it, it's
   net-new streaming-media scope and we'll estimate it separately.
4. **Consent values** — send us the exact strings your cookie banner pushes for opt-in /
   opt-out, so the consent mapping matches reality (it's a best-guess today).

**Quick confirmations — for your analytics owner, no build change**

- **list1** carries Site Error and Form Error together (parity with today) — confirm that
  unified error list is intended, not a collision.
- **eVar28** is labeled "Amazon Redirect Link" but carries the redirect link *text* (as it
  does today) — confirm the intended value, or relabel. Likely a pre-existing mislabel.
- **eVar26** duplicates eVar9 ("Content Type") and is unused — repurpose it for a new
  dimension, or leave as-is.

Everything else is **housekeeping** we can handle after cutover: nine harmless orphan data
elements to review, one List Variables config screenshot we're still missing, and recording
the go-live date as your pre/post trend boundary.

**What's in the workbook**

- **Overview** — status legend and counts (collecting / no-op / orphan / defined-never-built).
- A tab per variable type — **eVars, Props, Events, Data Elements, List Vars** — each variable
  mapped to the data element and rule that feeds it.
- **Data Issues** — the 12 items above with severity and a recommendation each.
- **Recommendations** — this same list, grouped by when it's needed.

**If you'd rather not tackle the decisions right now:** we carry current behavior forward
exactly as-is — nothing changes vs. today, and any of these can be switched on later once
you confirm the details. No impact to the migration timeline.

Happy to do a 30-minute walkthrough of the workbook if that's easier than email — otherwise,
your calls on the four above are all we need to finalize.

Best,
[Your name]
Slalom · Adobe Data Collection
