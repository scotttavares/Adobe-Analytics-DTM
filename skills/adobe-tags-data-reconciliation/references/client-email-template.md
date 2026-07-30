# Client Decisions Email — Template

The email that turns the reconciliation's **P1** items (the ones only the client can decide) into a short, answerable message. Draft it from the Recommendations tab's P1 tier; keep it in client terms (no rule IDs, catalog paths, or internal tooling). Deliver it as a tracked `.md` file, or offer to drop it into the client's drafts — never send it yourself.

## Rules for filling it in

- **One item per P1 recommendation.** Two to four items is typical; if you have more than four, the extras are probably P2 confirmations, not client decisions — leave those for a call.
- **Every item gets a "what we found," a specific question, and a safe default.** The default is what preserves current behavior (usually "carry forward as-is, inactive") so the client is never blocked.
- **Flag PII explicitly.** If an item involves a raw identifier, say you'll hash it (or confirm it's non-identifying) before collecting — don't bury it.
- **Lead with parity on a migration.** The opening line should reassure that nothing they collect today is being lost — the items are decisions, not breakage.
- **Fill the bracketed placeholders** and delete any item that doesn't apply.

## Template

---

**Subject:** [Site] data collection — [N] quick decisions ([short item list])

Hi [name],

As part of [standing up the new Web SDK property / reviewing the current setup], we reconciled everything the property collects against your report suite. [Migration only: The migration itself is at full parity — every dimension and metric you collect today, the new property collects.] In doing that, a few things came up that are **defined in the report suite but not actually being collected**, and I'd like your call on each before we finalize.

**1. [Empty dimension — e.g. User Type (eVar15)]**
[What we found: e.g. "This element returns an empty string today, so eVar15 has never captured a value."]
- [Specific question: is this wanted? If so, what defines it and where does the value live?]

**2. [Orphan / identifier — e.g. Login ID]**
[What we found: e.g. "Reads a value from the data layer but no rule sends it — defined but never collected."]
- [Specific question: do you want it captured, and on which variable?]
- **Privacy check:** if [identifier] can identify a person, we'll hash it before collection (or confirm it's a non-identifying ID). We won't send a raw identifier without your sign-off.

**3. [Unbuilt feature — e.g. Audio tracking]**
Your report suite has a full set of [feature] variables defined — [events + eVars] — but the property doesn't populate any of them. ([e.g. Video is tracked; audio isn't, and never has been.])
- Is [feature] engagement something you want to measure going forward?
- If yes: this is net-new setup ([e.g. streaming-media collection, separate from standard tracking]), so we'd scope it separately and get you an estimate.
- If no: we leave the definitions as-is; nothing changes.

**4. [Consent / other — as needed]**
[What we found + the specific confirmation needed.]

**Our default on all of these if you'd rather not tackle them now:** we carry the current behavior forward exactly as-is (these stay inactive), nothing changes vs. today, and any can be switched on later once you've confirmed the details. No impact to the [migration] timeline.

Happy to jump on a quick call if that's easier than email. Thanks!

Best,
[Your name]
Slalom

---

The reconciliation workbook is the long-form backing for this email — the **Data Issues** tab is the per-item detail, and the **Recommendations** P1 tier is the source of the items here. Send them together, or lead with the email and use the workbook to walk through it.
