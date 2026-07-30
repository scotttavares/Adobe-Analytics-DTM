# Reconciliation Workbook — Format, Status Vocabulary & Issue Patterns

The structure of the workbook produced by `scripts/build_reconciliation_workbook.py`, the fixed status vocabulary it renders, and the issue-detection patterns Phase 3 sweeps for. The script only *renders* a normalized JSON — all analysis is done in Phase 2-3 and expressed in that JSON.

## Tabs, in order

1. **Overview** — title, subtitle, capture line, then ONE combined **legend + counts** table: each status is a colored row showing how many eVars / props / events / lists / data elements carry it, a totals row, and a one-line bottom-line statement. This is the exec summary; it replaced an earlier design where the legend and a separate counts block floated apart. Keep them merged.
2. **Recommendations** — presentation-ready, three tiers (P1 client decisions / P2 analytics-owner confirmations / P3 housekeeping), each row = recommendation · why it matters · when. Sits second so it reads like a slide up front.
3. **eVars** — every report-suite eVar → status → data element(s) → rule(s) → element source → note.
4. **Props** — same, for traffic variables.
5. **Events** — event → status → element/value → rule → note.
6. **List Vars** — only rendered if lists are defined. Same shape.
7. **Data Elements** — the *reverse* view: each element → what variable(s) it feeds → status → note. This is where orphan and no-op elements surface.
8. **Data Issues** — one row per issue: severity (color-coded) · affected variables/elements · description · recommendation.

Arial throughout, status-color-coded, header row frozen + auto-filtered. No formulas.

## Status vocabulary (fixed — do not invent new statuses)

| Status | Fill | Applies to | Meaning |
|---|---|---|---|
| **Collected** | green | vars + elements | element feeds the variable and a rule sends it — real data |
| **No data (element is a no-op)** | yellow | vars + elements | element is wired but returns nothing (`return "";`, `console.log()`) — the variable never populates |
| **Not wired (orphan element)** | orange | elements only | element exists but is not sent to any variable |
| **Defined, property never sends it** | peach | vars only | report suite defines it; the property never populates it (in a migration: parity — never used) |
| **Not implemented (never built)** | red | vars only | defined in the report suite but built nowhere — net-new scope (e.g. Audio) |
| **Excluded by design** | grey | vars + elements | intentionally not populated (ECID under Web SDK — the SDK manages identity) |

The JSON uses short keys (`collected`, `no-op`, `orphan`, `not-sent`, `not-implemented`, `excluded`); the script maps them to the labels/colors above. Variables default to **Collected** if present in `mapping` (unless a feeding element is a no-op), else **Defined, property never sends it** — use `statusOverrides` to force `excluded` / `not-implemented` where the mapping can't infer it.

## Where a data element can be "used" (so orphan detection doesn't false-positive)

An element is an orphan only if it feeds *nothing*. It counts as used if it appears in ANY of:
- a numbered **eVar** or **prop**;
- a **success event's value** (`valueFrom` / counter);
- a **list variable** (`list1`–`list3`) — **easy to miss**;
- a **top-level Analytics field**: `pageName` (s.pageName), `channel`, `campaign` (s.campaign), `referrer`, `pageURL` — **also easy to miss**;
- a **getVar() reference inside another element's custom code** (e.g. a "campaign string" element that reads the UTM elements).

If your orphan count comes out higher than expected, you almost certainly omitted list feeds or top-level fields from the mapping. Fix the mapping, never the number.

## Issue-detection patterns (Phase 3 sweep)

Look for each; every hit becomes a Data Issues row + (if it needs a decision) a Recommendations row.

| Pattern | How to detect | Severity | Tier |
|---|---|---|---|
| **No-op element feeding a live variable** | element code is `return "";`, `console.log();`, or always-undefined | Medium | P1 (define or drop) |
| **Orphan element** | element feeds nothing (per the "used" list above) | Low | P3 |
| **Duplicate report-suite label** | two eVars/props share a display name; one is unpopulated | Info | P2 |
| **Label-vs-value mismatch** | variable's report-suite label ≠ the value the property sends it (a carried mislabel) | Low | P2 |
| **Event-number collision** | two interactions set the same success event | Low | P2 (renumber) |
| **Whole feature defined-but-unbuilt** | a cluster of events *and* eVars for one feature (audio/media is the classic) with zero implementation | Medium | P1 (in/out) |
| **Redundant identity capture** | ECID written into an eVar/prop under Web SDK | Info | P1 (usually drop) |
| **PII risk** | element reads a raw identifier (login ID, email, phone) with no hashing | Medium/High | P1 (hash or drop) |
| **Consent values unconfirmed** | consent-mapping element guesses the banner's opt-out strings | Medium | P1 (confirm) |
| **Empty-value behavior change** | Web SDK omits empty values where classic XDM could send empty strings | Info | note only |

Add patterns as you find recurring ones — this list is meant to grow.

## The parity framing (migrations)

When the reconciliation is for a migration (old property → new property), lead the Overview `bottomLine` and the Recommendations subtitle with the parity statement — e.g. *"Migration is at full parity — every variable the old property populated, the new build populates. The non-green rows are report-suite definitions the old property never used (client decisions), not migration gaps."* This is the single most important framing: it stops the client reading "not collected" rows as things the migration broke. For a single-property health check, drop the parity language and just report current state.
