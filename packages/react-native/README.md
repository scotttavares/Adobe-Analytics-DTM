# @clearconsent/react-native

A React Native consent manager for **Adobe Experience Platform (Edge)**. It is
the mobile counterpart to the ClearConsent web build and **shares the same
consent engine** — the state machine, region resolver, policy versioning,
receipts, and category → Adobe purpose mapping are the exact code the web uses,
so a decision behaves and serializes identically across web and app. Only the
platform seams are new: storage (AsyncStorage/MMKV), the Adobe adapter
(`Consent.update`), and the UI (React Native components).

> **Status: v1, bare React Native, Edge Consent.** The plumbing is unit-tested;
> the UI needs a device/simulator (see *Verifying on device*). Native modules
> mean this needs **bare RN or an Expo dev build** — not Expo Go.

---

## Install

```sh
npm install @clearconsent/react-native \
  @adobe/react-native-aepcore @adobe/react-native-aepedge \
  @adobe/react-native-aepedgeconsent \
  @react-native-async-storage/async-storage
cd ios && pod install && cd ..
```

## Configure Adobe (once)

1. In your **mobile** Data Collection (Tags) property, add the **Adobe
   Experience Platform Edge Network** and **Consent for Edge Network**
   extensions and a datastream.
2. Set **Default Consent = Pending** in the Consent extension. This is the one
   required setting — it makes the SDK hold hits until ClearConsent answers,
   exactly like `defaultConsent: pending` on the Web SDK. Leave it at *In* and
   the SDK collects before the banner, making the banner cosmetic.
3. Initialize the SDK at app start with your mobile property's App ID:

```ts
import { MobileCore } from '@adobe/react-native-aepcore';
MobileCore.initializeWithAppId('YOUR_MOBILE_PROPERTY_APP_ID');
```

## Use

Wrap your app once, near the root:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Consent } from '@adobe/react-native-aepedgeconsent';
import { ClearConsentProvider } from '@clearconsent/react-native';

export default function App() {
  return (
    <ClearConsentProvider
      consent={Consent}
      storage={AsyncStorage}
      config={{
        policyVersion: 1,
        categories: [
          { id: 'essential', label: 'Essential', required: true, summary: 'Needed to run the app.' },
          { id: 'analytics', label: 'Analytics', summary: 'Helps us understand usage.' },
          { id: 'personalization', label: 'Personalization', summary: 'Tailors content to you.' },
          { id: 'advertising', label: 'Advertising', summary: 'Measures campaigns.' },
        ],
        regions: [
          { match: ['EU', 'DE', 'FR', 'GB'], model: 'opt_in' },
          { match: ['US-CA'], model: 'opt_out', defaultGranted: ['essential', 'analytics'] },
          { match: ['*'], model: 'opt_in' },
        ],
        geo: { region: 'DE' }, // or omit and set an endpoint; region drives the model
      }}
      edge={{ adIdType: 'IDFA' }} // optional — send the ad id (IDFA/GAID); see ATT below
    >
      <RootNavigator />
    </ClearConsentProvider>
  );
}
```

Read and gate elsewhere with the hook — same `gate()` primitive as the web:

```tsx
import { useConsent } from '@clearconsent/react-native';

function Screen() {
  const { hasConsent, openPreferences, gate } = useConsent();

  useEffect(() => gate('analytics', () => startAnalytics()), []); // runs now, or when granted

  return <Button title="Privacy choices" onPress={openPreferences} />;
}
```

### MMKV instead of AsyncStorage

Any store matching `KeyValueStore` works. MMKV is synchronous, so wrap it:

```ts
import { MMKV } from 'react-native-mmkv';
const mmkv = new MMKV();
const storage = {
  getItem: async (k: string) => mmkv.getString(k) ?? null,
  setItem: async (k: string, v: string) => { mmkv.set(k, v); },
  removeItem: async (k: string) => { mmkv.delete(k); },
};
```

## Marketing consent (AJO / RTCDP)

`collect / share / personalize / adID` gate *data collection*. Adobe Journey
Optimizer journeys and RT-CDP marketing policies gate on *channel* consent —
`consents.marketing.*`. Add marketing channels as `kind:'marketing'` categories
and wire an Edge sender so the opt-ins reach the profile:

```tsx
import { Edge, ExperienceEvent } from '@adobe/react-native-aepedge';

<ClearConsentProvider
  consent={Consent}
  storage={AsyncStorage}
  edge={{
    adIdType: 'IDFA',
    edgeSender: { sendEvent: (xdm) => Edge.sendEvent(new ExperienceEvent({ xdmData: xdm })) },
  }}
  config={{
    categories: [
      { id:'analytics',   label:'Analytics' },
      { id:'advertising', label:'Advertising' },
      { id:'email', label:'Email updates', kind:'marketing', marketingChannel:'email' },
      { id:'push',  label:'Push',          kind:'marketing', marketingChannel:'push'  },
    ],
  }}
>
```

The data purposes still go through `Consent.update`; the marketing opt-ins are
written to the profile via `Edge.sendEvent`. The AEP side — schema field group,
RT-CDP consent policies, AJO journey conditions, CJA/AA reporting — is in
[`docs/aep-governance.md`](../../docs/aep-governance.md).

## What it sends

On start and on every change, for the resolved decision:

```ts
Consent.update({
  consents: {
    collect:     { val: 'y' },
    share:       { val: 'n' },
    personalize: { content: { val: 'y' } },
    adID:        { idType: 'IDFA', val: 'y' }, // only when `edge.adIdType` is set
    metadata:    { time: '2026-09-04T…' },
  },
});
```

`collect` is granted if **any** of analytics/personalization/advertising is —
Adobe enforces consent all-or-nothing on `collect`. Override with
`edge.mapping`.

### iOS App Tracking Transparency

Unlike the web, mobile has a real advertising id, so `adID` is sent when you set
`edge.adIdType`. Gate it on ATT — pass `edge.attAuthorized`, and when it returns
false `adID` is sent as denied regardless of the advertising category:

```tsx
import { getTrackingStatus } from 'react-native-tracking-transparency';
edge={{ adIdType: 'IDFA', attAuthorized: () => attStatus === 'authorized' }}
```

## Compliance behaviors (same as web)

Reject is rendered identically to Accept (same size/weight); nothing is
pre-ticked under an opt-in model; Android hardware back / swipe-dismiss records a
rejection via `engine.dismiss()`, never silent consent. Not legal advice — your
categories, copy, and retention still need a lawyer's eye.

## Verifying on device

The plumbing is unit-tested in CI (`npx vitest run --root packages/react-native`).
The UI and the native round-trip need a simulator/device:

- [ ] `pod install` succeeds; app builds on iOS and Android.
- [ ] AEP SDK initialized with your **mobile** property App ID.
- [ ] **Default Consent = Pending** in the mobile property.
- [ ] Banner shows on first launch; Accept fires `Consent.update` with
      `collect: y` (confirm in **Adobe Experience Platform Assurance**).
- [ ] Reject → `collect: n`; no Edge hit fires before the choice.
- [ ] Decision persists across relaunch (no re-prompt).
- [ ] iOS: ATT and `adID` agree.

## Architecture note

For v1 this package imports the shared core directly from the repo
(`src/core`, `src/adobe/mapping`) so web and mobile provably share one engine,
mapping, and on-disk format. **Publishing to npm requires extracting that shared
code into a `@clearconsent/core` package** and depending on it — that extraction
is the first productionization step and does not change any behavior here.
