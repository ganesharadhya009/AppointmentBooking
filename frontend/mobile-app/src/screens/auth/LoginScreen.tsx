import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormField } from '../../components/FormField';
import { Logo } from '../../components/Logo';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    const result = await login(mobile, password);
    setLoading(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Logo size={72} />
        <Text style={styles.heading}>Welcome Back!</Text>
        <Text style={styles.subheading}>Login to access your account</Text>

        <View style={styles.form}>
          <FormField
            label="Mobile Number"
            icon="call"
            keyboardType="phone-pad"
            placeholder="10-digit mobile number"
            value={mobile}
            onChangeText={setMobile}
            maxLength={10}
          />
          <FormField
            label="Password"
            icon="lock-closed"
            isPassword
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}

          <PrimaryButton label="Forgot Password?" variant="ghost" onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot} />

          <PrimaryButton label="Login" onPress={onSubmit} loading={loading} style={styles.loginBtn} />

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>New User? </Text>
            <PrimaryButton label="Sign Up" variant="ghost" onPress={() => navigation.navigate('SignUp')} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 64, paddingBottom: 32 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 20 },
  subheading: { fontSize: 13, color: colors.inkFaint, marginTop: 4, marginBottom: 28 },
  form: { width: '100%' },
  error: { color: colors.danger, fontSize: 13, marginBottom: 8, textAlign: 'center' },
  forgot: { alignSelf: 'flex-end', marginBottom: 20 },
  loginBtn: { marginBottom: 20 },
  signupRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center' },
  signupText: { color: colors.inkSoft, fontSize: 14 },
});
