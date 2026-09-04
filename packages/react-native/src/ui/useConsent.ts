import { useContext } from 'react';
import { ClearConsentContext, type ClearConsentContextValue } from './context';

/** Access consent state and actions. Must be used under `<ClearConsentProvider>`. */
export function useConsent(): ClearConsentContextValue {
  const ctx = useContext(ClearConsentContext);
  if (!ctx) {
    throw new Error('useConsent must be used within a <ClearConsentProvider>');
  }
  return ctx;
}
