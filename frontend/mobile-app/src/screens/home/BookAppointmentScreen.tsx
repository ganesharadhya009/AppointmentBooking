import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MonthCalendar } from '../../components/MonthCalendar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppData } from '../../context/AppDataContext';
import { useCatalog } from '../../context/CatalogContext';
import { buildSlotsForDate } from '../../data/slots';
import { HomeStackParamList } from '../../navigation/types';
import { SlotState } from '../../types';
import { colors, radius, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'BookAppointment'>;

const SLOT_LEGEND: { state: SlotState; label: string }[] = [
  { state: 'available', label: 'Available' },
  { state: 'selected', label: 'Selected' },
  { state: 'bookedByOther', label: 'Already booked' },
  { state: 'unavailable', label: 'Unavailable' },
  { state: 'past', label: 'Past' },
];

export const BookAppointmentScreen: React.FC<Props> = ({ route, navigation }) => {
  const { type, providerId } = route.params;
  const { children_, setPendingBooking } = useAppData();
  const { branches, consultingDoctors, therapies, therapists } = useCatalog();

  const provider = useMemo(() => {
    if (type === 'therapy') {
      const t = therapists.find((x) => x.id === providerId)!;
      const therapy = therapies.find((x) => x.id === t.therapyId)!;
      return { name: t.name, serviceName: therapy.name, cost: t.sessionPrice ?? 500, branchId: t.branchId };
    }
    const d = consultingDoctors.find((x) => x.id === providerId)!;
    return { name: d.name, serviceName: 'Clinic Appointment', cost: d.fee, branchId: branches[0].id };
  }, [type, providerId, branches, consultingDoctors, therapies, therapists]);

  const [childId, setChildId] = useState(children_[0]?.id ?? '');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  const slots = useMemo(() => buildSlotsForDate(selectedDate), [selectedDate]);

  const canProceed = !!childId && !!selectedTime;

  const onMakeAppointment = () => {
    if (!canProceed) return;
    const child = children_.find((c) => c.id === childId)!;
    const branch = branches.find((b) => b.id === provider.branchId) ?? branches[0];
    setPendingBooking({
      type,
      childId,
      branchId: branch.id,
      therapistId: type === 'therapy' ? providerId : undefined,
      doctorId: type === 'consultation' ? providerId : undefined,
      date: selectedDate.toISOString().slice(0, 10),
      time: selectedTime!,
      cost: provider.cost,
      serviceName: provider.serviceName,
      providerName: provider.name,
    });
    navigation.navigate('PaymentSummary');
  };

  return (
    <View style={styles.wrap}>
      <ScreenHeader
        title="Book Appointment"
        subtitle={provider.name}
        rightIcon="information-circle"
        onRightPress={() => setShowLegend((s) => !s)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {children_.length > 1 && (
          <View style={styles.childRow}>
            {children_.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.childChip, c.id === childId && styles.childChipActive]}
                onPress={() => setChildId(c.id)}
              >
                <Text style={[styles.childChipText, c.id === childId && styles.childChipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.calendarCard}>
          <MonthCalendar selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setSelectedTime(null); }} />
        </View>

        <Text style={styles.slotHeading}>Select time slot</Text>

        {showLegend && (
          <View style={styles.legendBox}>
            {SLOT_LEGEND.map((l) => (
              <View key={l.state} style={styles.legendRow}>
                <View style={[styles.legendDot, slotStyle(l.state).box]} />
                <Text style={styles.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.slotGrid}>
          {slots.map((slot) => {
            const isSelected = selectedTime === slot.time;
            const bookable = slot.state === 'available' || isSelected;
            const style = slotStyle(isSelected ? 'selected' : slot.state);
            return (
              <TouchableOpacity
                key={slot.time}
                disabled={!bookable}
                style={[styles.slot, style.box]}
                onPress={() => setSelectedTime(slot.time)}
              >
                <Text style={[styles.slotText, style.text]}>{slot.time}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Make Appointment" onPress={onMakeAppointment} disabled={!canProceed} />
      </View>
    </View>
  );
};

function slotStyle(state: SlotState) {
  switch (state) {
    case 'selected':
      return { box: { backgroundColor: colors.slotSelected, borderColor: colors.slotSelected }, text: { color: '#fff' } };
    case 'bookedByOther':
    case 'bookedByYou':
      return { box: { backgroundColor: colors.slotBooked, borderColor: colors.slotBooked }, text: { color: '#fff' } };
    case 'unavailable':
    case 'break':
      return { box: { backgroundColor: colors.slotUnavailable, borderColor: colors.slotUnavailable }, text: { color: colors.inkFaint } };
    case 'past':
      return { box: { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.5 }, text: { color: colors.inkFaint } };
    default:
      return { box: { backgroundColor: colors.surface, borderColor: colors.border }, text: { color: colors.ink } };
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  childRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  childChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  childChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  childChipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  childChipTextActive: { color: '#fff' },
  calendarCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  slotHeading: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  legendBox: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 12, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  legendText: { fontSize: 12, color: colors.inkSoft },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: { width: '30%', height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  slotText: { fontSize: 13, fontWeight: '600' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.xl,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
});
