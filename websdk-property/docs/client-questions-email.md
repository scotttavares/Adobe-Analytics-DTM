# Client email — data-collection decisions (draft)

Draft email to the AboutAmazon / Amazon News analytics stakeholder covering the
three "defined but not collected" items surfaced during the Web SDK migration
reconciliation. Backing detail is in
[`catalog/events-catalog.json → _reportSuiteReconciliation`](../catalog/events-catalog.json)
and [`docs/AUDIT-TRACEABILITY.md`](AUDIT-TRACEABILITY.md).

Fill in `[name]` and `[Your name]` before sending. Nothing here blocks the
migration — all three have a documented "carry forward as-is" default.

---

**Subject:** AboutAmazon Web SDK migration — 3 quick data decisions (User Type, Login ID, Audio)

Hi [name],

As part of standing up the new Web SDK property, we're reconciling everything the new setup collects against your current property and report suite. The migration itself is at full parity — every dimension and metric you collect today, the new property collects. In doing that review, three things surfaced that are **defined but not actually being collected** today, and I'd like your call on each before we finalize.

**1. User Type (eVar15)**
In the current property this element's logic returns an empty string — it always has — so eVar15 has never populated with a real value.

- Is "user type" a dimension you want going forward?
- If yes: what defines it (e.g., logged-in vs. anonymous, subscriber/member tier, internal vs. public), and where does that value live on the page or in the data layer?

**2. Login ID**
This element reads a `loginID` value from the data layer, but no rule currently sends it to Adobe — it's defined but never collected.

- Do you want login ID captured going forward?
- If yes: which report variable should hold it, and on what — every page view, or only a login event?
- **Privacy check:** if the login ID can identify an individual, we'll hash it before collection (or confirm it's a pseudonymous, non-identifying ID). We won't send a raw identifier without your sign-off.

**3. Audio tracking**
Your report suite has a full set of audio variables defined — Audio Start / Complete / Milestone events, plus Audio Title / Action / Duration / % Played — but the current property doesn't populate any of them. (Video *is* tracked; audio isn't, and never has been.)

- Is audio engagement something you want to measure going forward?
- If yes: this is net-new setup — audio metrics like duration and % played come through Adobe's streaming-media collection, which is separate from the standard page/click tracking — so we'd scope it as its own small piece of work and get you an estimate.
- If no: we leave the definitions as-is; nothing changes.

**Our default on all three if you'd rather not tackle them now:** we carry the current behavior forward exactly as-is (these stay inactive), nothing changes vs. today, and any of them can be switched on later once you've confirmed the details. No impact to the migration timeline.

Happy to jump on a quick call if that's easier than email. Thanks!

Best,
[Your name]
Slalom
