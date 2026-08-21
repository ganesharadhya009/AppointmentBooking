import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../theme/theme';

interface Props extends TextInputProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
  error?: string;
}

export const FormField: React.FC<Props> = ({ label, icon, isPassword, error, style, ...rest }) => {
  const [hidden, setHidden] = useState(!!isPassword);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error && styles.inputRowError]}>
        {icon && <Ionicons name={icon} size={18} color={colors.inkSoft} style={styles.icon} />}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.inkFaint}
          secureTextEntry={hidden}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={hidden ? 'eye-off' : 'eye'} size={18} color={colors.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 50,
  },
  inputRowError: { borderColor: colors.danger },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: colors.ink, height: '100%' },
  error: { fontSize: 12, color: colors.danger, marginTop: 4 },
});
