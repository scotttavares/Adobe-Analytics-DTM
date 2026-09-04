import React, { useEffect } from 'react';
import { BackHandler, Modal, Platform, Pressable, Text, View } from 'react-native';
import type { ConsentEngine } from '../../../../src/core/engine';
import {
  DEFAULT_TEXT,
  DEFAULT_THEME,
  makeStyles,
  type ConsentTheme,
  type ConsentUiText,
} from './theme';

export interface ConsentBannerProps {
  engine: ConsentEngine;
  onManage: () => void;
  theme?: Partial<ConsentTheme>;
  text?: Partial<ConsentUiText>;
}

/**
 * First-layer consent banner. Accept and Reject are rendered identically — same
 * size, same weight — because unequal prominence is the exact dark pattern
 * regulators fine. Dismissal (Android hardware back, or a swipe-down) records a
 * rejection under an opt-in model via `engine.dismiss()`, never silent consent.
 */
export function ConsentBanner({
  engine,
  onManage,
  theme,
  text,
}: ConsentBannerProps): React.ReactElement {
  const t: ConsentTheme = { ...DEFAULT_THEME, ...theme };
  const copy: ConsentUiText = { ...DEFAULT_TEXT, ...text };
  const styles = makeStyles(t);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      engine.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [engine]);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={() => engine.dismiss()}>
      <View style={styles.overlay}>
        <View
          style={styles.sheet}
          accessibilityViewIsModal
          accessibilityRole="alert"
          accessibilityLabel={copy.title}
        >
          <Text style={styles.title} accessibilityRole="header">
            {copy.title}
          </Text>
          <Text style={styles.body}>{copy.body}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              accessibilityRole="button"
              onPress={() => engine.rejectAll()}
            >
              <Text style={[styles.btnLabel, styles.btnPrimaryLabel]}>{copy.rejectAll}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              accessibilityRole="button"
              onPress={() => engine.acceptAll()}
            >
              <Text style={[styles.btnLabel, styles.btnPrimaryLabel]}>{copy.acceptAll}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.manage} accessibilityRole="button" onPress={onManage}>
            <Text style={styles.manageLabel}>{copy.manage}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
