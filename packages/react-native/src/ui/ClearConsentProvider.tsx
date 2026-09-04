import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConsentEngine } from '../../../../src/core/engine';
import type { ConsentConfig, ConsentDecision } from '../../../../src/core/types';
import { createMobileConsent, type MobileConsentSetup } from '../createMobileConsent';
import { ClearConsentContext, type ClearConsentContextValue } from './context';
import { ConsentBanner } from './ConsentBanner';
import { PreferenceCenter } from './PreferenceCenter';
import type { ConsentTheme, ConsentUiText } from './theme';

export interface ClearConsentProviderProps extends MobileConsentSetup {
  /** Engine configuration (categories, regions, policy version, mapping, …). */
  config: ConsentConfig;
  theme?: Partial<ConsentTheme>;
  text?: Partial<ConsentUiText>;
  children?: React.ReactNode;
}

/**
 * Boots the consent engine for React Native and renders the banner and
 * preference center. Wrap your app in it once, near the root. The engine is
 * hydrated from storage before the banner can show, so a returning user's saved
 * decision is never briefly ignored on cold start.
 */
export function ClearConsentProvider(props: ClearConsentProviderProps): React.ReactElement {
  const { config, consent, storage, edge, onStorageError, theme, text, children } = props;

  const engineRef = useRef<ConsentEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [decision, setDecision] = useState<ConsentDecision>({});
  const [prompting, setPrompting] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let detach: (() => void) | undefined;

    void createMobileConsent(config, { consent, storage, edge, onStorageError }).then((engine) => {
      if (!active) return;
      engineRef.current = engine;
      const sync = () => {
        setDecision(engine.decision);
        setPrompting(engine.shouldPrompt());
      };
      sync();
      setReady(true);
      const offReady = engine.on('ready', sync);
      const offChange = engine.on('change', sync);
      detach = () => {
        offReady();
        offChange();
      };
    });

    return () => {
      active = false;
      detach?.();
    };
    // Boot once; config and setup are not meant to change at runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPreferences = useCallback(() => setPrefsOpen(true), []);
  const closePreferences = useCallback(() => setPrefsOpen(false), []);

  const value = useMemo<ClearConsentContextValue>(
    () => ({
      ready,
      decision,
      hasConsent: (c) => engineRef.current?.hasConsent(c) === true,
      acceptAll: () => {
        engineRef.current?.acceptAll();
        setPrefsOpen(false);
      },
      rejectAll: () => {
        engineRef.current?.rejectAll();
        setPrefsOpen(false);
      },
      save: (choice) => {
        engineRef.current?.save(choice);
        setPrefsOpen(false);
      },
      openPreferences,
      closePreferences,
      gate: (c, fn) => engineRef.current?.gate(c, fn) ?? (() => undefined),
    }),
    [ready, decision, openPreferences, closePreferences]
  );

  const engine = engineRef.current;

  return (
    <ClearConsentContext.Provider value={value}>
      {children}
      {ready && engine && prompting ? (
        <ConsentBanner engine={engine} theme={theme} text={text} onManage={openPreferences} />
      ) : null}
      {ready && engine && prefsOpen ? (
        <PreferenceCenter engine={engine} theme={theme} text={text} onClose={closePreferences} />
      ) : null}
    </ClearConsentContext.Provider>
  );
}
