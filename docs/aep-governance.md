# AEP consent governance blueprint

How ClearConsent's captured consent becomes **enforced** governance across Adobe
Experience Platform — Real-Time CDP data governance and profile opt-in/out,
Adobe Journey Optimizer marketing journeys, and reporting in Customer Journey
Analytics and Adobe Analytics.

> **Capture vs. enforce.** ClearConsent (code) *captures* consent and emits it as
> XDM. AEP (configuration) *enforces* it. This document is the enforce side — the
> schema, datastream, policies, and journey/report wiring your AEP architect
> deploys. Everything here keys on the exact fields the library sends.

```
ClearConsent            Edge          Real-Time CDP                     Activate           Measure
setConsent / Consent.update  →  Network  →  Identity → Profile        →   AJO journeys   →   CJA
+ marketing sendEvent                        + XDM Consents               Target             Adobe Analytics
                                             + DULE labels                Destinations
                                             + Consent Policies (enforce)
```

## 1. XDM — the Consents & Preferences field group

Add the **Consent & Preferences** field group to your ExperienceEvent (and,
where you persist to the profile, the Profile) schema. ClearConsent emits exactly
this shape (`y` / `n` values):

| XDM path | Emitted by | Source category |
|---|---|---|
| `consents.collect.val` | `setConsent` / `Consent.update` | union of analytics, personalization, advertising |
| `consents.share.val` | `setConsent` / `Consent.update` | advertising (forced `n` under GPC) |
| `consents.personalize.content.val` | `setConsent` / `Consent.update` | personalization |
| `consents.adID.{idType,val}` | `Consent.update` (mobile) | advertising · `IDFA`/`GAID` (omitted on web) |
| `consents.marketing.any.val` | marketing `sendEvent` | any marketing channel granted |
| `consents.marketing.email.val` | marketing `sendEvent` | `kind:'marketing'` category, channel `email` |
| `consents.marketing.push.val` | marketing `sendEvent` | `kind:'marketing'` category, channel `push` |
| `consents.metadata.time` | all | decision timestamp |

`collect`/`share`/`personalize`/`adID` are the **Edge-enforced** data purposes
(the Adobe consent standard 2.0). `marketing.*` are **profile consent** written
on an ExperienceEvent — the standard does not carry channel opt-ins, which is why
the library sends them via `sendEvent` rather than `setConsent`.

**Library config** — add marketing channels as `kind:'marketing'` categories:

```js
categories: [
  { id:'analytics',      label:'Analytics' },
  { id:'personalization',label:'Personalization' },
  { id:'advertising',    label:'Advertising' },
  { id:'email', label:'Email updates', kind:'marketing', marketingChannel:'email' },
  { id:'push',  label:'Push',          kind:'marketing', marketingChannel:'push'  },
],
adobe: { marketing: { eventType: 'consent.marketingPreference' } }
```

## 2. Datastream

In the datastream (lives in AEP, not Launch):
- **Adobe Experience Platform** service → the event dataset, with **Profile**
  enabled, so consents land on the profile.
- **Adobe Analytics** service → your report suite (feeds AA / A4T from the Edge).
- Forward to **AJO** and **Target** as needed.
- **Default Consent = Pending** — the Edge holds hits until `setConsent` /
  `Consent.update` answers. This is the one setting the whole banner depends on.

## 3. Identity — consent must attach to a person

RT-CDP can only apply *profile* opt-in/out if the event carries an
`identityMap`: **ECID** (primary, Alloy/Mobile SDK manages it) plus a **hashed
first-party id** in a custom namespace (never raw email/PII). ClearConsent's web
`setConsent` accepts an `identityMap`; set the known identity on login so the
consent record stitches to the person, not just an anonymous ECID.

## 4. Real-Time CDP — consent policies & merge

- **Consent policy** (Privacy → Policies): create a marketing consent policy
  keyed on `consents.marketing.email.val = 'y'` (and `push`), so profiles without
  the opt-in are **excluded from marketing audiences** — not filtered at send.
