/**
 * Browser-level privacy signals.
 *
 * GPC is legally binding as an opt-out under CPRA and the Colorado Privacy Act,
 * so it is honored by default. DNT has no legal force and is off by default.
 */

interface GpcNavigator extends Navigator {
  globalPrivacyControl?: boolean;
  msDoNotTrack?: string;
}

interface GpcWindow extends Window {
  doNotTrack?: string;
  globalPrivacyControl?: boolean;
}

export function hasGpc(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as GpcNavigator;
  if (nav.globalPrivacyControl === true) return true;
  if (typeof window !== 'undefined' && (window as GpcWindow).globalPrivacyControl === true) {
    return true;
  }
  return false;
}

export function hasDnt(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as GpcNavigator;
  const raw =
    nav.doNotTrack ||
    (typeof window !== 'undefined' ? (window as GpcWindow).doNotTrack : undefined) ||
    nav.msDoNotTrack;
  return raw === '1' || raw === 'yes';
}

/**
 * True when the browser is telling us not to sell or share. Either signal, when
 * enabled, is treated as a rejection of every non-essential category.
 */
export function shouldAutoReject(honorGpc: boolean, honorDnt: boolean): 'gpc' | 'dnt' | null {
  if (honorGpc && hasGpc()) return 'gpc';
  if (honorDnt && hasDnt()) return 'dnt';
  return null;
}
