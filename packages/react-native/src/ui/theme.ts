import { StyleSheet } from 'react-native';

export interface ConsentTheme {
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  border: string;
  overlay: string;
  radius: number;
}

export const DEFAULT_THEME: ConsentTheme = {
  surface: '#1b1530',
  text: '#efecf9',
  textMuted: '#bcb6d4',
  accent: '#7d8bff',
  accentText: '#160f2b',
  border: 'rgba(255,255,255,0.16)',
  overlay: 'rgba(0,0,0,0.55)',
  radius: 16,
};

export interface ConsentUiText {
  title: string;
  body: string;
  acceptAll: string;
  rejectAll: string;
  manage: string;
  save: string;
}

export const DEFAULT_TEXT: ConsentUiText = {
  title: 'Your privacy, your call',
  body:
    'We use cookies and similar technologies to run this app, measure usage, and ' +
    'personalize content. You decide what to allow — and you can change it any time.',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  manage: 'Manage choices',
  save: 'Save choices',
};

export function makeStyles(t: ConsentTheme) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: t.radius,
      borderTopRightRadius: t.radius,
      padding: 22,
      paddingBottom: 30,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    title: { color: t.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
    body: { color: t.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 18 },
    row: { flexDirection: 'row', gap: 12 },
    btn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: { backgroundColor: t.accent },
    btnPrimaryLabel: { color: t.accentText },
    btnLabel: { fontSize: 15, fontWeight: '600' },
    btnGhost: { borderWidth: 1, borderColor: t.border, backgroundColor: 'transparent' },
    btnGhostLabel: { color: t.text, fontSize: 15, fontWeight: '600' },
    manage: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
    manageLabel: { color: t.textMuted, fontSize: 14, textDecorationLine: 'underline' },
    list: { maxHeight: 320, marginBottom: 16 },
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
      gap: 12,
    },
    catText: { flex: 1 },
    catLabel: { color: t.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
    catSummary: { color: t.textMuted, fontSize: 13, lineHeight: 18 },
  });
}
