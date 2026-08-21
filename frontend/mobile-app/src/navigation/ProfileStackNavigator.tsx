import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ChangePasswordScreen } from '../screens/profile/ChangePasswordScreen';
import { ChildFormScreen } from '../screens/profile/ChildFormScreen';
import { ManageChildrenScreen } from '../screens/profile/ManageChildrenScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStackNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    <Stack.Screen name="ManageChildren" component={ManageChildrenScreen} />
    <Stack.Screen name="ChildForm" component={ChildFormScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
  </Stack.Navigator>
);
