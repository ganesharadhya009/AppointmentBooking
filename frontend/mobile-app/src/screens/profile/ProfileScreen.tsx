import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import { colors, gradientLocations, gradients, radius, spacing } from '../../theme/theme';

const MENU: { icon: keyof typeof Ionicons.glyphMap; label: string; route?: string }[] = [
  { icon: 'people', label: 'Manage Family Members', route: 'ManageChildren' },
  { icon: 'lock-closed', label: 'Change Password', route: 'ChangePassword' },
  { icon: 'notifications', label: 'Notification Preferences' },
  { icon: 'document-text', label: 'Terms & Conditions' },
  { icon: 'shield-checkmark', label: 'Privacy Policy' },
  { icon: 'help-circle', label: 'Refund Policy' },
];

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const onLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={styles.wrap}>
      <LinearGradient
        colors={gradients.primary}
        locations={gradientLocations.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <Avatar name={user?.name ?? 'Parent'} size={72} />
        <Text style={styles.name}>{user?.name}</Text>
        <View style={styles.contactRow}>
          <Ionicons name="call" size={13} color="rgba(255,255,255,0.9)" />
          <Text style={styles.contactText}>{user?.mobile}</Text>
        </View>
        {!!user?.email && (
          <View style={styles.contactRow}>
            <Ionicons name="mail" size={13} color="rgba(255,255,255,0.9)" />
            <Text style={styles.contactText}>{user.email}</Text>
          </View>
        )}
      </LinearGradient>

      <View style={styles.menu}>
        {MENU.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.menuRow}
            onPress={() => item.route && navigation.navigate(item.route)}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon} size={18} color={colors.primary} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.appVersionRow}>
        <Text style={styles.appVersionText}>App Version 1.0.0</Text>
        <View style={styles.upToDateBadge}>
          <Ionicons name="checkmark-circle" size={13} color={colors.success} />
          <Text style={styles.upToDateText}>Up to date</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 4 },
  name: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  menu: { padding: spacing.xl, gap: 4 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: 8,
  },
  menuIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.ink },
  appVersionRow: { alignItems: 'center', gap: 6, marginTop: 8 },
  appVersionText: { fontSize: 12, color: colors.inkFaint },
  upToDateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  upToDateText: { fontSize: 11, color: colors.success, fontWeight: '600' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: spacing.xl,
    marginTop: 24, height: 48, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.danger,
  },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
});
