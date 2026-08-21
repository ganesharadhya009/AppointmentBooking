import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { StatusChip } from '../../components/StatusChip';
import { useAppData } from '../../context/AppDataContext';
import { colors, gradientLocations, gradients, radius, spacing } from '../../theme/theme';
import { TicketStatus } from '../../types';

const TONE: Record<TicketStatus, 'info' | 'warn' | 'success'> = {
  Open: 'info',
  'Waiting for Admin': 'warn',
  Resolved: 'success',
};

export const SupportScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { tickets } = useAppData();

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={gradients.primary}
        locations={gradientLocations.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <Text style={styles.headerTitle}>Support</Text>
        <Text style={styles.headerSubtitle}>We're here to help</Text>
      </LinearGradient>

      <View style={styles.content}>
        <TouchableOpacity style={styles.newTicketBtn} onPress={() => navigation.navigate('NewTicket')}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.newTicketText}>Raise a New Ticket</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Your Tickets</Text>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="chatbubble-ellipses-outline" title="No support tickets yet" subtitle="Raise a ticket and our team will get back to you." />
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('TicketThread', { ticketId: item.id })}>
            <Card style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.ticketNo}>{item.ticketNo}</Text>
                <StatusChip label={item.status} tone={TONE[item.status]} />
              </View>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <View style={styles.footerRow}>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.date}>{item.createdAt}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  content: { paddingHorizontal: spacing.xl },
  newTicketBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.action,
    borderRadius: radius.pill, height: 48, marginTop: 16, marginBottom: 20,
  },
  newTicketText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.inkFaint, marginBottom: 4 },
  list: { padding: spacing.xl, paddingTop: 8, gap: 12, flexGrow: 1 },
  card: { gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketNo: { fontSize: 11, fontWeight: '700', color: colors.inkFaint },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  category: { fontSize: 11, color: colors.primaryDark, fontWeight: '600' },
  date: { fontSize: 11, color: colors.inkFaint },
});
