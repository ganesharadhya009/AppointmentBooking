import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { AuthStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [mobile, setMobile] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="arrow-back" size={22} color={colors.ink} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name={sent ? 'checkmark-circle' : 'key'} size={40} color={colors.primary} />
        </View>
        {sent ? (
          <>
            <Text style={styles.title}>Check Your Messages</Text>
            <Text style={styles.subtitle}>
              We've sent a password reset code to {mobile || 'your mobile number'}. Follow the instructions to set a new password.
            </Text>
            <PrimaryButton label="Back to Login" onPress={() => navigation.goBack()} style={styles.submit} />
          </>
        ) : (
          <>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>Enter your registered mobile number and we'll send you a reset code.</Text>
            <FormField
              label="Mobile Number"
              icon="call"
              keyboardType="phone-pad"
              placeholder="10-digit mobile number"
              value={mobile}
              onChangeText={setMobile}
              maxLength={10}
              style={{ marginTop: 8 }}
            />
            <PrimaryButton label="Send Reset Code" onPress={() => setSent(true)} disabled={mobile.length < 10} style={styles.submit} />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, paddingTop: 56 },
  back: { marginLeft: spacing.lg, marginBottom: 12 },
  content: { paddingHorizontal: spacing.xl, alignItems: 'center', paddingTop: 24 },
  iconCircle: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  subtitle: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  submit: { width: '100%', marginTop: 12 },
});
