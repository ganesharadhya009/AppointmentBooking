import { Ionicons } from '@expo/vector-icons';
import { CommonActions, useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing } from '../../theme/theme';

export const PaymentSuccessScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const goHome = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'HomeMain' }] })
    );
  };

  const goToAppointments = () => {
    navigation.getParent()?.navigate('AppointmentsTab');
    goHome();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name="checkmark-circle" size={72} color={colors.success} />
      </View>
      <Text style={styles.title}>Appointment Booked!</Text>
      <Text style={styles.subtitle}>Your booking is confirmed. We've sent the details to your registered mobile number.</Text>

      <View style={styles.actions}>
        <PrimaryButton label="View My Appointments" onPress={goToAppointments} />
        <PrimaryButton label="Back to Home" variant="outline" onPress={goHome} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconCircle: { marginBottom: 20 },
  title: { fontSize: 21, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  subtitle: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  actions: { width: '100%' },
});
