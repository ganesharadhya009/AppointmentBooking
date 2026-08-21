import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormField } from '../../components/FormField';
import { Logo } from '../../components/Logo';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const result = await signUp(name, mobile, password);
    setLoading(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Logo size={64} />
        <Text style={styles.heading}>Create Your Account</Text>
        <Text style={styles.subheading}>Join BimBa to book therapy and consultations</Text>

        <View style={styles.form}>
          <FormField label="Full Name" icon="person" placeholder="Your full name" value={name} onChangeText={setName} />
          <FormField
            label="Mobile Number"
            icon="call"
            keyboardType="phone-pad"
            placeholder="10-digit mobile number"
            value={mobile}
            onChangeText={setMobile}
            maxLength={10}
          />
          <FormField label="Password" icon="lock-closed" isPassword placeholder="Create a password" value={password} onChangeText={setPassword} />
          <FormField label="Confirm Password" icon="lock-closed" isPassword placeholder="Re-enter password" value={confirm} onChangeText={setConfirm} />
          {!!error && <Text style={styles.error}>{error}</Text>}

          <PrimaryButton label="Sign Up" onPress={onSubmit} loading={loading} style={styles.submitBtn} />

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <PrimaryButton label="Login" variant="ghost" onPress={() => navigation.goBack()} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 48, paddingBottom: 32 },
  heading: { fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: 16 },
  subheading: { fontSize: 13, color: colors.inkFaint, marginTop: 4, marginBottom: 24, textAlign: 'center' },
  form: { width: '100%' },
  error: { color: colors.danger, fontSize: 13, marginBottom: 8, textAlign: 'center' },
  submitBtn: { marginTop: 8, marginBottom: 20 },
  loginRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center' },
  loginText: { color: colors.inkSoft, fontSize: 14 },
});
