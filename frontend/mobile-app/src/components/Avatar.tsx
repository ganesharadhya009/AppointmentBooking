import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';

const PALETTE = ['#4F46E5', '#0D9488', '#0EA5E9', '#F59E0B', '#8B5CF6', '#F43F5E'];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  return initials || '?';
}

interface Props {
  name: string;
  size?: number;
}

export const Avatar: React.FC<Props> = ({ name, size = 48 }) => {
  const bg = colorForName(name);
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initialsForName(name)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.onPrimary, fontWeight: '700' },
});
