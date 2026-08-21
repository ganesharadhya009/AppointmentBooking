import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { AppointmentDetailScreen } from '../screens/appointments/AppointmentDetailScreen';
import { MyAppointmentsScreen } from '../screens/appointments/MyAppointmentsScreen';
import { MyAppointmentsStackParamList } from './types';

const Stack = createNativeStackNavigator<MyAppointmentsStackParamList>();

export const MyAppointmentsStackNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MyAppointmentsMain" component={MyAppointmentsScreen} />
    <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
  </Stack.Navigator>
);
