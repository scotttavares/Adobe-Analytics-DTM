import { DEFAULT_CONFIG, DEFAULT_CATEGORIES } from './defaults';
import { detectRegion, resolveRegion, type ResolvedRegion } from './geo';
import { appendHistory, buildReceipt, readHistory, sendReceipt } from './receipt';
import { shouldAutoReject } from './signals';
import { ConsentStorage } from './storage';
import type {
  CategoryDefinition,
  CategoryId,
  ConsentChangeEvent,
  ConsentConfig,
  ConsentDecision,
  ConsentEventName,
  ConsentMethod,
  ConsentReceipt,
  ConsentState,
} from './types';
import { createLogger, merge, shallowEqual, uid, type Logger } from './util';

type Listener = (payload: any) => void;

export interface EngineHooks {
  /** Asked before showing UI, so the host can veto (e.g. headless mode). */
  canShowUi?: () => boolean;
  /** Copy currently on screen, recorded into the receipt when enabled. */
  getCopy?: () => ConsentReceipt['copy'];
}

/**
 * The consent state machine. Owns the decision, the storage, the region rules,
 * and the event bus. Knows nothing about DOM rendering or Adobe — those attach
 * as listeners, which is what keeps the headless and UI paths identical.
 */
export class ConsentEngine {
  readonly config: ConsentConfig;
  readonly storage: ConsentStorage;
  readonly log: Logger;

  private categories: CategoryDefinition[];
  private listeners = new Map<ConsentEventName, Listener[]>();
  private gateQueue = new Map<CategoryId, Array<() => void>>();
  private hooks: EngineHooks;

  private state: ConsentState | null = null;
  private effective: ConsentDecision = {};
  private regionInfo: ResolvedRegion;
  private started = false;
  private pendingDecision = true;
  private lastReceipt: ConsentReceipt | null = null;

  constructor(config: ConsentConfig = {}, hooks: EngineHooks = {}) {
    this.config = merge(DEFAULT_CONFIG, config);
    this.categories = this.config.categories?.length
      ? this.config.categories
      : DEFAULT_CATEGORIES;
    this.storage = new ConsentStorage(this.config.storage);
    this.log = createLogger(!!this.config.debug);
    this.hooks = hooks;
    this.regionInfo = {
      region: this.config.geo?.region || this.config.geo?.fallbackRegion || 'EU',
      model: this.config.model || 'opt_in',
      defaultGranted: [],
      suppressBanner: false,
    };
  }

  // ---------------------------------------------------------------- lifecycle

  /**
   * Resolves the region, restores or computes the initial decision, and fires
   * `ready`. Safe to call twice; the second call is a no-op.
   */
  start(): ConsentState {
    if (this.started) return this.snapshot();
    this.started = true;

    const detection = detectRegion(this.config.geo || {}, this.storage);
    this.applyRegion(detection.immediate);

    const stored = this.storage.read();
    const valid = stored && this.isStateValid(stored);

    if (valid && stored) {
      this.state = stored;
      this.pendingDecision = false;
      this.effective = this.withRequired(stored.categories);
      this.log.log('restored decision', this.effective);
    } else {
      if (stored) this.log.log('stored decision discarded (version bump or expiry)');
      this.pendingDecision = true;
      this.effective = this.defaultDecision();

      const auto = shouldAutoReject(!!this.config.honorGpc, !!this.config.honorDnt);
      if (auto) {
        // A browser-level opt-out is a decision. Record it so the visitor is
        // not asked again, and so the receipt shows where it came from.
        this.log.log('honoring browser privacy signal:', auto);
        this.commit(this.rejectedDecision(), auto === 'gpc' ? 'gpc' : 'dnt', {
          silent: true,
          gpc: auto === 'gpc',
        });
        this.pendingDecision = false;
      }
    }

    this.emit('ready', this.snapshot());
    this.flushGates();
    if (this.config.onReady) this.config.onReady(this.snapshot());

    // Region may arrive after first paint; re-evaluate only if still undecided.
    if (detection.pending) {
      void detection.pending.then((region) => {
        if (region === this.regionInfo.region) return;
        this.applyRegion(region);
        if (this.pendingDecision) {
          // Diff against what was actually in force under the fallback region.
          // Passing no baseline would make `before` an empty object, so a
          // tightening model (US fallback -> EU actual) would report nothing as
          // revoked and every still-granted category as newly granted.
          const previousEffective = { ...this.effective };
          this.effective = this.defaultDecision();
          this.log.log('region resolved late:', region, this.regionInfo.model);
          this.emit('change', this.buildChangeEvent(null, true, previousEffective));
          this.flushGates();
        }
      });
    }

    return this.snapshot();
  }

  private applyRegion(region: string): void {
    this.regionInfo = resolveRegion(
      region,
      this.config.regions || [],
      this.config.model || 'opt_in'
    );
  }

