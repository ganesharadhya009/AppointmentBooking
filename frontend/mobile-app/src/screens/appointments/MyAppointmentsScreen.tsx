import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { StatusChip } from '../../components/StatusChip';
import { useAppData } from '../../context/AppDataContext';
import { colors, gradientLocations, gradients, radius, spacing } from '../../theme/theme';
import { AppointmentStatus } from '../../types';
import { LinearGradient } from 'expo-linear-gradient';

const TABS: { key: AppointmentStatus; label: string }[] = [
  { key: 'planned', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_TONE: Record<AppointmentStatus, 'info' | 'success' | 'danger'> = {
  planned: 'info',
  completed: 'success',
  cancelled: 'danger',
};

export const MyAppointmentsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { appointments } = useAppData();
  const [tab, setTab] = useState<AppointmentStatus>('planned');

  const filtered = useMemo(
    () => appointments.filter((a) => a.status === tab).sort((a, b) => b.date.localeCompare(a.date)),
    [appointments, tab]
  );

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={gradients.primary}
        locations={gradientLocations.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <Text style={styles.headerTitle}>My Appointments</Text>
      </LinearGradient>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No Bookings found"
            subtitle="Try adjusting your filters or book a new appointment from Home."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Avatar name={item.providerName} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.provider}>{item.providerName}</Text>
                  <Text style={styles.service}>{item.serviceName}</Text>
                </View>
                <StatusChip label={item.status[0].toUpperCase() + item.status.slice(1)} tone={STATUS_TONE[item.status]} />
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color={colors.inkFaint} />
                  <Text style={styles.metaText}>{formatDate(item.date)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={13} color={colors.inkFaint} />
                  <Text style={styles.metaText}>{item.time}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="person-outline" size={13} color={colors.inkFaint} />
                  <Text style={styles.metaText}>{item.childName}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, marginTop: 16, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  tabTextActive: { color: '#fff' },
  list: { padding: spacing.xl, gap: 12, flexGrow: 1 },
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  provider: { fontSize: 14, fontWeight: '700', color: colors.ink },
  service: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
});
