import type { CategoryDefinition, ConsentConfig, RegionRule, UiText } from './types';

/**
 * The four defaults. They exist because they map cleanly onto what Adobe can
 * actually gate: collection, personalization, and advertising identifiers.
 */
export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'essential',
    label: 'Essential',
    summary: 'always on',
    description:
      'Required for the site to function — security, load balancing, remembering your privacy choices, and keeping you signed in. These cannot be switched off.',
    required: true,
    defaultGranted: true,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    summary: 'understand usage',
    description:
      'Helps us measure how the site performs — which pages are visited, where errors happen, and what to fix next. Reported in aggregate.',
    defaultGranted: false,
  },
  {
    id: 'personalization',
    label: 'Personalization',
    summary: 'tailored content',
    description:
      'Lets us remember your preferences and tailor the content and offers you see, rather than showing everyone the same thing.',
    defaultGranted: false,
  },
  {
    id: 'advertising',
    label: 'Advertising',
    summary: 'relevant offers',
    description:
      'Used to build an advertising profile and show you more relevant offers on this site and elsewhere. May involve sharing data with advertising partners.',
    defaultGranted: false,
  },
];

export const DEFAULT_TEXT: UiText = {
  title: 'Your privacy choices',
  body: 'We use cookies and similar technologies to run this site, measure how it performs, personalize your experience, and tailor offers. Choose what you are comfortable with — essential cookies are always on.',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  save: 'Save choices',
  preferences: 'Privacy choices',
  close: 'Close',
  privacyPolicy: 'Privacy policy',
  ariaLabel: 'Privacy and cookie preferences',
  savedAnnouncement: 'Your privacy choices have been saved.',
  detailsShow: 'Details',
  detailsHide: 'Hide details',
  cookieTableName: 'Name',
  cookieTableProvider: 'Provider',
  cookieTablePurpose: 'Purpose',
  cookieTableDuration: 'Duration',
  signalGpcTitle: 'Global Privacy Control — honored',
  signalGpcBody:
    'Your browser sent an opt-out signal, so sale, sharing, and non-essential cookies are already switched off. Nothing here is required — change anything you like.',
  signalDntTitle: 'Do Not Track — noted',
  signalDntBody:
    'We treat it as an advisory opt-out and left non-essential cookies off. GPC is the signal with legal force; this one we honor as a courtesy.',
  signalMoreInfo: 'How we handle signals',
};

/**
 * EEA/UK/CH and Brazil require prior opt-in. US state laws are opt-out with a
 * mandatory honoring of Global Privacy Control. Everything else falls through
 * to `*`, which is opt-in by default — the safe direction to be wrong in.
 */
export const DEFAULT_REGIONS: RegionRule[] = [
  {
    match: [
      'EU', 'EEA', 'GB', 'UK', 'CH',
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
      'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
      'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
      'BR',
    ],
    model: 'opt_in',
  },
  {
    match: [
      'US', 'US-CA', 'US-CO', 'US-CT', 'US-VA', 'US-UT', 'US-TX', 'US-OR',
      'US-MT', 'US-DE', 'US-IA', 'US-NE', 'US-NH', 'US-NJ', 'US-TN', 'US-MN',
      'US-MD', 'US-RI', 'US-KY', 'US-IN',
      'CA',
    ],
    model: 'opt_out',
    defaultGranted: ['essential', 'analytics', 'personalization', 'advertising'],
  },
  { match: ['*'], model: 'opt_in' },
];

export const DEFAULT_CONFIG: ConsentConfig = {
  policyVersion: 1,
  categories: DEFAULT_CATEGORIES,
  model: 'opt_in',
  regions: DEFAULT_REGIONS,
  storage: {},
  ui: {
    layout: 'modal',
    position: 'center',
    blocking: true,
    showBadge: true,
    badgePosition: 'bottom-left',
    categoriesOnFirstLayer: true,
    lang: 'en',
  },
  adobe: {},
  receipt: { enabled: true, historySize: 10 },
  honorGpc: true,
  honorDnt: false,
  autoBlock: true,
  reconsentDays: 365,
  debug: false,
  autoInit: true,
};
