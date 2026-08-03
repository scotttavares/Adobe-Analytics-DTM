---
name: adobe-tags-data-reconciliation
description: >
  Reconcile an Adobe Analytics report suite's variables (eVars, props, events, list vars) against what a property's Adobe Tags / Web SDK data collection actually populates — showing which variables are collecting data, which are wired but produce nothing (no-op), which are orphaned, and which are defined but never built — then produce a client-ready reconciliation Excel workbook (with a Recommendations tab and Data Issues tab) and a decisions email to the client. Use after an Adobe Tags audit (typically after adobe-tags-audit-builder produces its audit workbook), or whenever someone asks to "reconcile the report suite against the property," "map data elements to eVars/props," "see which eVars/props/events are actually collecting data vs not wired up," "find orphan or no-op data elements," build a "data collection reconciliation," an "SDR gap analysis," or a "variable-to-data-element mapping" deliverable. Consumes the audit workbook plus the client's Report Suite Manager variable list. Do NOT use to run the audit itself (adobe-tags-audit-builder) or to build/publish a Launch property (adobe-tags-migration-*).
---

# Adobe Tags Data Reconciliation

Turns two inputs — an **audit workbook** (the property's extensions, rules, and data elements) and the client's **report suite variable map** (every eVar/prop/event/list the suite defines) — into two client-ready deliverables:

1. A **data-collection reconciliation workbook** (`.xlsx`) — every report-suite variable mapped to the data element(s) and rule(s) that feed it, status-coded as *collecting data* vs *not wired up*, plus a reverse element→variable view, a **Data Issues** tab, and a **Recommendations** tab.
2. A **client decisions email** — the handful of "defined but not collected" items that need the client's call (surfaced from the reconciliation), written to send as-is.

It answers the question an audit raises but doesn't close: *of everything the report suite is set up to collect, what is actually collecting — and what do we do about the rest?*

## Where this sits in the pipeline

```
adobe-tags-audit-builder ──▶ audit workbook (extensions / rules / data elements / Audit Flags)
                                     │
   report suite variable map ───────┤   (client's Report Suite Manager: eVars, props, events, list vars)
                                     ▼
         THIS SKILL ──▶ reconciliation workbook (.xlsx)  +  client decisions email
```

Run **adobe-tags-audit-builder first** to produce the audit workbook. If the user already has an equivalent inventory (a Launch Inspector export, an SDR, a prior tool's output), work from that instead — you need the property's data elements and the rule actions that set analytics variables, in whatever form.

## First: the welcome banner

Show this banner in a code block (exactly as written, so the spacing renders), then a one-line welcome, before anything else:

```
   _____ __    ___    __    ____  __  ___
  / ___// /   /   |  / /   / __ \/  |/  /
  \__ \/ /   / /| | / /   / / / / /|_/ /
 ___/ / /___/ ___ |/ /___/ /_/ / /  / /
/____/_____/_/  |_/_____/\____/_/  /_/
        FIERCELY HUMAN CONSULTING
```

Welcome to Slalom's Adobe Tags Data Reconciliation skill. I'll map the report suite's variables against what the property actually collects, then produce the reconciliation workbook and a client decisions email.

## The four phases

1. **Intake** — gather the two inputs (audit workbook + report suite variable map)
2. **Map** — build the variable → data-element mapping from the property's rule actions
3. **Reconcile** — classify every variable's status and surface data issues
4. **Build** — render the workbook and draft the client email

Don't shortcut to Phase 4: a reconciliation with a guessed mapping is fiction. The value is in the honest status of each variable, which requires actually reading how the property populates it.

---

## Phase 1 — Intake

Gather both inputs. Ask for whichever is missing; don't invent either.

1. **The property side** — the audit workbook from `adobe-tags-audit-builder` (its *Data Elements*, *Rules*, *Rule Detail*, and *Rule ↔ Data Element References* tabs are what matter here), **or** an equivalent: a Launch Inspector export, an SDR, or the Web SDK property's payload spec. You need, for each analytics variable the property sets, *which data element supplies it and in which rule*.

2. **The report suite side** — the variable map from **Adobe Analytics → Admin → Report Suite Manager**: the full eVar list, prop (traffic variable) list, success-event list, and list-variable config. The client captures these screens (or exports them). See `references/report-suite-intake.md` for exactly which screens and how to transcribe them — this is the authoritative "what the suite is set up to collect" side of the reconciliation, and it is the one input that has to come from the client.

3. **Framing** — is this a **migration** (old property → new Web SDK property, where parity matters) or a **single-property health check**? It changes the language: a migration reconciliation leads with "full parity — every variable the old property populated, the new one populates," and classifies gaps as report-suite leftovers, not misses. A health check just reports current state. Confirm which.

If the report suite map is missing, say so plainly — without it you can only inventory the property, not reconcile it against what's *supposed* to be collected. The reconciliation's whole point is the two sides side by side.

---

## Phase 2 — Map

Build the **variable → data element** mapping: for each eVar / prop / event / list, which data element feeds it and in which rule.

**Start with the extractor — don't hand-build the whole thing.** If you have the audit workbook from `adobe-tags-audit-builder`, run:

```bash
python3 scripts/extract_mapping.py audit-workbook.xlsx draft-mapping.json
```

It scans every rule Action for analytics-variable assignments — both classic `s.eVar5 = "%Page Name%"` and Web SDK `"eVar5": "%Page Name%"` forms — and inverts them into a **draft**: a `mapping` (variable → element/rule/source) that pastes straight into the Phase 4 JSON, an `elementsDraft` reverse view (with orphan candidates and getVar cross-references already resolved), an `unmatched[]` list of fields set by a literal/expression rather than a data element, and `unknownElements[]` for `%refs%` not on the Data Elements tab. It does the tedious, transcription-error-prone half mechanically.

**Then verify and complete it — the draft is a first pass, not the answer.** The extractor cannot know:
- the report-suite variable **names** (they live in the client's Report Suite Manager, not the audit workbook) — fill each from the Phase 1 report-suite map;
- whether an element is a **no-op** (`return ""` / `console.log()`), an intentional **exclusion** (ECID), or a genuine **orphan** — that's Phase 3 judgment (the `source` hint often reveals a no-op, e.g. it literally shows `return "";`);
- anything in **`unmatched[]`** — read each and classify it by hand.

If you don't have an audit workbook (working from an SDR, a Launch Inspector export, or the Web SDK payload spec instead), build the mapping by reading the source directly. Where it lives depends on the property type:

- **Classic AppMeasurement** — the Analytics extension's *Set Variables* actions (`s.eVar5 = %Data Element%`, `s.events`, `s.prop1`, `s.list1`). Read them from the audit workbook's Rule Detail tab.
- **Web SDK (Alloy)** — the `data.__adobe.analytics` object inside each *Send event* action (or the *Update variable* action's field mappings, and the Variable data element it targets). Same eVar/prop/event keys, nested under the analytics object.
- **XDM-modeled** — the field-to-eVar mapping lives in the schema / data prep, or in "XDM …" data elements; use those.

Capture, per variable: the **data element name**, the **rule** that sends it, and the element's **source** (its data-layer path, `custom code`, a query-string param, or a top-level Analytics field like `s.campaign`). A variable set in more than one rule gets more than one row — that's expected (e.g. a shared error list).

Also note **top-level Analytics fields** (`pageName`, `channel`, `campaign`, `referrer`, `pageURL`) and **list variables** — it's easy to miss that a data element feeds `s.campaign` or `list1` rather than a numbered eVar/prop, which would wrongly flag it as an orphan. `references/reconciliation-workbook-format.md` lists every place a data element can be "used" so the orphan detection doesn't false-positive.

---

## Phase 3 — Reconcile & detect issues

Classify every report-suite variable into one status, and every data element likewise. The vocabulary (and the color each maps to) is fixed — see `references/reconciliation-workbook-format.md`:

| Status | Meaning |
|---|---|
| **Collected** | element feeds it and a rule sends it — real data |
| **No-op** | element is wired but returns nothing (a `return "";` / `console.log()` stub) — the variable never populates |
| **Orphan** | (element side) the element exists but isn't sent to any variable |
| **Defined, never sent** | the report suite defines it but the property never populates it (in a migration: parity — it was never used) |
| **Not implemented** | defined in the report suite but built nowhere (classic case: a whole audio/media feature) — net-new scope |
| **Excluded by design** | intentionally not populated (ECID under Web SDK — the SDK manages identity) |

Then sweep for **data issues** — the recurring ones worth automating a look for (detection patterns are in the reference):
- **No-op elements** (`return ""`, `console.log()`, always-undefined) feeding a live variable.
- **Orphan elements** — carried but wired to nothing.
- **Duplicate report-suite labels** (two eVars with the same name; one usually unused).
- **Label-vs-value mismatch** — a variable labeled one thing but fed a different value (a carried mislabel).
- **Event-number collisions** — two interactions sharing a success event.
- **Whole features defined-but-unbuilt** (audio/media is the classic — events *and* eVars defined, zero implementation).
- **Identity captured redundantly** — ECID written into an eVar/prop when the SDK already manages it.
- **PII risk** — an element reading a raw identifier (login ID, email) with no hashing, especially if it's about to be wired up.

Every issue becomes a row on the **Data Issues** tab (severity + description + recommendation) and rolls up into the **Recommendations** tab, tiered:
- **P1** — decisions only the client can make (define-or-drop an empty dimension, in/out on an unbuilt feature, confirm real consent values, PII handling).
- **P2** — analytics-owner confirmations that need no build change (shared list var, label-vs-value, duplicate label, event collision).
- **P3** — housekeeping (orphan cleanup, the one screenshot still missing, documenting the cutover date).

---

## Phase 4 — Build

1. **Assemble the normalized JSON** the build script consumes — `reportSuite` (the defined variables), `mapping` (variable → element/rule/source), `noopElements`, `statusOverrides` (for ECID/audio/duplicates the mapping can't infer), `elements` (the element→variable reverse view), `issues`, and `recommendations`. The exact schema is the docstring of `scripts/build_reconciliation_workbook.py`, with a worked example in `references/example-input.json`.

2. **Render the workbook:**
   ```bash
   python3 scripts/build_reconciliation_workbook.py input.json data-collection-reconciliation.xlsx
   ```
   Produces the tabs: **Overview** (combined legend + per-dimension counts), **Recommendations**, **eVars**, **Props**, **Events**, **List Vars** (only if lists are defined), **Data Elements**, **Data Issues** — Arial throughout, status-color-coded, filterable. No formulas, so no recalc step needed.

3. **Verify before delivering** — open the counts on the Overview and confirm they reconcile (collected + no-op + orphan + … = total defined), and that the orphan count matches what you expect. A miscount almost always means the mapping missed a *list* or *top-level field* feed (Phase 2) — fix the mapping, not the number.

4. **Draft the client email** from `references/client-email-template.md`, filling the P1 items (the decisions) from the Recommendations tier. Keep it in client terms — no internal tooling references. Lead with the parity framing on a migration so the items read as *decisions*, not failures. Deliver it as a tracked `.md` file (or offer to drop it into the client's drafts), never send it yourself.

Deliverables: the `.xlsx` and the email draft. Both are client-facing — keep property internals (rule IDs, catalog paths, commit hashes) out of them.