  private isStateValid(state: ConsentState): boolean {
    if (state.policyVersion !== (this.config.policyVersion ?? 1)) return false;
    if (this.storage.isExpired(state, this.config.reconsentDays)) return false;
    return true;
  }

  // ------------------------------------------------------------------ queries

  /** The categories in force right now, including implied defaults. */
  get decision(): ConsentDecision {
    return { ...this.effective };
  }

  get region(): string {
    return this.regionInfo.region;
  }

  get model(): ResolvedRegion['model'] {
    return this.regionInfo.model;
  }

  getCategories(): CategoryDefinition[] {
    return this.categories;
  }

  hasConsent(category: CategoryId): boolean {
    return this.effective[category] === true;
  }

  /** True when the visitor has not made an explicit choice yet. */
  isPending(): boolean {
    return this.pendingDecision;
  }

  getState(): ConsentState | null {
    return this.state ? { ...this.state, categories: { ...this.state.categories } } : null;
  }

  getReceipts(): ConsentReceipt[] {
    return readHistory(this.storage);
  }

  getLastReceipt(): ConsentReceipt | null {
    return this.lastReceipt;
  }

  /**
   * Whether the consent dialog should be presented. False once a valid decision
   * exists, when the region rule suppresses it, or when a browser signal
   * already answered for the visitor.
   */
  shouldPrompt(): boolean {
    if (this.config.ui?.headless) return false;
    if (this.regionInfo.suppressBanner) return false;
    if (this.hooks.canShowUi && !this.hooks.canShowUi()) return false;
    return this.pendingDecision;
  }

  // ------------------------------------------------------------------ actions

  acceptAll(): ConsentState {
    return this.commit(this.allDecision(true), 'accept_all');
  }

  rejectAll(): ConsentState {
    return this.commit(this.rejectedDecision(), 'reject_all');
  }

  /** Saves an explicit per-category choice. Missing categories are denied. */
  save(choice: ConsentDecision, method: ConsentMethod = 'save_choices'): ConsentState {
    const next: ConsentDecision = {};
    for (const category of this.categories) {
      next[category.id] = category.required ? true : choice[category.id] === true;
    }
    return this.commit(next, method);
  }

  /** Merges a partial choice into the current decision. */
  update(patch: ConsentDecision, method: ConsentMethod = 'programmatic'): ConsentState {
    return this.save({ ...this.effective, ...patch }, method);
  }

  /** Records dismissal without a choice — implied consent under `notice_only`. */
  dismiss(): ConsentState {
    const method: ConsentMethod =
      this.regionInfo.model === 'opt_in' ? 'reject_all' : 'implied_close';
    const decision =
      this.regionInfo.model === 'opt_in' ? this.rejectedDecision() : this.defaultDecision();
    return this.commit(decision, method);
  }

  /** Clears the stored decision and returns to the pre-consent state. */
  reset(): void {
    this.storage.clear();
    this.state = null;
    this.pendingDecision = true;
    const previous = this.snapshot();
    this.effective = this.defaultDecision();
    this.log.log('consent reset');
    this.emit('change', this.buildChangeEvent(previous, false));
  }

  private commit(
    decision: ConsentDecision,
    method: ConsentMethod,
    opts: { silent?: boolean; gpc?: boolean } = {}
  ): ConsentState {
    const previous = this.state ? this.snapshot() : null;
    const previousEffective = { ...this.effective };
    const categories = this.withRequired(decision);

    // Re-stating the decision already in force is not a new decision. Refresh
    // the affirmation time so the re-consent window restarts, but keep the
    // original method and receipt id, and tell nobody — otherwise a rule that
    // calls `update()` with values already set would overwrite "accept_all"
    // with "programmatic" and mint a duplicate receipt.
    if (this.state && shallowEqual(previousEffective, categories)) {
      this.state = { ...this.state, timestamp: Date.now() };
      this.storage.write(this.state);
      this.log.log('decision re-affirmed unchanged:', method);
      this.flushGates();
      return this.snapshot();
    }

    const next: ConsentState = {
      schema: 1,
      policyVersion: this.config.policyVersion ?? 1,
      categories,
      timestamp: Date.now(),
      method,
      id: uid(),
      region: this.regionInfo.region,
      gpc: opts.gpc ?? undefined,
    };

    this.state = next;
    this.effective = categories;
    this.pendingDecision = false;
    this.storage.write(next);
    this.recordReceipt(next);

    this.log.log('decision committed:', method, categories);

    // `silent` marks a decision made during start() — a browser privacy signal
    // answering for the visitor. The `ready` event that follows already carries
    // this state, so emitting `change` here too would run every adapter twice
    // on the first page load.
    if (!opts.silent) {
      this.emit('change', this.buildChangeEvent(previous, false, previousEffective));
      if (this.config.onChange) this.config.onChange(next, previous);
    }
    this.flushGates();
    return this.snapshot();
  }

