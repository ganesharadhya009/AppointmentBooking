import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { StatusChip } from '../../components/StatusChip';
import { consultingDoctors } from '../../data/mockData';
import { HomeStackParamList } from '../../navigation/types';
import { colors, radius, shadow, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'DoctorProfile'>;

export const DoctorProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { doctorId } = route.params;
  const doctor = consultingDoctors.find((d) => d.id === doctorId)!;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.wrap}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{doctor.name}</Text>
            <Text style={styles.qual}>{doctor.qualifications}</Text>
            <Text style={styles.specialty}>{doctor.specialty}</Text>
            <Text style={styles.exp}>{doctor.experienceYears} years Experience</Text>
          </View>
          <Avatar name={doctor.name} size={84} />
        </View>

        <TouchableOpacity
          style={styles.apptCard}
          onPress={() => navigation.navigate('ConsultationType', { doctorId: doctor.id })}
        >
          <View style={styles.apptIcon}>
            <Ionicons name="medical" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.apptTitle}>Clinic Appointment</Text>
            <Text style={styles.apptFee}>&#8377;{doctor.fee} fees</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.clinicBox}>
          <Text style={styles.clinicName}>{doctor.clinicName}</Text>
          <Text style={styles.clinicCity}>{doctor.clinicCity}</Text>
          {doctor.verified && <StatusChip label="Verified Details" tone="success" />}
          <TouchableOpacity onPress={() => navigation.navigate('BookAppointment', { type: 'consultation', providerId: doctor.id })}>
            <Text style={styles.viewSlots}>View all slots</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clinic Details</Text>
          <View style={styles.clinicDetailRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clinicDetailName}>{doctor.clinicName}</Text>
              <Text style={styles.clinicDetailMeta}>{doctor.clinicAddress}</Text>
              <Text style={styles.clinicDetailMeta}>&#8377;{doctor.fee} In-clinic fees</Text>
            </View>
          </View>

          <Text style={styles.subheading}>Timings</Text>
          <View style={styles.timingChip}>
            <Text style={styles.timingText}>{doctor.timings}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL('tel:+911234567890')}>
          <Ionicons name="call" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => navigation.navigate('BookAppointment', { type: 'consultation', providerId: doctor.id })}
        >
          <Text style={styles.bookBtnText}>Book Clinic Visit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  topBar: { paddingHorizontal: spacing.lg, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: 16, marginBottom: 20 },
  name: { fontSize: 19, fontWeight: '800', color: colors.ink },
  qual: { fontSize: 12, color: colors.inkSoft, marginTop: 4, lineHeight: 17 },
  specialty: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 6 },
  exp: { fontSize: 12, color: colors.inkFaint, marginTop: 4 },
  apptCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, marginHorizontal: spacing.xl,
    borderRadius: radius.lg, padding: spacing.lg, gap: 12, ...shadow.raised,
  },
  apptIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  apptTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  apptFee: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  clinicBox: {
    marginHorizontal: spacing.xl, marginTop: -12, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 6, marginBottom: 24,
  },
  clinicName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  clinicCity: { fontSize: 12, color: colors.inkSoft },
  viewSlots: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 6 },
  section: { paddingHorizontal: spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 14 },
  clinicDetailRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  clinicDetailName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  clinicDetailMeta: { fontSize: 12, color: colors.inkSoft, marginTop: 3 },
  subheading: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  timingChip: { backgroundColor: colors.surfaceSoft, borderRadius: radius.md, padding: 12, alignSelf: 'flex-start' },
  timingText: { fontSize: 12, color: colors.primaryDark, fontWeight: '600' },
  footer: {
    flexDirection: 'row', gap: 12, paddingHorizontal: spacing.xl, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  callBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  bookBtn: { flex: 1, height: 52, borderRadius: radius.pill, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
