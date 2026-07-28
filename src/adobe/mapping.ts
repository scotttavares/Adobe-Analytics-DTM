import type { AdobeCategoryMapping, CategoryId, ConsentDecision } from '../core/types';

/**
 * Default wiring from the four shipped categories onto Adobe's purposes.
 *
 * `collect` is the union of every non-essential data category rather than just
 * analytics: in the Adobe consent standard it is the master switch on data
 * collection, so mapping it to analytics alone would silently kill
 * personalization for a visitor who allowed personalization but not analytics.
 */
export const DEFAULT_MAPPING: Required<AdobeCategoryMapping> = {
  collect: ['analytics', 'personalization', 'advertising'],
  share: ['advertising'],
  personalize: ['personalization'],
  adId: ['advertising'],
  analytics: ['analytics'],
  target: ['personalization'],
  audienceManager: ['advertising'],
  ecid: ['analytics', 'personalization', 'advertising'],
};

export function resolveMapping(
  override?: AdobeCategoryMapping
): Required<AdobeCategoryMapping> {
  return { ...DEFAULT_MAPPING, ...(override || {}) };
}

/** True when any of the mapped categories is granted. */
export function anyGranted(
  categories: CategoryId[] | undefined,
  decision: ConsentDecision
): boolean {
  if (!categories || categories.length === 0) return false;
  for (const id of categories) if (decision[id] === true) return true;
  return false;
}

/** `y`/`n` as used by the Adobe consent standard 2.0. */
export function yn(granted: boolean): 'y' | 'n' {
  return granted ? 'y' : 'n';
}
