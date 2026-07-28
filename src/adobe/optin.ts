import type { ConsentEngine } from '../core/engine';
import type { ConsentDecision, OptInOptions } from '../core/types';
import { anyGranted, resolveMapping } from './mapping';

/**
 * The ECID Opt-In service, which is how consent reaches the classic Experience
 * Cloud stack: AppMeasurement, at.js, and the Audience Manager DIL all check it
 * before firing. This is the path that matters for a DTM/AppMeasurement estate
 * that has not moved to the Web SDK yet.
 */

export interface OptInApi {
  approve(categories: string[], shouldWaitForComplete?: boolean): void;
  deny(categories: string[], shouldWaitForComplete?: boolean): void;
  approveAll?(): void;
  denyAll?(): void;
  complete(): void;
  isApproved(categories?: string[]): boolean;
  isPreApproved?(categories: string[]): boolean;
  fetchPermissions?(
    callback: (permissions: unknown) => void,
    shouldAutoSubscribe?: boolean
  ): void;
  /** `pending` | `changed` | `complete`. */
  status?: string;
  permissions?: Record<string, boolean>;
  doesOptInApply?: boolean;
  isPending?: boolean;
  isComplete?: boolean;
}

interface AdobeGlobal {
  optIn?: OptInApi;
  OptInCategories?: Record<string, string>;
}

interface OptInWindow extends Window {
  adobe?: AdobeGlobal;
}

/**
 * Category ids used by the Opt-In service. Read from `adobe.OptInCategories`
 * at runtime when available so an Adobe-side rename cannot break us; these are
 * the fallback values.
 *
 * Adobe's API reference documents only `aam`, `aa`, `ecid`, and `target`, but
 * the shipped VisitorAPI also defines `adcloud`, `campaign`, `livefyre`, and
 * `mediaaa`. Passing an id the loaded library does not know throws an
 * "[OptIn] Invalid category" error, so the extras are listed here for lookup
 * but never sent unless a site maps a category onto them.
 */
export const OPT_IN_CATEGORIES = {
  ECID: 'ecid',
  ANALYTICS: 'aa',
  TARGET: 'target',
  AUDIENCE_MANAGER: 'aam',
  AD_CLOUD: 'adcloud',
  CAMPAIGN: 'campaign',
  LIVEFYRE: 'livefyre',
  MEDIA_ANALYTICS: 'mediaaa',
} as const;

export class OptInAdapter {
  private engine: ConsentEngine;
  private opts: OptInOptions;
  private mapping: ReturnType<typeof resolveMapping>;

  constructor(
    engine: ConsentEngine,
    opts: OptInOptions = {},
    mappingOverride?: Parameters<typeof resolveMapping>[0]
  ) {
    this.engine = engine;
    this.opts = opts;
    this.mapping = resolveMapping(mappingOverride);
  }

  private get api(): OptInApi | null {
    const adobe = (window as OptInWindow).adobe;
    return adobe && adobe.optIn ? adobe.optIn : null;
  }

  private category(key: keyof typeof OPT_IN_CATEGORIES): string {
    const fromAdobe = (window as OptInWindow).adobe?.OptInCategories;
    const adobeKey = key === 'AUDIENCE_MANAGER' ? 'AAM' : key;
    const value = fromAdobe ? fromAdobe[adobeKey] : undefined;
    return value || OPT_IN_CATEGORIES[key];
  }

  /**
   * Drops ids the loaded VisitorAPI does not recognize. Older builds define
   * fewer categories, and an unknown id makes the whole call fail with
   * "[OptIn] Invalid category(-ies)" rather than being ignored.
   */
  private known(categories: string[]): string[] {
    const fromAdobe = (window as OptInWindow).adobe?.OptInCategories;
    if (!fromAdobe) return categories;
    const valid: Record<string, true> = {};
    for (const key of Object.keys(fromAdobe)) {
      const value = fromAdobe[key];
      if (value) valid[value] = true;
    }
    return categories.filter((id) => valid[id] === true);
  }

  /** Splits the current decision into Opt-In categories to approve vs deny. */
  buildPermissions(decision: ConsentDecision): { approve: string[]; deny: string[] } {
    const pairs: Array<[keyof typeof OPT_IN_CATEGORIES, boolean]> = [
      ['ECID', anyGranted(this.mapping.ecid, decision)],
      ['ANALYTICS', anyGranted(this.mapping.analytics, decision)],
      ['TARGET', anyGranted(this.mapping.target, decision)],
      ['AUDIENCE_MANAGER', anyGranted(this.mapping.audienceManager, decision)],
    ];

    const approve: string[] = [];
    const deny: string[] = [];
    for (const [key, granted] of pairs) {
      (granted ? approve : deny).push(this.category(key));
    }
    return { approve, deny };
  }

  send(decision: ConsentDecision): void {
    const api = this.api;
    if (!api) {
      this.engine.log.warn('adobe.optIn not found; is "Enable Opt-In" on in the ECID extension?');
      return;
    }

    const built = this.buildPermissions(decision);
    const approve = this.known(built.approve);
    const deny = this.known(built.deny);

    try {
      // `true` defers the internal callbacks so approve+deny land as one
      // transaction; `complete()` then applies them in a single pass.
      if (approve.length) api.approve(approve, true);
      if (deny.length && this.opts.denyUnconsented !== false) api.deny(deny, true);
      api.complete();
      this.engine.log.log('optIn approved:', approve, 'denied:', deny);
    } catch (e) {
      this.engine.log.error('adobe.optIn call failed', e);
    }
  }

  attach(): void {
    if (this.opts.enabled === false) return;
    this.engine.on('ready', () => this.send(this.engine.decision));
    this.engine.on('change', () => this.send(this.engine.decision));
  }
}
