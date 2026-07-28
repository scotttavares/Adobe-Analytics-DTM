import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentEngine } from '../src/core/engine';
import { deserialize, serialize } from '../src/core/storage';
import { matchRegionRule } from '../src/core/geo';
import type { ConsentState } from '../src/core/types';

function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  }
  window.localStorage.clear();
}

describe('storage serialization', () => {
  it('round-trips a decision', () => {
    const state: ConsentState = {
      schema: 1,
      policyVersion: 3,
      categories: { essential: true, analytics: true, advertising: false },
      timestamp: 1700000000000,
      method: 'save_choices',
      id: 'abc123',
      region: 'US-CA',
      gpc: true,
    };
    const restored = deserialize(serialize(state));
    expect(restored).toEqual(state);
  });

  it('returns null for corrupt input', () => {
    expect(deserialize('not-json')).toBeNull();
    expect(deserialize(null)).toBeNull();
    expect(deserialize(encodeURIComponent('{"nope":1}'))).toBeNull();
  });

  it('stays small enough for a cookie', () => {
    const state: ConsentState = {
      schema: 1,
      policyVersion: 1,
      categories: {
        essential: true,
        analytics: true,
        personalization: false,
        advertising: false,
      },
      timestamp: Date.now(),
      method: 'accept_all',
      id: '3f6a9c1e-1b2d-4c3a-9e8f-0a1b2c3d4e5f',
      region: 'EU',
    };
    expect(serialize(state).length).toBeLessThan(400);
  });
});

describe('region rules', () => {
  const rules = [
    { match: ['DE', 'FR'], model: 'opt_in' as const },
    { match: ['US'], model: 'opt_out' as const },
    { match: ['US-CA'], model: 'opt_out' as const, defaultGranted: ['essential'] },
    { match: ['*'], model: 'notice_only' as const },
  ];

  it('prefers an exact subdivision match over the country', () => {
    expect(matchRegionRule('US-CA', rules)?.defaultGranted).toEqual(['essential']);
  });

  it('falls back to the country when no subdivision matches', () => {
    expect(matchRegionRule('US-TX', rules)?.model).toBe('opt_out');
  });

  it('falls back to the wildcard', () => {
    expect(matchRegionRule('JP', rules)?.model).toBe('notice_only');
  });

  it('matches case-insensitively', () => {
    expect(matchRegionRule('de', rules)?.model).toBe('opt_in');
  });
});

describe('ConsentEngine', () => {
  beforeEach(() => clearCookies());

  it('denies every non-essential category before a choice in an opt-in region', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();

    expect(engine.hasConsent('essential')).toBe(true);
    expect(engine.hasConsent('analytics')).toBe(false);
    expect(engine.hasConsent('advertising')).toBe(false);
    expect(engine.isPending()).toBe(true);
    expect(engine.shouldPrompt()).toBe(true);
  });

  it('grants the regional defaults before a choice in an opt-out region', () => {
    const engine = new ConsentEngine({ geo: { region: 'US-TX' }, honorGpc: false });
    engine.start();

    expect(engine.model).toBe('opt_out');
    expect(engine.hasConsent('analytics')).toBe(true);
    expect(engine.hasConsent('advertising')).toBe(true);
  });

  it('never pre-grants in an opt-in region, per Planet49', () => {
    const engine = new ConsentEngine({ geo: { region: 'FR' } });
    engine.start();
    for (const category of engine.getCategories()) {
      if (!category.required) expect(engine.hasConsent(category.id)).toBe(false);
    }
  });

  it('persists a decision and restores it on the next page load', () => {
    const first = new ConsentEngine({ geo: { region: 'DE' } });
    first.start();
    first.save({ analytics: true, advertising: false });

    const second = new ConsentEngine({ geo: { region: 'DE' } });
    second.start();

    expect(second.hasConsent('analytics')).toBe(true);
    expect(second.hasConsent('advertising')).toBe(false);
    expect(second.isPending()).toBe(false);
    expect(second.shouldPrompt()).toBe(false);
  });

  it('re-prompts when the policy version is bumped', () => {
    const first = new ConsentEngine({ geo: { region: 'DE' }, policyVersion: 1 });
    first.start();
    first.acceptAll();

    const second = new ConsentEngine({ geo: { region: 'DE' }, policyVersion: 2 });
    second.start();

    expect(second.isPending()).toBe(true);
    expect(second.hasConsent('analytics')).toBe(false);
  });

  it('re-prompts once the decision has aged past the re-consent window', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    engine.acceptAll();

    const stale = new ConsentEngine({ geo: { region: 'DE' }, reconsentDays: 180 });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 200 * 864e5);
    stale.start();
    vi.restoreAllMocks();

    expect(stale.isPending()).toBe(true);
  });

  it('forces required categories on even when told otherwise', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    engine.save({ essential: false, analytics: true });
    expect(engine.hasConsent('essential')).toBe(true);
  });

  it('reports granted and revoked categories on change', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    engine.acceptAll();

    const changes: Array<{ granted: string[]; revoked: string[] }> = [];
    engine.on('change', (e) => changes.push({ granted: e.granted, revoked: e.revoked }));

    engine.save({ analytics: true });

    expect(changes).toHaveLength(1);
    expect(changes[0]!.revoked.sort()).toEqual(['advertising', 'personalization']);
    expect(changes[0]!.granted).toEqual([]);
  });

  it('treats Escape / dismissal as a rejection in an opt-in region', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    engine.dismiss();
    expect(engine.hasConsent('analytics')).toBe(false);
    expect(engine.getState()?.method).toBe('reject_all');
  });

  it('resets back to the pre-consent state', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    engine.acceptAll();
    engine.reset();
    expect(engine.isPending()).toBe(true);
    expect(engine.hasConsent('analytics')).toBe(false);
  });
});