- **Merge policy**: ensure the consent field group merges onto the profile
  (latest-wins on `consents`), so the current decision governs.
- **Audiences** inherit their consent basis: an audience for an email journey is
  defined *with* the `marketing.email = y` condition.

## 5. Data Governance (DULE)

- **Label** the consent-relevant fields and datasets: `C1`/`C2` (contractual —
  e.g. no third-party export), `I1`/`I2` (identity), `S1`/`S2` (sensitive).
- **Usage policies** enforce labels at **destination activation**: a `C2`-labeled
  audience cannot be exported to an ad network. This is defense in depth on top of
  the consent policy.
- Regulated segments (e.g. propensity/firmographic) additionally require the
  human **Fair-Lending / privacy sign-off** at activation — governance gates on
  it, never bypasses it.

## 6. Adobe Journey Optimizer

- Gate **journey entry** and **channel send** on the profile's marketing consent:
  a condition on `consents.marketing.email.val = 'y'` for an email journey,
  `push` for push. A profile that opts out mid-journey is held at the next
  consent check.
- AJO's channel surfaces (email/push) should also honor the platform consent —
  align the surface's consent setting with these fields so a single opt-out
  suppresses across journeys.

## 7. Customer Journey Analytics

- Connect CJA to the **same** dataset the Edge writes, so measurement is on the
  events that drove the experience.
- Create a **derived field** from `consents.collect.val` (and
  `consents.marketing.any.val`) → a **Consent** dimension. Report consent rate,
  opted-in vs opted-out, and the marketing-reachable population, split by region.
- Events only land when `collect = y`; consent-rate denominators must come from a
  source allowed to fire (an essential-category beacon or server log).

## 8. Adobe Analytics

- Enable the **ECID Opt-In** service (Experience Cloud ID extension → Enable
  Opt-In = Yes). ClearConsent's Opt-In adapter stages `approve`/`deny` then
  `complete()`, and sets `s.abort`/`s.optOut` for any hardcoded `s.t()`.
- Map the **Consent Summary String** data element into one prop/eVar
  (`analytics+email|save_choices|EU`) for consent rate, method mix, and region in
  one dimension.

## 9. GPC / opt-out

ClearConsent honors **GPC** by default and records it on the decision; the web
adapter forces `share = n` / `adID = n`. In RT-CDP, define the advertising
audience to **suppress any profile under a GPC / CCPA opt-out** so suppression
happens *before* activation, not at send. For GDPR/UK traffic, advertising
requires prior opt-in (the region model already enforces this at capture).

## 10. Who does what

| Step | ClearConsent (code) | AEP architect (config) |
|---|---|---|
| Emit `consents.*` incl. `marketing.*` | ✅ | — |
| Schema field group | — | ✅ |
| Datastream + Default Consent = Pending | — | ✅ |
| identityMap (known id) | ✅ passes it | ✅ namespace + hashing |
| RT-CDP consent + merge policies | — | ✅ |
| DULE labels + usage policies | — | ✅ |
| AJO journey consent conditions | — | ✅ |
| CJA consent derived field | — | ✅ |
| AA Opt-In + Consent Summary String | ✅ drives it | ✅ prop/eVar + report suite |

### Deployment checklist

- [ ] Consent & Preferences field group on event (+ profile) schema
- [ ] Datastream: AEP+Profile, Analytics service, **Default Consent = Pending**
- [ ] identityMap: ECID + hashed first-party namespace
- [ ] RT-CDP marketing consent policy on `consents.marketing.email` / `push`
- [ ] DULE labels + activation usage policies
- [ ] AJO journeys gated on `consents.marketing.*`
- [ ] CJA consent derived field + report
- [ ] AA Opt-In enabled + Consent Summary String prop/eVar
- [ ] GPC/opt-out suppression in the advertising audience
- [ ] Verified end-to-end in a sandbox with Adobe Experience Platform Assurance

This is engineering guidance, not legal advice — categories, copy, retention, and
the consent policies themselves need your privacy/legal team's sign-off.
