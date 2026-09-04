import type { ConsentReceipt, ConsentState, ReceiptOptions } from './types';
import { digest } from './util';

const HISTORY_KEY = 'receipts';

export function buildReceipt(
  state: ConsentState,
  opts: ReceiptOptions,
  copy?: ConsentReceipt['copy']
): ConsentReceipt {
  const receipt: ConsentReceipt = {
    id: state.id,
    timestamp: state.timestamp,
    policyVersion: state.policyVersion,
    categories: { ...state.categories },
    method: state.method,
    region: state.region,
    gpc: state.gpc,
  };

  if (typeof location !== 'undefined') receipt.url = location.href;
  if (typeof document !== 'undefined' && document.referrer) receipt.referrer = document.referrer;
  if (typeof navigator !== 'undefined') {
    receipt.language = navigator.language;
    receipt.userAgent = navigator.userAgent;
  }
  if (opts.includeCopy && copy) receipt.copy = copy;

  // Digest covers everything but the digest field itself.
  receipt.digest = digest(JSON.stringify(receipt));
  return receipt;
}

/**
 * Best-effort delivery. `sendBeacon` survives the page unloading right after a
 * click, which is exactly when consent decisions tend to happen.
 */
export function sendReceipt(receipt: ConsentReceipt, endpoint: string): boolean {
  const body = JSON.stringify(receipt);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) return true;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    if (typeof fetch === 'function') {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'omit',
      }).catch(() => undefined);
      return true;
    }
  } catch {
    /* nothing else to try */
  }
  return false;
}

export function appendHistory(
  receipt: ConsentReceipt,
  size: number,
  storage: { getItem(k: string): string | null; setItem(k: string, v: string): void }
): ConsentReceipt[] {
  let history: ConsentReceipt[] = [];
  const raw = storage.getItem(HISTORY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) history = parsed as ConsentReceipt[];
    } catch {
      history = [];
    }
  }
  history.push(receipt);
  if (history.length > size) history = history.slice(history.length - size);
  storage.setItem(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function readHistory(storage: {
  getItem(k: string): string | null;
}): ConsentReceipt[] {
  const raw = storage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConsentReceipt[]) : [];
  } catch {
    return [];
  }
}
