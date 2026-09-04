import type { ConsentEngine } from '../core/engine';
import type { CategoryId } from '../core/types';

/**
 * Tag blocking.
 *
 * A script marked up as
 *
 *   <script type="text/plain" data-cc-category="analytics" src="..."></script>
 *
 * is inert to the browser — `text/plain` is not an executable type — and this
 * module rewrites it into a real script the moment its category is granted.
 * Iframes use `data-cc-src` in place of `src` and get an in-place placeholder
 * so an embedded video does not just vanish behind a blank box, which is the
 * single most common complaint about auto-blocking CMPs.
 */

const CATEGORY_ATTR = 'data-cc-category';
const SRC_ATTR = 'data-cc-src';
const DONE_ATTR = 'data-cc-unblocked';
const PLACEHOLDER_CLASS = 'ac-embed-placeholder';

export interface AutoBlockOptions {
  /** Show a click-to-enable placeholder for blocked iframes. */
  placeholders?: boolean;
  placeholderText?: (category: string) => string;
  placeholderButton?: string;
}

export class AutoBlocker {
  private engine: ConsentEngine;
  private opts: AutoBlockOptions;
  private observer: MutationObserver | null = null;
  private styleInjected = false;

  constructor(engine: ConsentEngine, opts: AutoBlockOptions = {}) {
    this.engine = engine;
    this.opts = opts;
  }

  start(): void {
    this.sweep();

    this.engine.on('ready', () => this.sweep());
    this.engine.on('change', () => this.sweep());

    // Tags injected later (by a Launch rule, a SPA route change, an ad script)
    // must be caught too, so watch the whole tree.
    if (typeof MutationObserver === 'function' && document.documentElement) {
      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length) {
            this.sweep();
            return;
          }
        }
      });
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Unblocks everything whose category is now granted. */
  sweep(): void {
    if (typeof document === 'undefined') return;
    const nodes = document.querySelectorAll<HTMLElement>(
      '[' + CATEGORY_ATTR + ']:not([' + DONE_ATTR + '])'
    );
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const category = node.getAttribute(CATEGORY_ATTR);
      if (!category) continue;

      if (this.engine.hasConsent(category)) {
        this.unblock(node, category);
      } else if (node.tagName === 'IFRAME' && this.opts.placeholders !== false) {
        this.showPlaceholder(node as HTMLIFrameElement, category);
      }
    }
  }

  private unblock(node: HTMLElement, category: CategoryId): void {
    node.setAttribute(DONE_ATTR, 'true');
    this.removePlaceholder(node);

    if (node.tagName === 'SCRIPT') {
      this.reviveScript(node as HTMLScriptElement);
      return;
    }

    // iframe / img / link: swap the deferred src into the live attribute.
    const deferred = node.getAttribute(SRC_ATTR);
    if (deferred) {
      node.setAttribute('src', deferred);
      node.removeAttribute(SRC_ATTR);
    }
    this.engine.log.log('unblocked', node.tagName.toLowerCase(), 'for', category);
  }

  /**
   * A `type="text/plain"` script cannot be made to run by flipping its type —
   * the browser only evaluates a script element once, at insertion. The element
   * has to be recreated.
   */
  private reviveScript(original: HTMLScriptElement): void {
    const replacement = document.createElement('script');

    for (let i = 0; i < original.attributes.length; i++) {
      const attr = original.attributes[i]!;
      if (attr.name === 'type' || attr.name === SRC_ATTR) continue;
      replacement.setAttribute(attr.name, attr.value);
    }

    const deferredSrc = original.getAttribute(SRC_ATTR);
    if (deferredSrc) replacement.src = deferredSrc;
    else if (original.src) replacement.src = original.src;

    if (!replacement.src && original.textContent) {
      replacement.textContent = original.textContent;
    }

    const explicitType = original.getAttribute('data-cc-type');
    if (explicitType) replacement.type = explicitType;

    original.parentNode?.insertBefore(replacement, original.nextSibling);
    original.remove();
    this.engine.log.log('unblocked script', replacement.src || '(inline)');
  }

  // -------------------------------------------------------------- placeholders

  private injectStyle(): void {
    if (this.styleInjected || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.setAttribute('data-clearconsent', 'placeholder');
    style.textContent = `
.${PLACEHOLDER_CLASS}{display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:10px;min-height:150px;padding:20px;text-align:center;background:#f3f4f6;color:#374151;
border:1px solid #e5e7eb;border-radius:8px;font:14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;}
.${PLACEHOLDER_CLASS} button{font:inherit;font-weight:600;padding:9px 16px;border-radius:999px;
border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;min-height:40px;}
.${PLACEHOLDER_CLASS} button:hover{background:rgba(0,0,0,.05);}
@media (prefers-color-scheme:dark){.${PLACEHOLDER_CLASS}{background:#1f2937;color:#e5e7eb;border-color:#374151;}}
`.trim();
    document.head?.appendChild(style);
    this.styleInjected = true;
  }

  private showPlaceholder(iframe: HTMLIFrameElement, category: CategoryId): void {
    if (iframe.previousElementSibling?.classList?.contains(PLACEHOLDER_CLASS)) return;
    this.injectStyle();

    const label = this.engine
      .getCategories()
      .filter((c) => c.id === category)
      .map((c) => c.label)[0] || category;

    const box = document.createElement('div');
    box.className = PLACEHOLDER_CLASS;
    box.setAttribute('data-cc-placeholder-for', category);

    const text = document.createElement('p');
    text.style.margin = '0';
    text.textContent = this.opts.placeholderText
      ? this.opts.placeholderText(label)
      : 'This content is hidden because ' + label.toLowerCase() + ' cookies are turned off.';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = this.opts.placeholderButton || 'Allow and show';
    button.addEventListener('click', () => {
      const patch: Record<string, boolean> = {};
      patch[category] = true;
      this.engine.update(patch);
    });

    box.appendChild(text);
    box.appendChild(button);

    iframe.style.display = 'none';
    iframe.parentNode?.insertBefore(box, iframe);
  }

  private removePlaceholder(node: HTMLElement): void {
    const previous = node.previousElementSibling;
    if (previous?.classList?.contains(PLACEHOLDER_CLASS)) {
      previous.remove();
      node.style.removeProperty('display');
    }
  }
}
