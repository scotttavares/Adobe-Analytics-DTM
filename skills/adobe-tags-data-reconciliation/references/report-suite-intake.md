# Report Suite Variable Intake

The report suite side of the reconciliation — the authoritative list of what the suite is *set up* to collect. It comes from the client (it lives behind an Adobe Analytics admin login), so this is the one input you'll usually have to request. Capture all four variable types.

## Where each list lives

**Adobe Analytics → Admin → Report Suites → (select the suite) → Edit Settings**, then:

| Variable type | Menu path | What to capture |
|---|---|---|
| **eVars** (conversion) | Conversion → Conversion Variables | number + name for every enabled eVar (e.g. `eVar15 = User Type`) |
| **props** (traffic) | Traffic → Traffic Variables | number + name for every enabled prop |
| **success events** | Conversion → Success Events | number + name for every enabled event (e.g. `event35 = Audio Start`) |
| **list variables** | Conversion → List Variables | number + name + **delimiter** for list1–list3 (often only 1-2 are enabled) |

The **Report Suite Manager → Estimize / Variables** overview screens also show these; screenshots of those work too. Whatever the source, you need **number → name** for every enabled variable of each type.

## How to transcribe

Produce a plain `number: name` map per type. From screenshots, read carefully — the numbers are the anchor, names are free text and easy to fat-finger. Watch for:

- **Gaps** — disabled slots are skipped (a list may go `…35, 37…` with 36 disabled). Record only what's enabled; don't renumber.
- **Duplicate names** — two eVars with the same label happen (e.g. `Content Type` on both eVar9 and eVar26). Record both; the reconciliation flags the unused duplicate.
- **Truncated names** in a narrow column — click into the cell / widen it; don't guess the tail. (Guessing here is how a reconciliation ends up mislabeling a variable.)
- **Feature clusters** — a run of related events + eVars (e.g. `Audio Start / Complete / Milestone` events *and* `Audio Title / Duration / % Played` eVars) is a signal: if the property implements none of them, that's a whole unbuilt feature, not five unrelated gaps. Note the cluster.

## What "defined" does and doesn't mean

A variable enabled in the report suite means the suite is *ready to receive* it — **not** that anything sends it. The report suite is almost always a superset of what any one property populates: variables get provisioned for planned features, other data sources (mobile app, a media SDK, server-side), or future use. That gap is exactly what the reconciliation measures — so an enabled variable with no property mapping is a normal "defined, never sent," not an error. The reconciliation's job is to make that gap explicit and sort it into *client decision* vs *parity leftover* vs *net-new scope*.

## The mapping side (for contrast)

This intake is only the **defined** side. The **populated** side — which data element feeds each variable, in which rule — comes from the property (the audit workbook / SDR / Web SDK payload spec), per SKILL.md Phase 2. The reconciliation is the two side by side: *defined* (here) vs *populated* (there).
