import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export const EmptyState: React.FC<Props> = ({ icon, title, subtitle }) => (
  <View style={styles.wrap}>
    <View style={styles.iconWrap}>
      <Ionicons name={icon} size={30} color={colors.primary} />
    </View>
    <Text style={styles.title}>{title}</Text>
    {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.inkFaint, textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
