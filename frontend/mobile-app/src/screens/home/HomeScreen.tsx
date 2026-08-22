import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { HomeStackParamList } from '../../navigation/types';
import { colors, gradientLocations, gradients, radius, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { branches, consultingDoctors, therapies } = useCatalog();
  const insets = useSafeAreaInsets();
  const [branchId, setBranchId] = useState(branches[0].id);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const activeBranch = branches.find((b) => b.id === branchId)!;
  const branchTherapies = therapies.filter((t) => t.branchId === branchId);

  return (
    <ScrollView style={styles.wrap} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={gradients.hero}
        locations={gradientLocations.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.heroTopRow}>
          <TouchableOpacity style={styles.branchPicker} onPress={() => setShowBranchPicker((s) => !s)}>
            <Ionicons name="location" size={16} color="#fff" />
            <Text style={styles.branchText}>{activeBranch.name}</Text>
            <Ionicons name={showBranchPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="notifications" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {showBranchPicker && (
          <View style={styles.branchDropdown}>
            {branches.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.branchOption}
                onPress={() => {
                  setBranchId(b.id);
                  setShowBranchPicker(false);
                }}
              >
                <Text style={[styles.branchOptionText, b.id === branchId && { color: colors.primary, fontWeight: '700' }]}>
                  {b.name} &middot; {b.city}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.heroTitle}>BimBa Connect</Text>
        <Text style={styles.heroSubtitle}>Nurturing Lives</Text>
        <Text style={styles.welcome}>Welcome, {user?.name?.split(' ')[0] ?? 'there'} 👋</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('BrowseDoctors')}>
            <Ionicons name="medkit" size={24} color={colors.primary} />
            <Text style={styles.actionLabel}>Book a Doctor{'\n'}Consultation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('BrowseTherapy')}>
            <Ionicons name="fitness" size={24} color={colors.primary} />
            <Text style={styles.actionLabel}>Book Therapy{'\n'}Appointments</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Therapy Services</Text>
          <TouchableOpacity onPress={() => navigation.navigate('BrowseTherapy')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
          {branchTherapies.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.therapyCard}
              onPress={() => navigation.navigate('TherapistList', { therapyId: t.id })}
            >
              <View style={styles.therapyIconWrap}>
                <Ionicons name={t.icon as any} size={26} color={colors.primary} />
              </View>
              <Text style={styles.therapyName} numberOfLines={2}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Consulting Doctors</Text>
          <TouchableOpacity onPress={() => navigation.navigate('BrowseDoctors')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {consultingDoctors.map((doc) => (
          <TouchableOpacity key={doc.id} onPress={() => navigation.navigate('DoctorProfile', { doctorId: doc.id })}>
            <Card style={styles.doctorCard}>
              <Avatar name={doc.name} size={52} />
              <View style={styles.doctorInfo}>
                <Text style={styles.doctorName}>{doc.name}</Text>
                <Text style={styles.doctorSpecialty}>{doc.specialty}</Text>
                <View style={styles.doctorMetaRow}>
                  <Ionicons name="star" size={12} color={colors.warn} />
                  <Text style={styles.doctorMetaText}>{doc.rating}</Text>
                  <Text style={styles.doctorMetaDot}>&middot;</Text>
                  <Text style={styles.doctorMetaText}>&#8377;{doc.fee}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
            </Card>
          </TouchableOpacity>
        ))}

        <View style={{ height: 24 }} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  hero: { paddingHorizontal: spacing.xl, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  branchPicker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  branchText: { color: '#fff', fontWeight: '700', fontSize: 15, marginHorizontal: 2 },
  branchDropdown: { backgroundColor: '#fff', borderRadius: radius.md, marginTop: 10, overflow: 'hidden' },
  branchOption: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  branchOptionText: { fontSize: 13, color: colors.ink },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 18 },
  heroSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 },
  welcome: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 10 },
  body: { paddingHorizontal: spacing.xl, marginTop: 20 },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 26 },
  actionCard: {
    flex: 1, backgroundColor: colors.surfaceSoft, borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'flex-start', gap: 10,
  },
  actionLabel: { fontSize: 13, fontWeight: '700', color: colors.primary, lineHeight: 18 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.primary },
  seeAll: { fontSize: 12, fontWeight: '700', color: colors.inkFaint },
  hScroll: { gap: 12, paddingBottom: 26 },
  therapyCard: { width: 108, alignItems: 'center' },
  therapyIconWrap: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: colors.surfaceSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  therapyName: { fontSize: 12, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  doctorCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  doctorSpecialty: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  doctorMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  doctorMetaText: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  doctorMetaDot: { color: colors.inkFaint, marginHorizontal: 2 },
});
