import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAppData } from '../../context/AppDataContext';
import { colors, radius, spacing } from '../../theme/theme';
import { AppointmentStatus } from '../../types';

const STATUS_TONE: Record<AppointmentStatus, 'info' | 'success' | 'danger'> = {
  planned: 'info',
  completed: 'success',
  cancelled: 'danger',
};

export const AppointmentDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { appointmentId } = route.params as { appointmentId: string };
  const { appointments, cancelAppointment } = useAppData();
  const appt = appointments.find((a) => a.id === appointmentId);

  if (!appt) {
    return (
      <View style={styles.wrap}>
        <ScreenHeader title="Appointment" />
        <Text style={styles.notFound}>Appointment not found.</Text>
      </View>
    );
  }

  const onCancel = () => {
    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel this appointment? Refunds are processed as per the Refund Policy.', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => { cancelAppointment(appt.id); navigation.goBack(); } },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <ScreenHeader title="Appointment Details" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Avatar name={appt.providerName} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.provider}>{appt.providerName}</Text>
              <Text style={styles.service}>{appt.serviceName}</Text>
            </View>
            <StatusChip label={appt.status[0].toUpperCase() + appt.status.slice(1)} tone={STATUS_TONE[appt.status]} />
          </View>

          <View style={styles.divider} />

          <DetailRow icon="person" label="Child" value={appt.childName} />
          <DetailRow icon="business" label="Branch" value={appt.branchName} />
          <DetailRow icon="calendar" label="Date" value={formatDate(appt.date)} />
          <DetailRow icon="time" label="Time" value={appt.time} />
          <DetailRow icon="card" label="Payment" value={`${appt.paymentMethod} · ₹${appt.cost.toFixed(2)}`} />
        </View>

        {appt.status === 'planned' && (
          <PrimaryButton label="Cancel Appointment" variant="danger" onPress={onCancel} style={styles.cancelBtn} />
        )}
      </ScrollView>
    </View>
  );
};

const DetailRow: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIcon}>
      <Ionicons name={icon} size={16} color={colors.primary} />
    </View>
    <View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  notFound: { padding: spacing.xl, color: colors.inkFaint },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  provider: { fontSize: 16, fontWeight: '800', color: colors.ink },
  service: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  detailIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 11, color: colors.inkFaint },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 2 },
  cancelBtn: { marginTop: 20 },
});
