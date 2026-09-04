import { createContext } from 'react';
import type { ConsentDecision } from '../../../../src/core/types';

export interface ClearConsentContextValue {
  /** True once the engine has hydrated persisted state and started. */
  ready: boolean;
  /** Categories in force right now, including implied defaults. */
  decision: ConsentDecision;
  hasConsent: (category: string) => boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  save: (choice: ConsentDecision) => void;
  openPreferences: () => void;
  closePreferences: () => void;
  /** Run `fn` when `category` is granted — now if it already is, else queued. */
  gate: (category: string, fn: () => void) => () => void;
}

export const ClearConsentContext = createContext<ClearConsentContextValue | null>(null);
