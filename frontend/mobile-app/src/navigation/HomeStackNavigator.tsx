import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { AppointmentDetailScreen } from '../screens/appointments/AppointmentDetailScreen';
import { BookAppointmentScreen } from '../screens/home/BookAppointmentScreen';
import { BrowseDoctorsScreen } from '../screens/home/BrowseDoctorsScreen';
import { BrowseTherapyScreen } from '../screens/home/BrowseTherapyScreen';
import { ConsultationTypeScreen } from '../screens/home/ConsultationTypeScreen';
import { DoctorProfileScreen } from '../screens/home/DoctorProfileScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { NotificationsScreen } from '../screens/home/NotificationsScreen';
import { PaymentSuccessScreen } from '../screens/home/PaymentSuccessScreen';
import { PaymentSummaryScreen } from '../screens/home/PaymentSummaryScreen';
import { TherapistListScreen } from '../screens/home/TherapistListScreen';
import { ChildFormScreen } from '../screens/profile/ChildFormScreen';
import { ManageChildrenScreen } from '../screens/profile/ManageChildrenScreen';
import { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export const HomeStackNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HomeMain" component={HomeScreen} />
    <Stack.Screen name="BrowseTherapy" component={BrowseTherapyScreen} />
    <Stack.Screen name="BrowseDoctors" component={BrowseDoctorsScreen} />
    <Stack.Screen name="TherapistList" component={TherapistListScreen} />
    <Stack.Screen name="DoctorProfile" component={DoctorProfileScreen} />
    <Stack.Screen name="ConsultationType" component={ConsultationTypeScreen} />
    <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} />
    <Stack.Screen name="PaymentSummary" component={PaymentSummaryScreen} />
    <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
    <Stack.Screen name="ManageChildren" component={ManageChildrenScreen} />
    <Stack.Screen name="ChildForm" component={ChildFormScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
  </Stack.Navigator>
);
