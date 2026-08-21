import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme/theme';
import { HomeStackNavigator } from './HomeStackNavigator';
import { MyAppointmentsStackNavigator } from './MyAppointmentsStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { SupportStackNavigator } from './SupportStackNavigator';
import { WalletStackNavigator } from './WalletStackNavigator';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  HomeTab: { active: 'home', inactive: 'home-outline' },
  AppointmentsTab: { active: 'calendar', inactive: 'calendar-outline' },
  SupportTab: { active: 'help-circle', inactive: 'help-circle-outline' },
  WalletTab: { active: 'wallet', inactive: 'wallet-outline' },
  ProfileTab: { active: 'person', inactive: 'person-outline' },
};

// Mirrors the admin console's active sidebar nav item: a brand-gradient pill behind the icon.
const TabIcon: React.FC<{ routeName: keyof MainTabParamList; focused: boolean; color: string; size: number }> = ({
  routeName,
  focused,
  color,
  size,
}) => {
  const set = ICONS[routeName];
  const icon = <Ionicons name={focused ? set.active : set.inactive} size={size} color={color} />;
  if (!focused) return <View style={styles.iconWrap}>{icon}</View>;
  return (
    <LinearGradient
      colors={['rgba(99,102,241,0.95)', 'rgba(99,102,241,0.55)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.iconWrapActive}
    >
      {icon}
    </LinearGradient>
  );
};

export const MainTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
        tabBarStyle: [styles.tabBar, { height: 56 + insets.bottom, paddingBottom: insets.bottom + 8 }],
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => (
          <TabIcon routeName={route.name as keyof MainTabParamList} focused={focused} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
      <Tab.Screen name="AppointmentsTab" component={MyAppointmentsStackNavigator} options={{ title: 'My Appointments' }} />
      <Tab.Screen name="SupportTab" component={SupportStackNavigator} options={{ title: 'Support' }} />
      <Tab.Screen name="WalletTab" component={WalletStackNavigator} options={{ title: 'Wallet' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 6,
    backgroundColor: colors.navy,
    borderTopWidth: 0,
  },
  iconWrap: {
    width: 40,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    width: 40,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
