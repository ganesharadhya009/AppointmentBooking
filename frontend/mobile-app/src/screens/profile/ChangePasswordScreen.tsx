import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, spacing } from '../../theme/theme';

export const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const onSave = () => {
    if (!current) return setError('Enter your current password.');
    if (next.length < 4) return setError('New password must be at least 4 characters.');
    if (next !== confirm) return setError('Passwords do not match.');
    setError('');
    Alert.alert('Password Updated', 'Your password has been changed successfully.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <ScreenHeader title="Change Password" />
      <ScrollView contentContainerStyle={styles.content}>
        <FormField label="Current Password" icon="lock-closed" isPassword value={current} onChangeText={setCurrent} />
        <FormField label="New Password" icon="lock-closed" isPassword value={next} onChangeText={setNext} />
        <FormField label="Confirm New Password" icon="lock-closed" isPassword value={confirm} onChangeText={setConfirm} />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <PrimaryButton label="Update Password" onPress={onSave} style={styles.submit} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  error: { color: colors.danger, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  submit: { marginTop: 8 },
});
