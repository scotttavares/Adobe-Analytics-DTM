import type { ConsentEngine } from '../core/engine';
import { DEFAULT_TEXT } from '../core/defaults';
import type {
  CategoryDefinition,
  ConsentDecision,
  ConsentReceipt,
  UiOptions,
  UiText,
} from '../core/types';
import { buildStyles } from './styles';

const HOST_ID = 'adobe-consent-root';

type Mode = 'notice' | 'preferences';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  // textContent, never innerHTML: config strings are treated as untrusted.
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The consent dialog.
 *
 * Two deliberate departures from what most CMPs ship:
 *
 * 1. Every category toggle is on the first layer. Burying granular choice
 *    behind a second "Manage" click is the pattern regulators keep fining.
 * 2. Accept and Reject are rendered with identical styling. The EDPB's position
 *    is that refusing must be as easy as accepting, so there is no option to
 *    make one louder than the other.
 */
export class ConsentBanner {
  private engine: ConsentEngine;
  private opts: UiOptions;
  private text: UiText;

  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private overlay: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private badge: HTMLElement | null = null;
  private liveRegion: HTMLElement | null = null;

  private inputs = new Map<string, HTMLInputElement>();
  private visible = false;
  private mode: Mode = 'notice';
  private lastFocused: Element | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private inerted: HTMLElement[] = [];

  constructor(engine: ConsentEngine, opts: UiOptions = {}) {
    this.engine = engine;
    this.opts = opts;
    this.text = { ...DEFAULT_TEXT, ...(opts.text || {}) };
  }

  // ------------------------------------------------------------------ mounting

  private ensureHost(): ShadowRoot {
    if (this.shadow) return this.shadow;

    const existing = document.getElementById(HOST_ID);
    if (existing) existing.remove();

    const host = el('div');
    host.id = HOST_ID;
    // The host itself is inert layout-wise; children are all position:fixed,
    // so mounting the dialog never shifts the page (no CLS).
    host.style.cssText = 'position:static;display:block;width:0;height:0;';
    if (this.opts.lang) host.setAttribute('lang', this.opts.lang);

    const parent = this.opts.root || document.body || document.documentElement;
    parent.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = buildStyles(this.opts.theme || {});
    shadow.appendChild(style);

    const live = el('div', 'sr-only');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    shadow.appendChild(live);

    this.host = host;
    this.shadow = shadow;
    this.liveRegion = live;
    return shadow;
  }

  // ------------------------------------------------------------------ rendering

  private renderCategory(category: CategoryDefinition, decision: ConsentDecision): HTMLElement {
    const wrap = el('div', 'category');
    const rowWrap = el('div', 'row-wrap');

    const label = el('label', 'row' + (category.required ? ' locked' : ''));
    const input = el('input');
    input.type = 'checkbox';
    input.checked = category.required ? true : decision[category.id] === true;
    input.disabled = !!category.required;
    input.setAttribute('data-category', category.id);
    if (category.required) input.setAttribute('aria-disabled', 'true');

    const labelText = el('span', 'label-text');
    labelText.appendChild(el('span', 'name', category.label));
    if (category.summary) {
      labelText.appendChild(document.createTextNode(' — '));
      labelText.appendChild(el('span', 'summary', category.summary));
    }

    label.appendChild(input);
    label.appendChild(labelText);
    rowWrap.appendChild(label);

    const hasDetail = !!(category.description || category.cookies?.length);
    if (hasDetail) {
      const detailsId = 'ac-det-' + category.id;
      const toggle = el('button', 'details-toggle', this.text.detailsShow || 'Details');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', detailsId);

      const details = el('div', 'details');
      details.id = detailsId;
      details.setAttribute('data-open', 'false');
      if (category.description) details.appendChild(el('p', undefined, category.description));
      if (category.cookies?.length) details.appendChild(this.renderCookieTable(category));

      // Describing the checkbox by its detail text gives screen readers the
      // full purpose without needing to expand the row.
      if (category.description) input.setAttribute('aria-describedby', detailsId);

      toggle.addEventListener('click', () => {
        const open = details.getAttribute('data-open') === 'true';
        details.setAttribute('data-open', open ? 'false' : 'true');
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        toggle.textContent = open
          ? this.text.detailsShow || 'Details'
          : this.text.detailsHide || 'Hide details';
      });

      rowWrap.appendChild(toggle);
      wrap.appendChild(rowWrap);
      wrap.appendChild(details);
    } else {
      wrap.appendChild(rowWrap);
    }

    this.inputs.set(category.id, input);
    return wrap;
  }

