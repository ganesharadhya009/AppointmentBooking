export type UserType = 'parent';

export interface User {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  branchId: string;
}

export interface Child {
  id: string;
  name: string;
  dob: string;
  gender: 'Male' | 'Female';
  guardianRelation: string;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface Therapy {
  id: string;
  name: string;
  branchId: string;
  icon: string;
  description: string;
}

export interface Therapist {
  id: string;
  name: string;
  designation: string;
  therapyId: string;
  branchId: string;
  experienceYears: number;
  rating: number;
  specialties: string[];
  /** Price of this therapist's assignment's first configured session window, if any. */
  sessionPrice?: number;
}

export interface ConsultingDoctor {
  id: string;
  name: string;
  qualifications: string;
  specialty: string;
  experienceYears: number;
  rating: number;
  fee: number;
  clinicName: string;
  clinicCity: string;
  clinicAddress: string;
  timings: string;
  verified: boolean;
}

export type SlotState =
  | 'available'
  | 'past'
  | 'selected'
  | 'bookedByOther'
  | 'bookedByYou'
  | 'unavailable'
  | 'break';

export interface TimeSlot {
  time: string;
  state: SlotState;
}

export type BookingType = 'therapy' | 'consultation';
export type AppointmentStatus = 'planned' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  type: BookingType;
  childId: string;
  childName: string;
  branchName: string;
  providerId: string;
  providerName: string;
  serviceName: string;
  date: string;
  time: string;
  cost: number;
  status: AppointmentStatus;
  paymentMethod: 'Wallet' | 'Online' | 'Cash on Pay' | 'Branch QR';
}

export interface WalletTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: 'credit' | 'debit';
  balanceAfter: number;
}

export type TicketStatus = 'Open' | 'Waiting for Admin' | 'Resolved';

export interface SupportMessage {
  id: string;
  sender: 'user' | 'admin';
  text: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  ticketNo: string;
  title: string;
  category: string;
  status: TicketStatus;
  createdAt: string;
  messages: SupportMessage[];
}

export interface PendingBooking {
  type: BookingType;
  childId: string;
  branchId: string;
  therapyId?: string;
  therapistId?: string;
  doctorId?: string;
  date: string;
  time: string;
  cost: number;
  serviceName: string;
  providerName: string;
}
