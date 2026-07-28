import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentEngine } from '../src/core/engine';
import { ConsentBanner } from '../src/ui/banner';
import { AutoBlocker } from '../src/blocking/autoblock';

function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  }
  window.localStorage.clear();
}

function setup(config = {}) {
  const engine = new ConsentEngine({ geo: { region: 'DE' }, ...config });
  engine.start();
  const banner = new ConsentBanner(engine, {});
  return { engine, banner };
}

function shadow(): ShadowRoot {
  const host = document.getElementById('adobe-consent-root');
  if (!host?.shadowRoot) throw new Error('banner is not mounted');
  return host.shadowRoot;
}

describe('consent banner', () => {
  beforeEach(() => {
    clearCookies();
    document.body.innerHTML = '';
    document.documentElement.style.removeProperty('overflow');
  });

  it('renders into a shadow root so site CSS cannot reach it', () => {
    const { banner } = setup();
    banner.open('notice');

    const host = document.getElementById('adobe-consent-root');
    expect(host).toBeTruthy();
    expect(host!.shadowRoot).toBeTruthy();
    expect(shadow().querySelector('.panel')).toBeTruthy();
  });

  it('marks the dialog up for assistive technology', () => {
    const { banner } = setup();
    banner.open('notice');

    const panel = shadow().querySelector('.panel')!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe('ac-title');
    expect(panel.getAttribute('aria-describedby')).toBe('ac-body');
    expect(shadow().querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('shows every category on the first layer', () => {
    const { banner } = setup();
    banner.open('notice');

    const boxes = shadow().querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(4);
  });

  it('leaves optional categories unticked and locks the required one', () => {
    const { banner } = setup();
    banner.open('notice');

    const boxes = Array.from(
      shadow().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    );
    const essential = boxes.find((b) => b.getAttribute('data-category') === 'essential')!;
    const analytics = boxes.find((b) => b.getAttribute('data-category') === 'analytics')!;

    expect(essential.checked).toBe(true);
    expect(essential.disabled).toBe(true);
    expect(analytics.checked).toBe(false);
  });

  it('gives accept and reject identical styling', () => {
    const { banner } = setup();
    banner.open('notice');

    const buttons = Array.from(shadow().querySelectorAll<HTMLButtonElement>('button.action'));
    const accept = buttons.find((b) => b.textContent === 'Accept all')!;
    const reject = buttons.find((b) => b.textContent === 'Reject all')!;

    expect(accept.className).toBe(reject.className);
  });

  it('records the choice and closes on accept', () => {
    const { engine, banner } = setup();
    banner.open('notice');

    const accept = Array.from(
      shadow().querySelectorAll<HTMLButtonElement>('button.action')
    ).find((b) => b.textContent === 'Accept all')!;
    accept.click();

    expect(engine.hasConsent('analytics')).toBe(true);
    expect(banner.isVisible()).toBe(false);
  });

  it('saves exactly what the visitor ticked', () => {
    const { engine, banner } = setup();
    banner.open('notice');

    const analytics = shadow().querySelector<HTMLInputElement>(
      'input[data-category="analytics"]'
    )!;
    analytics.checked = true;

    const save = Array.from(
      shadow().querySelectorAll<HTMLButtonElement>('button.action')
    ).find((b) => b.textContent === 'Save choices')!;
    save.click();

    expect(engine.hasConsent('analytics')).toBe(true);
    expect(engine.hasConsent('advertising')).toBe(false);
  });

  it('treats Escape as a rejection rather than agreement', () => {
    const { engine, banner } = setup();
    banner.open('notice');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(engine.hasConsent('analytics')).toBe(false);
    expect(engine.isPending()).toBe(false);
    expect(banner.isVisible()).toBe(false);
  });

  it('hides the rest of the page from screen readers while open', () => {
    document.body.innerHTML = '<main id="page">content</main>';
    const { banner } = setup();
    banner.open('notice');

    const main = document.getElementById('page')!;
    expect(main.hasAttribute('inert')).toBe(true);
    expect(main.getAttribute('aria-hidden')).toBe('true');

    banner.close();
    expect(main.hasAttribute('inert')).toBe(false);
    expect(main.hasAttribute('aria-hidden')).toBe(false);
  });

  it('restores page scrolling after closing', () => {
    const { banner } = setup();
    banner.open('notice');
    expect(document.documentElement.style.overflow).toBe('hidden');

    banner.close();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('returns focus to whatever opened it', () => {
    document.body.innerHTML = '<button id="trigger">Privacy</button>';
    const trigger = document.getElementById('trigger') as HTMLButtonElement;
    trigger.focus();

    const { banner } = setup();
    banner.open('preferences');
    banner.close();

    expect(document.activeElement).toBe(trigger);
  });

  it('escapes untrusted copy instead of injecting markup', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    const banner = new ConsentBanner(engine, {
      text: { title: '<img src=x onerror=alert(1)>Hi' },
    });
    banner.open('notice');

    const title = shadow().querySelector('.title')!;
    expect(title.querySelector('img')).toBeNull();
    expect(title.textContent).toBe('<img src=x onerror=alert(1)>Hi');
  });

  it('adds no layout-affecting element to the page', () => {
    const { banner } = setup();
    banner.open('notice');

    const host = document.getElementById('adobe-consent-root')!;
    expect(host.style.width).toBe('0px');
    expect(host.style.height).toBe('0px');
  });

  it('exposes a badge that reopens the preference center', () => {
    const { banner } = setup();
    banner.renderBadge();

    const badge = shadow().querySelector<HTMLButtonElement>('.badge')!;
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('aria-haspopup')).toBe('dialog');

    badge.click();
    expect(banner.isVisible()).toBe(true);
  });
});

describe('tag auto-blocking', () => {
  beforeEach(() => {
    clearCookies();
    document.body.innerHTML = '';
  });

  // jsdom runs injected scripts against its own window object rather than the
  // one the test holds, so globals set by a script are invisible here. These
  // assertions use `document.title` instead — a side effect that does cross.
  it('leaves a blocked script inert while its category is denied', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    document.title = 'inert';

    document.body.innerHTML =
      '<script type="text/plain" data-cc-category="analytics">document.title = "ran";<\/script>';

    new AutoBlocker(engine).start();

    expect(document.title).toBe('inert');
  });

  it('revives the script as soon as the category is granted', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    document.title = 'inert';

    document.body.innerHTML =
      '<script type="text/plain" data-cc-category="analytics">document.title = "ran";<\/script>';

    new AutoBlocker(engine).start();
    expect(document.title).toBe('inert');

    engine.save({ analytics: true });

    expect(document.title).toBe('ran');
  });

  it('carries the deferred src across when unblocking', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    engine.acceptAll();

    document.body.innerHTML =
      '<script type="text/plain" data-cc-category="advertising" ' +
      'data-cc-src="https://example.com/pixel.js"><\/script>';

    new AutoBlocker(engine).sweep();

    const revived = document.querySelector<HTMLScriptElement>(
      'script[data-cc-category="advertising"]'
    )!;
    expect(revived.type).not.toBe('text/plain');
    expect(revived.getAttribute('src')).toBe('https://example.com/pixel.js');
  });

  it('never unblocks a category that stays denied', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    engine.save({ analytics: true });
    document.title = 'inert';

    document.body.innerHTML =
      '<script type="text/plain" data-cc-category="advertising">document.title = "ran";<\/script>';

    new AutoBlocker(engine).start();

    expect(document.title).toBe('inert');
  });

  it('offers a placeholder in place of a blocked iframe', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();

    document.body.innerHTML =
      '<iframe data-cc-category="personalization" data-cc-src="https://example.com/embed"></iframe>';

    new AutoBlocker(engine).sweep();

    const placeholder = document.querySelector('.ac-embed-placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder!.querySelector('button')).toBeTruthy();
  });

  it('swaps the placeholder for the real iframe once granted', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();

    document.body.innerHTML =
      '<iframe data-cc-category="personalization" data-cc-src="https://example.com/embed"></iframe>';

    const blocker = new AutoBlocker(engine);
    blocker.start();

    const button = document.querySelector<HTMLButtonElement>('.ac-embed-placeholder button')!;
    button.click();

    expect(document.querySelector('.ac-embed-placeholder')).toBeNull();
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe(
      'https://example.com/embed'
    );
    expect(engine.hasConsent('personalization')).toBe(true);
  });

  it('catches tags injected after the initial scan', async () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    engine.start();
    engine.acceptAll();
    document.title = 'inert';

    const blocker = new AutoBlocker(engine);
    blocker.start();

    const script = document.createElement('script');
    script.type = 'text/plain';
    script.setAttribute('data-cc-category', 'analytics');
    script.textContent = 'document.title = "late";';
    document.body.appendChild(script);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(document.title).toBe('late');
    blocker.stop();
  });
});