  private renderCookieTable(category: CategoryDefinition): HTMLElement {
    const table = el('table', 'cookies');
    const thead = el('thead');
    const headRow = el('tr');
    for (const heading of [
      this.text.cookieTableName || 'Name',
      this.text.cookieTableProvider || 'Provider',
      this.text.cookieTablePurpose || 'Purpose',
      this.text.cookieTableDuration || 'Duration',
    ]) {
      const th = el('th', undefined, heading);
      th.setAttribute('scope', 'col');
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    for (const cookie of category.cookies || []) {
      const tr = el('tr');
      tr.appendChild(el('td', undefined, cookie.name));
      tr.appendChild(el('td', undefined, cookie.provider || '—'));
      tr.appendChild(el('td', undefined, cookie.purpose || '—'));
      tr.appendChild(el('td', undefined, cookie.duration || '—'));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    table.setAttribute('aria-label', category.label + ' cookies');
    return table;
  }

  private renderPanel(mode: Mode): HTMLElement {
    const decision = this.engine.decision;
    this.inputs.clear();

    const overlay = el('div', 'overlay');
    overlay.setAttribute('data-position', this.opts.position || 'center');
    overlay.setAttribute('data-blocking', String(this.opts.blocking !== false));

    const panel = el('div', 'panel');
    panel.setAttribute('data-layout', this.opts.layout || 'modal');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', String(this.opts.blocking !== false));
    panel.setAttribute('aria-labelledby', 'ac-title');
    panel.setAttribute('aria-describedby', 'ac-body');
    if (this.text.ariaLabel) panel.setAttribute('aria-label', this.text.ariaLabel);

    const title = el('h2', 'title', this.text.title);
    title.id = 'ac-title';
    panel.appendChild(title);

    const body = el('p', 'body', this.text.body);
    body.id = 'ac-body';
    panel.appendChild(body);

    const showCategories = this.opts.categoriesOnFirstLayer !== false || mode === 'preferences';
    if (showCategories) {
      const categories = el('div', 'categories');
      categories.setAttribute('role', 'group');
      categories.setAttribute('aria-label', 'Cookie categories');
      for (const category of this.engine.getCategories()) {
        categories.appendChild(this.renderCategory(category, decision));
      }
      panel.appendChild(categories);
    }

    panel.appendChild(this.renderActions(showCategories, mode));

    const links = el('div', 'link-row');
    if (this.text.privacyPolicyUrl && this.text.privacyPolicy) {
      const link = el('a', undefined, this.text.privacyPolicy);
      link.href = this.text.privacyPolicyUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      links.appendChild(link);
    }
    if (this.text.poweredBy) links.appendChild(el('span', undefined, this.text.poweredBy));
    if (links.childNodes.length) panel.appendChild(links);

    overlay.appendChild(panel);
    this.overlay = overlay;
    this.panel = panel;
    return overlay;
  }

  private renderActions(showCategories: boolean, mode: Mode): HTMLElement {
    const actions = el('div', 'actions');

    // Accept and reject share the `primary` class on purpose — see class docs.
    const accept = el('button', 'action primary', this.text.acceptAll);
    accept.type = 'button';
    accept.addEventListener('click', () => {
      this.engine.acceptAll();
      this.announceAndClose();
    });

    const reject = el('button', 'action primary', this.text.rejectAll);
    reject.type = 'button';
    reject.addEventListener('click', () => {
      this.engine.rejectAll();
      this.announceAndClose();
    });

    actions.appendChild(accept);
    actions.appendChild(reject);

    if (showCategories) {
      const save = el('button', 'action secondary', this.text.save);
      save.type = 'button';
      save.addEventListener('click', () => {
        this.engine.save(this.collect());
        this.announceAndClose();
      });
      actions.appendChild(save);
    } else {
      const prefs = el('button', 'action secondary', this.text.preferences);
      prefs.type = 'button';
      prefs.addEventListener('click', () => this.open('preferences'));
      actions.appendChild(prefs);
    }

    if (mode === 'preferences') {
      const close = el('button', 'action secondary', this.text.close);
      close.type = 'button';
      close.addEventListener('click', () => this.close());
      actions.appendChild(close);
    }

    return actions;
  }

  private collect(): ConsentDecision {
    const decision: ConsentDecision = {};
    for (const [id, input] of this.inputs) decision[id] = input.checked;
    return decision;
  }

  // ------------------------------------------------------------------ badge

  renderBadge(): void {
    if (this.opts.showBadge === false || this.badge) return;
    const shadow = this.ensureHost();

    const badge = el('button', 'badge');
    badge.setAttribute('type', 'button');
    badge.setAttribute('data-position', this.opts.badgePosition || 'bottom-left');
    badge.setAttribute('aria-haspopup', 'dialog');

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z M8.5 11h.01 M12 15.5h.01 M15.5 10h.01'
    );
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    icon.appendChild(path);

    badge.appendChild(icon);
    badge.appendChild(document.createTextNode(this.opts.badgeLabel || this.text.preferences));
    badge.addEventListener('click', () => this.open('preferences'));

    shadow.appendChild(badge);
    this.badge = badge;
  }

  // ------------------------------------------------------------------ open/close

  open(mode: Mode = 'notice'): void {
    const shadow = this.ensureHost();
    if (this.visible) this.teardownPanel();

    this.mode = mode;
    this.lastFocused = document.activeElement;
    const overlay = this.renderPanel(mode);
    shadow.appendChild(overlay);
    this.visible = true;

    if (this.opts.blocking !== false) {
      document.documentElement.style.setProperty('overflow', 'hidden');
      this.setBackgroundInert(true);
    }

    this.keyHandler = (e: KeyboardEvent) => this.onKeyDown(e);
    document.addEventListener('keydown', this.keyHandler, true);

    // Focus the dialog itself rather than the first button, so a screen reader
    // reads the title and body before offering the choices.
    this.panel?.setAttribute('tabindex', '-1');
    this.panel?.focus({ preventScroll: true });

    this.engine.emit('show', { mode });
  }

  close(): void {
    if (!this.visible) return;
    this.teardownPanel();
    this.visible = false;

    if (this.opts.blocking !== false) {
      document.documentElement.style.removeProperty('overflow');
      this.setBackgroundInert(false);
    }

    if (this.lastFocused instanceof HTMLElement) {
      this.lastFocused.focus({ preventScroll: true });
    }
    this.engine.emit('hide', { mode: this.mode });
  }

  private teardownPanel(): void {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    this.overlay?.remove();
    this.overlay = null;
    this.panel = null;
    this.inputs.clear();
  }

  private announceAndClose(): void {
    if (this.liveRegion && this.text.savedAnnouncement) {
      this.liveRegion.textContent = this.text.savedAnnouncement;
      window.setTimeout(() => {
        if (this.liveRegion) this.liveRegion.textContent = '';
      }, 4000);
    }
    this.close();
    this.renderBadge();
  }

  // ------------------------------------------------------------------ a11y glue

  /**
   * Hides the rest of the page from assistive technology while a blocking
   * dialog is open. A focus trap alone still lets a screen reader's virtual
   * cursor wander into the page behind the overlay.
   */
  private setBackgroundInert(on: boolean): void {
    if (on) {
      const body = document.body;
      if (!body) return;
      const children = Array.prototype.slice.call(body.children) as HTMLElement[];
      for (const child of children) {
        if (child === this.host || child.hasAttribute('inert')) continue;
        child.setAttribute('inert', '');
        child.setAttribute('aria-hidden', 'true');
        this.inerted.push(child);
      }
    } else {
      for (const child of this.inerted) {
        child.removeAttribute('inert');
        child.removeAttribute('aria-hidden');
      }
      this.inerted = [];
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.visible || !this.panel) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      // Escape must never be read as agreement. In an opt-in region the engine
      // records a rejection; elsewhere it records the regional default.
      if (this.mode === 'preferences') this.close();
      else {
        this.engine.dismiss();
        this.announceAndClose();
      }
      return;
    }

    if (e.key !== 'Tab') return;

    const focusable = this.focusable();
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = this.shadow?.activeElement;

    if (e.shiftKey && (active === first || active === this.panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private focusable(): HTMLElement[] {
    if (!this.panel) return [];
    const nodes = this.panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );
    return Array.prototype.slice
      .call(nodes)
      .filter((node: HTMLElement) => node.offsetParent !== null || node.tagName === 'INPUT');
  }

  // ------------------------------------------------------------------ misc

  isVisible(): boolean {
    return this.visible;
  }

  /** Copy currently on screen, for the consent receipt. */
  getCopy(): ConsentReceipt['copy'] {
    const categories: Record<string, string> = {};
    for (const category of this.engine.getCategories()) {
      categories[category.id] =
        category.label + (category.summary ? ' — ' + category.summary : '');
    }
    return { title: this.text.title, body: this.text.body, categories };
  }

  destroy(): void {
    this.teardownPanel();
    this.badge?.remove();
    this.badge = null;
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.visible = false;
  }
}
