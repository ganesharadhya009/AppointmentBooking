import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, gradients, radius, shadow } from '../theme/theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  style?: ViewStyle;
}

export const PrimaryButton: React.FC<Props> = ({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}) => {
  if (variant === 'outline') {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.outline, disabled && styles.disabledOutline, style]}
      >
        {loading ? <ActivityIndicator color={colors.primaryDark} /> : <Text style={styles.outlineLabel}>{label}</Text>}
      </TouchableOpacity>
    );
  }
  if (variant === 'ghost') {
    return (
      <TouchableOpacity activeOpacity={0.6} onPress={onPress} disabled={disabled || loading} style={style}>
        <Text style={styles.ghostLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }
  if (variant === 'danger') {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.danger, disabled && { opacity: 0.5 }, style]}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>{label}</Text>}
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={disabled || loading} style={[style, disabled && { opacity: 0.5 }]}>
      <LinearGradient colors={gradients.action} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.primary}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>{label}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  primary: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  danger: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  outline: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primaryRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledOutline: { opacity: 0.5 },
  outlineLabel: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
  ghostLabel: { color: colors.primary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
