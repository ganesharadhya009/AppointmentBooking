import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { therapies, therapists } from '../../data/mockData';
import { HomeStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'TherapistList'>;

export const TherapistListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { therapyId } = route.params;
  const therapy = therapies.find((t) => t.id === therapyId);
  const list = therapists.filter((t) => t.therapyId === therapyId);

  return (
    <View style={styles.wrap}>
      <ScreenHeader title={therapy?.name ?? 'Therapists'} subtitle="Choose a therapist" />
      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="search" title="No therapists found" subtitle="Try a different branch or therapy service." />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Avatar name={item.name} size={56} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.designation}>{item.designation}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="star" size={12} color={colors.warn} />
                  <Text style={styles.metaText}>{item.rating} &middot; {item.experienceYears} yrs experience</Text>
                </View>
              </View>
            </View>
            <View style={styles.tagsRow}>
              {item.specialties.map((s) => (
                <View key={s} style={styles.tag}>
                  <Text style={styles.tagText}>{s}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => navigation.navigate('BookAppointment', { type: 'therapy', providerId: item.id })}
            >
              <Text style={styles.bookBtnText}>Book Appointment</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.xl, gap: 12, flexGrow: 1 },
  card: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  designation: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  metaText: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.surfaceSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, color: colors.primaryDark, fontWeight: '600' },
  bookBtn: {
    backgroundColor: colors.action, borderRadius: radius.pill, height: 42,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
