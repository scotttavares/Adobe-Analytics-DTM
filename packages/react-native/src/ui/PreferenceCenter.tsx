import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import type { ConsentEngine } from '../../../../src/core/engine';
import type { ConsentDecision } from '../../../../src/core/types';
import {
  DEFAULT_TEXT,
  DEFAULT_THEME,
  makeStyles,
  type ConsentTheme,
  type ConsentUiText,
} from './theme';

export interface PreferenceCenterProps {
  engine: ConsentEngine;
  onClose: () => void;
  theme?: Partial<ConsentTheme>;
  text?: Partial<ConsentUiText>;
}

/**
 * Per-category preference center. Non-essential categories start from the
 * current decision — nothing is pre-ticked under an opt-in model — and essential
 * categories are locked on. Save commits the exact toggles shown.
 */
export function PreferenceCenter({
  engine,
  onClose,
  theme,
  text,
}: PreferenceCenterProps): React.ReactElement {
  const t: ConsentTheme = { ...DEFAULT_THEME, ...theme };
  const copy: ConsentUiText = { ...DEFAULT_TEXT, ...text };
  const styles = makeStyles(t);

  const categories = engine.getCategories();
  const current = engine.decision;
  const [choice, setChoice] = useState<ConsentDecision>(() => {
    const init: ConsentDecision = {};
    for (const c of categories) init[c.id] = c.required ? true : current[c.id] === true;
    return init;
  });

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet} accessibilityViewIsModal accessibilityLabel={copy.manage}>
          <Text style={styles.title} accessibilityRole="header">
            {copy.manage}
          </Text>
          <ScrollView style={styles.list}>
            {categories.map((c) => (
              <View key={c.id} style={styles.catRow}>
                <View style={styles.catText}>
                  <Text style={styles.catLabel}>{c.label}</Text>
                  {c.summary ? <Text style={styles.catSummary}>{c.summary}</Text> : null}
                </View>
                <Switch
                  value={choice[c.id] === true}
                  disabled={c.required === true}
                  onValueChange={(v) => setChoice((prev) => ({ ...prev, [c.id]: v }))}
                  accessibilityLabel={c.label}
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              accessibilityRole="button"
              onPress={() => {
                engine.rejectAll();
                onClose();
              }}
            >
              <Text style={styles.btnGhostLabel}>{copy.rejectAll}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              accessibilityRole="button"
              onPress={() => {
                engine.save(choice);
                onClose();
              }}
            >
              <Text style={[styles.btnLabel, styles.btnPrimaryLabel]}>{copy.save}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
