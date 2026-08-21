import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { NewTicketScreen } from '../screens/support/NewTicketScreen';
import { SupportScreen } from '../screens/support/SupportScreen';
import { TicketThreadScreen } from '../screens/support/TicketThreadScreen';
import { SupportStackParamList } from './types';

const Stack = createNativeStackNavigator<SupportStackParamList>();

export const SupportStackNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SupportMain" component={SupportScreen} />
    <Stack.Screen name="NewTicket" component={NewTicketScreen} />
    <Stack.Screen name="TicketThread" component={TicketThreadScreen} />
  </Stack.Navigator>
);
