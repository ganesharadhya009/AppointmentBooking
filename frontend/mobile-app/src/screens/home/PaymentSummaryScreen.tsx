import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppData } from '../../context/AppDataContext';
import { branches } from '../../data/mockData';
import { HomeStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'PaymentSummary'>;

export const PaymentSummaryScreen: React.FC<Props> = ({ navigation }) => {
  const { pendingBooking, setPendingBooking, children_, walletBalance, addAppointment, debitWallet } = useAppData();
  const [useWallet, setUseWallet] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!pendingBooking) {
    return (
      <View style={styles.wrap}>
        <ScreenHeader title="Payment Summary" />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No booking in progress.</Text>
        </View>
      </View>
    );
  }

  const child = children_.find((c) => c.id === pendingBooking.childId);
  const branch = branches.find((b) => b.id === pendingBooking.branchId);
  const walletApplied = useWallet ? Math.min(walletBalance, pendingBooking.cost) : 0;
  const payable = pendingBooking.cost - walletApplied;

  const onPayNow = () => {
    Alert.alert('Confirm Payment', 'Are you sure you want to make the payment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Pay',
        onPress: () => {
          setSubmitting(true);
          setTimeout(() => {
            if (walletApplied > 0) debitWallet(walletApplied, `${pendingBooking.serviceName} - ${child?.name}`);
            addAppointment({
              type: pendingBooking.type,
              childId: pendingBooking.childId,
              childName: child?.name ?? '',
              branchName: branch?.name ?? '',
              providerId: pendingBooking.therapistId ?? pendingBooking.doctorId ?? '',
              providerName: pendingBooking.providerName,
              serviceName: pendingBooking.serviceName,
              date: pendingBooking.date,
              time: pendingBooking.time,
              cost: pendingBooking.cost,
              status: 'planned',
              paymentMethod: walletApplied === pendingBooking.cost ? 'Wallet' : 'Online',
            });
            setPendingBooking(null);
            setSubmitting(false);
            navigation.replace('PaymentSuccess');
          }, 600);
        },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <ScreenHeader title="Payment Summary" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.providerRow}>
          <Avatar name={pendingBooking.providerName} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName}>{pendingBooking.providerName}</Text>
            <Text style={styles.providerService}>{pendingBooking.serviceName}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Clinic Details</Text>
          <Text style={styles.branchText}>{branch?.name}, {branch?.city}</Text>
        </View>

        <View style={styles.bookingBadge}>
          <Avatar name={child?.name ?? '?'} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bookingBadgeLabel}>
              {pendingBooking.type === 'consultation' ? 'In-Clinic Appointment for' : 'Therapy Session for'}
            </Text>
            <Text style={styles.bookingBadgeChild}>{child?.name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.bookingBadgeDate}>{formatDate(pendingBooking.date)}</Text>
            <Text style={styles.bookingBadgeTime}>{pendingBooking.time}</Text>
          </View>
        </View>

        <View style={styles.billingCard}>
          <Text style={styles.billingTitle}>Billing Details</Text>
          <View style={styles.billingRow}>
            <Text style={styles.billingLabel}>{pendingBooking.type === 'consultation' ? 'Consultation Fee' : 'Session Fee'}</Text>
            <Text style={styles.billingValue}>&#8377;{pendingBooking.cost.toFixed(2)}</Text>
          </View>
          <View style={styles.billingRow}>
            <Text style={styles.billingLabel}>Service Fee &amp; Tax</Text>
            <Text style={styles.billingFree}>Free</Text>
          </View>
          <Text style={styles.billingNote}>We care for you &amp; provide a free booking</Text>
          <View style={styles.divider} />
          <View style={styles.billingRow}>
            <Text style={styles.billingTotalLabel}>Total Payable</Text>
            <Text style={styles.billingTotalValue}>&#8377;{pendingBooking.cost.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.walletRow} onPress={() => setUseWallet((w) => !w)}>
          <View style={[styles.checkbox, useWallet && styles.checkboxChecked]}>
            {useWallet && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.walletText}>&#8377;{walletBalance.toFixed(2)} Use Wallet Pay</Text>
        </TouchableOpacity>

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Service charges, if any, will be applied when making payments through the online payment method.
          </Text>
        </View>

        <TouchableOpacity style={styles.tcRow} onPress={() => setAccepted((a) => !a)}>
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.tcText}>
            By clicking 'Pay Now', I accept <Text style={styles.tcLink}>Privacy Policy</Text>, <Text style={styles.tcLink}>Terms &amp; Conditions</Text> and <Text style={styles.tcLink}>Refund Policy</Text>.
          </Text>
        </TouchableOpacity>

        {payable > 0 && payable !== pendingBooking.cost && (
          <Text style={styles.remainingText}>&#8377;{payable.toFixed(2)} payable after wallet credit</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Cancel" variant="outline" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
        <PrimaryButton label="Pay Now" onPress={onPayNow} disabled={!accepted} loading={submitting} style={{ flex: 1 }} />
      </View>
    </View>
  );
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: 24 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.inkFaint },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  providerName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  providerService: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.inkFaint, textTransform: 'uppercase', marginBottom: 4 },
  branchText: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  bookingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: 20,
  },
  bookingBadgeLabel: { fontSize: 11, color: colors.inkSoft },
  bookingBadgeChild: { fontSize: 14, fontWeight: '700', color: colors.ink },
  bookingBadgeDate: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  bookingBadgeTime: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  billingCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: 18,
  },
  billingTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  billingLabel: { fontSize: 13, color: colors.inkSoft },
  billingValue: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  billingFree: { fontSize: 13, color: colors.success, fontWeight: '700' },
  billingNote: { fontSize: 11, color: colors.inkFaint, marginBottom: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  billingTotalLabel: { fontSize: 14, fontWeight: '800', color: colors.ink },
  billingTotalValue: { fontSize: 16, fontWeight: '800', color: colors.ink },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.action, borderColor: colors.action },
  walletText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  noteBox: { backgroundColor: colors.infoSoft, borderRadius: radius.md, padding: 12, marginBottom: 18 },
  noteText: { fontSize: 12, color: colors.info, lineHeight: 17 },
  tcRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tcText: { flex: 1, fontSize: 12, color: colors.inkSoft, lineHeight: 18 },
  tcLink: { color: colors.primary, fontWeight: '700' },
  remainingText: { fontSize: 12, color: colors.primaryDark, fontWeight: '600', marginTop: 6 },
  footer: {
    flexDirection: 'row', gap: 12, padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