  private recordReceipt(state: ConsentState): void {
    const opts = this.config.receipt;
    if (!opts?.enabled) return;
    const copy = opts.includeCopy && this.hooks.getCopy ? this.hooks.getCopy() : undefined;
    const receipt = buildReceipt(state, opts, copy);
    this.lastReceipt = receipt;
    if (opts.historySize && opts.historySize > 0) {
      appendHistory(receipt, opts.historySize, this.storage);
    }
    if (opts.endpoint) sendReceipt(receipt, opts.endpoint);
  }

  // ------------------------------------------------------------------- gating

  /**
   * Runs `fn` as soon as `category` is granted — immediately if it already is,
   * otherwise queued until it becomes granted. This is the primitive that lets
   * a site load tags without ever writing a "did they consent yet" branch.
   * Returns a function that cancels a still-queued callback.
   */
  gate(category: CategoryId, fn: () => void): () => void {
    if (this.hasConsent(category)) {
      this.runGuarded(fn);
      return () => undefined;
    }
    const queue = this.gateQueue.get(category) || [];
    queue.push(fn);
    this.gateQueue.set(category, queue);
    return () => {
      const current = this.gateQueue.get(category);
      if (!current) return;
      const index = current.indexOf(fn);
      if (index >= 0) current.splice(index, 1);
    };
  }

  private flushGates(): void {
    for (const [category, queue] of this.gateQueue) {
      if (!this.hasConsent(category) || queue.length === 0) continue;
      this.gateQueue.set(category, []);
      for (const fn of queue) this.runGuarded(fn);
    }
  }

  private runGuarded(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      this.log.error('gated callback threw', e);
      this.emit('error', e);
    }
  }

  // ------------------------------------------------------------------- events

  on(event: ConsentEventName, fn: Listener): () => void {
    const list = this.listeners.get(event) || [];
    list.push(fn);
    this.listeners.set(event, list);
    return () => this.off(event, fn);
  }

  off(event: ConsentEventName, fn: Listener): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const index = list.indexOf(fn);
    if (index >= 0) list.splice(index, 1);
  }

  emit(event: ConsentEventName, payload?: unknown): void {
    const list = this.listeners.get(event);
    if (list) {
      for (const fn of list.slice()) {
        try {
          fn(payload);
        } catch (e) {
          this.log.error('listener for "' + event + '" threw', e);
        }
      }
    }
    // Also broadcast on the document so non-JS-bundled consumers (a Launch
    // custom code action, say) can listen without importing anything.
    if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
      try {
        document.dispatchEvent(
          new CustomEvent('adobeConsent:' + event, { detail: payload })
        );
      } catch {
        /* older browsers without constructable CustomEvent */
      }
    }
  }

  private buildChangeEvent(
    previous: ConsentState | null,
    initial: boolean,
    previousEffective?: ConsentDecision
  ): ConsentChangeEvent {
    const before = previousEffective || previous?.categories || {};
    const granted: CategoryId[] = [];
    const revoked: CategoryId[] = [];
    for (const id of Object.keys(this.effective)) {
      const was = before[id] === true;
      const now = this.effective[id] === true;
      if (!was && now) granted.push(id);
      if (was && !now) revoked.push(id);
    }
    if (granted.length) this.emit('granted', granted);
    if (revoked.length) this.emit('revoked', revoked);
    return { state: this.snapshot(), previous, granted, revoked, initial };
  }

  // ------------------------------------------------------------------ helpers

  private snapshot(): ConsentState {
    if (this.state) return { ...this.state, categories: { ...this.state.categories } };
    return {
      schema: 1,
      policyVersion: this.config.policyVersion ?? 1,
      categories: { ...this.effective },
      timestamp: Date.now(),
      method: 'region_default',
      id: '',
      region: this.regionInfo.region,
    };
  }

  private withRequired(decision: ConsentDecision): ConsentDecision {
    const out: ConsentDecision = {};
    for (const category of this.categories) {
      out[category.id] = category.required ? true : decision[category.id] === true;
    }
    return out;
  }

  private allDecision(granted: boolean): ConsentDecision {
    const out: ConsentDecision = {};
    for (const category of this.categories) {
      out[category.id] = category.required ? true : granted;
    }
    return out;
  }

  private rejectedDecision(): ConsentDecision {
    return this.allDecision(false);
  }

  /**
   * What is in force before any explicit choice. Under `opt_in` that is
   * essential-only; under `opt_out`/`notice_only` the region rule (or the
   * category's own default) decides.
   */
  private defaultDecision(): ConsentDecision {
    const out: ConsentDecision = {};
    const model = this.regionInfo.model;
    const regionDefaults = this.regionInfo.defaultGranted;

    for (const category of this.categories) {
      if (category.required) {
        out[category.id] = true;
      } else if (model === 'opt_in') {
        out[category.id] = false;
      } else if (regionDefaults.length) {
        out[category.id] = regionDefaults.indexOf(category.id) >= 0;
      } else {
        out[category.id] = category.defaultGranted !== false;
      }
    }
    return out;
  }
}
