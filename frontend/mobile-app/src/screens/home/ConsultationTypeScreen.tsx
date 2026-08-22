import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCatalog } from '../../context/CatalogContext';
import { HomeStackParamList } from '../../navigation/types';
import { colors, radius, shadow, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'ConsultationType'>;

export const ConsultationTypeScreen: React.FC<Props> = ({ route, navigation }) => {
  const { doctorId } = route.params;
  const { consultingDoctors } = useCatalog();
  const doctor = consultingDoctors.find((d) => d.id === doctorId)!;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backBtn, { marginTop: insets.top + 8 }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.ink} />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.question}>How would you like to consult your {doctor.specialty}?</Text>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => navigation.navigate('BookAppointment', { type: 'consultation', providerId: doctor.id })}
        >
          <View style={styles.optionIcon}>
            <Ionicons name="medical" size={26} color="#fff" />
          </View>
          <Text style={styles.optionTitle}>Book In-clinic Appointment</Text>
          <Text style={styles.optionSubtitle}>
            Book an appointment with a top {doctor.specialty} in {doctor.clinicCity}
          </Text>
        </TouchableOpacity>

        <Text style={styles.bodyText}>
          Pragyan is building an ecosystem that connects parents of children with developmental
          disorders to the most suitable pediatric doctors.
        </Text>
        <Text style={styles.bodyTextBold}>
          Before booking an appointment, please verify the location to ensure you're directed to
          the correct clinic/hospital.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  backBtn: { marginLeft: spacing.lg, marginBottom: 8 },
  content: { padding: spacing.xl },
  question: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 24, lineHeight: 27 },
  optionCard: {
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.xl, marginBottom: 24,
    ...shadow.raised,
  },
  optionIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  optionTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 6 },
  optionSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19 },
  bodyText: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  bodyTextBold: { fontSize: 14, color: colors.ink, fontWeight: '700', textAlign: 'center', lineHeight: 21 },
});