describe('consent gating', () => {
  beforeEach(() => clearCookies());

  it('runs the callback immediately when already granted', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    engine.acceptAll();

    const fn = vi.fn();
    engine.gate('analytics', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('queues until the category is granted, then runs once', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();

    const fn = vi.fn();
    engine.gate('analytics', fn);
    expect(fn).not.toHaveBeenCalled();

    engine.save({ analytics: true });
    expect(fn).toHaveBeenCalledTimes(1);

    engine.save({ analytics: true, personalization: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('never runs a callback for a category that stays denied', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();

    const fn = vi.fn();
    engine.gate('advertising', fn);
    engine.save({ analytics: true });
    expect(fn).not.toHaveBeenCalled();
  });

  it('can cancel a queued callback', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();

    const fn = vi.fn();
    const cancel = engine.gate('analytics', fn);
    cancel();
    engine.acceptAll();
    expect(fn).not.toHaveBeenCalled();
  });

  it('isolates a throwing callback from the rest', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();

    const good = vi.fn();
    engine.gate('analytics', () => {
      throw new Error('boom');
    });
    engine.gate('analytics', good);
    engine.acceptAll();
    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe('browser privacy signals', () => {
  beforeEach(() => clearCookies());

  it('records a rejection and skips the prompt when GPC is set', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: true,
      configurable: true,
    });

    const engine = new ConsentEngine({ geo: { region: 'US-CA' }, honorGpc: true });
    engine.start();

    expect(engine.hasConsent('advertising')).toBe(false);
    expect(engine.hasConsent('analytics')).toBe(false);
    expect(engine.shouldPrompt()).toBe(false);
    expect(engine.getState()?.method).toBe('gpc');
    expect(engine.getState()?.gpc).toBe(true);

    // @ts-expect-error cleaning up the stub
    delete navigator.globalPrivacyControl;
  });

  it('resolves a GPC page in a single pass, not two', () => {
    // The GPC decision is committed during start(), before `ready` fires. If it
    // also emitted `change`, every adapter would run twice on the first page
    // load — two setConsent calls, two optIn completes, two data layer pushes.
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: true,
      configurable: true,
    });

    const engine = new ConsentEngine({ geo: { region: 'US-CA' }, honorGpc: true });
    const order: string[] = [];
    engine.on('ready', () => order.push('ready'));
    engine.on('change', () => order.push('change'));
    engine.start();

    expect(order).toEqual(['ready']);

    // @ts-expect-error cleaning up the stub
    delete navigator.globalPrivacyControl;
  });

  it('still emits change when the visitor later overrides GPC', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: true,
      configurable: true,
    });

    const engine = new ConsentEngine({ geo: { region: 'US-CA' }, honorGpc: true });
    engine.start();

    const changes: string[][] = [];
    engine.on('change', (e) => changes.push(e.granted));
    engine.save({ analytics: true });

    expect(changes).toEqual([['analytics']]);

    // @ts-expect-error cleaning up the stub
    delete navigator.globalPrivacyControl;
  });

  it('ignores GPC when the site turns it off', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: true,
      configurable: true,
    });

    const engine = new ConsentEngine({ geo: { region: 'US-TX' }, honorGpc: false });
    engine.start();
    expect(engine.hasConsent('analytics')).toBe(true);

    // @ts-expect-error cleaning up the stub
    delete navigator.globalPrivacyControl;
  });
});

describe('consent receipts', () => {
  beforeEach(() => clearCookies());

  it('writes an auditable receipt for each decision', () => {
    const engine = new ConsentEngine({
      geo: { region: 'DE' },
      receipt: { enabled: true, historySize: 5 },
    });
    engine.start();
    engine.acceptAll();

    const receipt = engine.getLastReceipt();
    expect(receipt).toBeTruthy();
    expect(receipt!.method).toBe('accept_all');
    expect(receipt!.categories.analytics).toBe(true);
    expect(receipt!.digest).toMatch(/^[0-9a-f]{8}$/);
    expect(engine.getReceipts().length).toBe(1);
  });

  it('caps the stored history', () => {
    const engine = new ConsentEngine({
      geo: { region: 'DE' },
      receipt: { enabled: true, historySize: 3 },
    });
    engine.start();
    for (let i = 0; i < 6; i++) engine.save({ analytics: i % 2 === 0 });
    expect(engine.getReceipts().length).toBe(3);
  });
});
