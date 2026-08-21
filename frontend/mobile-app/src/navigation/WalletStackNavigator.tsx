import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { WalletScreen } from '../screens/wallet/WalletScreen';
import { WalletStackParamList } from './types';

const Stack = createNativeStackNavigator<WalletStackParamList>();

export const WalletStackNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WalletMain" component={WalletScreen} />
  </Stack.Navigator>
);
