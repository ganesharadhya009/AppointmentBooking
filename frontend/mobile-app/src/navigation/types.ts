import { BookingType } from '../types';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  BrowseTherapy: undefined;
  BrowseDoctors: undefined;
  TherapistList: { therapyId: string };
  DoctorProfile: { doctorId: string };
  ConsultationType: { doctorId: string };
  BookAppointment: { type: BookingType; providerId: string; childId?: string };
  PaymentSummary: undefined;
  PaymentSuccess: undefined;
  AppointmentDetail: { appointmentId: string };
  ManageChildren: undefined;
  ChildForm: { childId?: string } | undefined;
  Notifications: undefined;
};

export type MyAppointmentsStackParamList = {
  MyAppointmentsMain: undefined;
  AppointmentDetail: { appointmentId: string };
};

export type SupportStackParamList = {
  SupportMain: undefined;
  NewTicket: undefined;
  TicketThread: { ticketId: string };
};

export type WalletStackParamList = {
  WalletMain: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ManageChildren: undefined;
  ChildForm: { childId?: string } | undefined;
  ChangePassword: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  AppointmentsTab: undefined;
  SupportTab: undefined;
  WalletTab: undefined;
  ProfileTab: undefined;
};
