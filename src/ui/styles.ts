import type { ThemeOptions } from '../core/types';

/**
 * All styling lives inside the shadow root, so nothing here can be broken by —
 * or break — the host page's CSS. Everything is driven by custom properties so
 * a site can re-skin the dialog from config without shipping a stylesheet.
 */
export function buildStyles(theme: ThemeOptions = {}): string {
  const v = {
    surface: theme.surface || '#152238',
    surfaceAlt: theme.surfaceAlt || 'rgba(255, 255, 255, 0.055)',
    text: theme.text || '#f2f6ff',
    textMuted: theme.textMuted || '#c3cfe4',
    accent: theme.accent || 'linear-gradient(96deg, #8fe3e8 0%, #cfe98f 100%)',
    accentText: theme.accentText || '#0d1a2e',
    border: theme.border || 'rgba(255, 255, 255, 0.22)',
    radius: theme.radius || '18px',
    fontFamily:
      theme.fontFamily ||
      "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    headingFontFamily:
      theme.headingFontFamily ||
      "Georgia, 'Iowan Old Style', 'Times New Roman', Times, serif",
    overlay: theme.overlay || 'rgba(6, 12, 24, 0.55)',
  };

  return `
:host {
  --ac-surface: ${v.surface};
  --ac-surface-alt: ${v.surfaceAlt};
  --ac-text: ${v.text};
  --ac-text-muted: ${v.textMuted};
  --ac-accent: ${v.accent};
  --ac-accent-text: ${v.accentText};
  --ac-border: ${v.border};
  --ac-radius: ${v.radius};
  --ac-font: ${v.fontFamily};
  --ac-font-heading: ${v.headingFontFamily};
  --ac-overlay: ${v.overlay};
  --ac-focus: #ffffff;

  all: initial;
  font-family: var(--ac-font);
  color: var(--ac-text);
  -webkit-font-smoothing: antialiased;
}

*, *::before, *::after { box-sizing: border-box; }

.overlay {
  position: fixed;
  inset: 0;
  background: var(--ac-overlay);
  z-index: 2147483000;
  display: flex;
  padding: 20px;
  overflow-y: auto;
  animation: ac-fade 180ms ease-out;
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
}
.overlay[data-blocking='false'] {
  background: transparent;
  pointer-events: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.overlay[data-blocking='false'] .panel { pointer-events: auto; }

.overlay[data-position='center'] { align-items: center; justify-content: center; }
.overlay[data-position='bottom'] { align-items: flex-end; justify-content: center; }
.overlay[data-position='top'] { align-items: flex-start; justify-content: center; }
.overlay[data-position='bottom-left'] { align-items: flex-end; justify-content: flex-start; }
.overlay[data-position='bottom-right'] { align-items: flex-end; justify-content: flex-end; }

.panel {
  background: var(--ac-surface);
  border-radius: var(--ac-radius);
  padding: 30px 32px 28px;
  width: 100%;
  max-width: 680px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.42), 0 2px 8px rgba(0, 0, 0, 0.28);
  animation: ac-rise 220ms cubic-bezier(0.16, 1, 0.3, 1);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}
.panel[data-layout='bar'] { max-width: 1180px; }
.panel[data-layout='box'] { max-width: 440px; }

h2.title {
  font-family: var(--ac-font-heading);
  font-size: 27px;
  line-height: 1.2;
  font-weight: 700;
  margin: 0 0 12px;
  color: var(--ac-text);
  letter-spacing: -0.01em;
}

p.body {
  font-size: 15.5px;
  line-height: 1.58;
  margin: 0 0 20px;
  color: var(--ac-text-muted);
}
p.body a {
  color: var(--ac-text);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.categories {
  background: var(--ac-surface-alt);
  border-radius: 12px;
  padding: 18px 20px;
  margin: 0 0 22px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.category { display: block; }
.category + .category { margin-top: 4px; }

.row-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 7px 0;
  cursor: pointer;
  font-size: 15.5px;
  line-height: 1.45;
  color: var(--ac-text);
  flex: 1;
}
.row.locked { cursor: default; }

input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  border: 1.5px solid var(--ac-border);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  flex: 0 0 auto;
  cursor: pointer;
  display: grid;
  place-content: center;
  transition: background-color 120ms ease, border-color 120ms ease;
}
input[type='checkbox']::after {
  content: '';
  width: 10px;
  height: 10px;
  transform: scale(0);
  transition: transform 110ms cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: inset 1em 1em #0d1a2e;
  clip-path: polygon(14% 44%, 0 65%, 40% 100%, 100% 16%, 82% 0%, 37% 70%);
}
input[type='checkbox']:checked::after { transform: scale(1); }
input[type='checkbox']:disabled {
  background: rgba(255, 255, 255, 0.42);
  cursor: default;
}
input[type='checkbox']:disabled::after { box-shadow: inset 1em 1em #55607a; }

.switch input[type='checkbox'] {
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  border-color: transparent;
  position: relative;
  place-content: initial;
}
.switch input[type='checkbox']::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: none;
  clip-path: none;
  transform: none;
  transition: left 140ms cubic-bezier(0.16, 1, 0.3, 1);
}
.switch input[type='checkbox']:checked { background: #8fe3e8; }
.switch input[type='checkbox']:checked::after { left: 19px; transform: none; }

.label-text { flex: 1; }
.label-text .name { font-weight: 500; }
.label-text .summary { color: var(--ac-text-muted); }

.details-toggle {
  appearance: none;
  background: none;
  border: 0;
  color: var(--ac-text-muted);
  font: inherit;
  font-size: 13px;
  padding: 2px 6px;
  margin: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  border-radius: 6px;
  flex: 0 0 auto;
}
.details-toggle:hover { color: var(--ac-text); }

.details {
  display: none;
  padding: 4px 0 12px 30px;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--ac-text-muted);
}
.details[data-open='true'] { display: block; }

table.cookies {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 12.5px;
}
table.cookies th, table.cookies td {
  text-align: left;
  padding: 6px 8px 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  vertical-align: top;
}
table.cookies th { font-weight: 600; color: var(--ac-text); }

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

button.action {
  appearance: none;
  font: inherit;
  font-size: 15.5px;
  font-weight: 600;
  border-radius: 999px;
  padding: 13px 26px;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: transform 110ms ease, box-shadow 140ms ease, opacity 140ms ease;
  min-height: 48px;
  flex: 0 1 auto;
}
button.action:hover { transform: translateY(-1px); }
button.action:active { transform: translateY(0); }

button.primary {
  background: var(--ac-accent);
  color: var(--ac-accent-text);
  box-shadow: 0 2px 10px rgba(143, 227, 232, 0.2);
}
button.secondary {
  background: transparent;
  color: var(--ac-text);
  border-color: var(--ac-text);
}
button.secondary:hover { background: rgba(255, 255, 255, 0.08); }

.link-row {
  margin: 16px 0 0;
  font-size: 13.5px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}
.link-row a {
  color: var(--ac-text-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
  border-radius: 4px;
}
.link-row a:hover { color: var(--ac-text); }

.badge {
  position: fixed;
  bottom: 18px;
  z-index: 2147482000;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--ac-surface);
  color: var(--ac-text);
  border: 1px solid var(--ac-border);
  border-radius: 999px;
  padding: 9px 16px;
  font-family: var(--ac-font);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  min-height: 40px;
}
.badge[data-position='bottom-left'] { left: 18px; }
.badge[data-position='bottom-right'] { right: 18px; }
.badge:hover { transform: translateY(-1px); }
.badge svg { width: 15px; height: 15px; flex: 0 0 auto; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

:focus-visible {
  outline: 3px solid var(--ac-focus);
  outline-offset: 2px;
}

@keyframes ac-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ac-rise {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .overlay, .panel { animation: none; }
  button.action:hover, .badge:hover { transform: none; }
  input[type='checkbox']::after, .switch input[type='checkbox']::after { transition: none; }
}

@media (max-width: 560px) {
  .overlay { padding: 0; align-items: flex-end; }
  .panel {
    border-radius: var(--ac-radius) var(--ac-radius) 0 0;
    padding: 24px 20px 20px;
    max-width: none;
    max-height: 92vh;
  }
  h2.title { font-size: 23px; }
  .actions { flex-direction: column-reverse; align-items: stretch; }
  button.action { width: 100%; }
}

@media (forced-colors: active) {
  .panel { border: 1px solid CanvasText; }
  button.action { border: 1px solid ButtonText; }
  input[type='checkbox'] { border: 1px solid CanvasText; }
}
${theme.customCss || ''}
`.trim();
}
