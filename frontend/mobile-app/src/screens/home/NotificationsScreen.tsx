import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '../../components/EmptyState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing } from '../../theme/theme';

interface Notification {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  time: string;
}

const NOTIFICATIONS: Notification[] = [
  { id: 'n1', icon: 'checkmark-circle', title: 'Appointment Confirmed', body: 'Your session with Kiran Shetty on 19 Aug, 10:15 is confirmed.', time: '2 hours ago' },
  { id: 'n2', icon: 'wallet', title: 'Wallet Top-up', body: '₹300.00 was added to your wallet.', time: '3 days ago' },
  { id: 'n3', icon: 'chatbubble-ellipses', title: 'Support Reply', body: 'Admin replied to your ticket SPT-1042.', time: '5 days ago' },
];

export const NotificationsScreen: React.FC = () => {
  return (
    <View style={styles.wrap}>
      <ScreenHeader title="Notifications" />
      <FlatList
        data={NOTIFICATIONS}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="notifications-outline" title="No notifications yet" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.xl, gap: 4, flexGrow: 1 },
  row: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: 10,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '700', color: colors.ink },
  body: { fontSize: 12, color: colors.inkSoft, marginTop: 3, lineHeight: 17 },
  time: { fontSize: 10, color: colors.inkFaint, marginTop: 4 },
});
