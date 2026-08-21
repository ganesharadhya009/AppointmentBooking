export type Status = "Active" | "Inactive" | "Deleted";

export interface PackageTier {
  sessions: number;
  days: number;
  discountPerSession: number;
}

export interface Branch {
  id: number;
  name: string;
  leadName: string;
  leadContact: string;
  contact?: string;
  dayOff: string;
  discountType: "Amount" | "Percentage";
  tiers: PackageTier[];
  country: string;
  state: string;
  city: string;
  location: string;
  lat?: string;
  lng?: string;
  imageColor: string;
  status: Status;
  createdAt: string;
}

export interface Therapy {
  id: number;
  name: string;
  branchId: number;
  branchName: string;
  status: Status;
  createdBy: string;
  createdAt: string;
  imageColor: string;
}

export interface SessionWindow {
  label: "Morning" | "Noon" | "Afternoon" | "Evening";
  start: string;
  end: string;
  price: number;
  enabled: boolean;
}

export interface TherapistAssignment {
  branchId: number;
  branchName: string;
  therapyName: string;
  joiningDate: string;
  dayOff: string;
  lunchBreak: string;
  windows: SessionWindow[];
}

export interface Therapist {
  id: number;
  name: string;
  mobile: string;
  email: string;
  gender: "Male" | "Female" | "Other";
  designation: string;
  domainSpecialist: string;
  licenseNumber: string;
  status: Status;
  assignments: TherapistAssignment[];
  avatarColor: string;
  createdAt: string;
}

export interface ConsultantService {
  id: number;
  name: string;
  status: Status;
  imageColor: string;
}

export interface ConsultantBranch {
  id: number;
  name: string;
  leadName: string;
  leadContact: string;
  state: string;
  city: string;
  status: Status;
}

export interface ConsultantDoctor {
  id: number;
  name: string;
  serviceId: number;
  serviceName: string;
  clinicId: number;
  clinicName: string;
  city: string;
  status: Status;
  fee: number;
}

export interface Enquiry {
  id: number;
  parentName: string;
  contact: string;
  childName: string;
  childDob: string;
  childGender: "Male" | "Female";
  preferredTherapy: string;
  branchName: string;
  city: string;
  status: "Enquiry" | "Follow-up" | "Converted" | "Closed";
  followUpAt?: string;
  createdBy: string;
  createdAt: string;
  isDraft: boolean;
  concerns: string[];
}

export interface Holiday {
  id: number;
  date: string;
  branchId: number;
  branchName: string;
  reason: string;
}

export type AppointmentStatus = "Planned" | "Completed" | "Cancelled";

export interface Appointment {
  id: number;
  type: "Therapy" | "Consultation";
  childName: string;
  parentName: string;
  branchName: string;
  therapistName: string;
  therapyName: string;
  date: string;
  time: string;
  amount: number;
  bookedBy: string;
  status: AppointmentStatus;
}

export type RefundStatus = "Under Process" | "Approved" | "Rejected";

export interface RefundRequest {
  id: number;
  parentName: string;
  childName: string;
  doctorName: string;
  branchName: string;
  amount: number;
  cancelledAt: string;
  status: RefundStatus;
}

export interface LeaveRequest {
  id: number;
  therapistName: string;
  branchName: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
}

export interface SupportTicket {
  id: number;
  ticketNo: string;
  title: string;
  category: string;
  raisedBy: string;
  waitingFor: "Admin reply" | "User reply";
  status: "Open" | "Resolved" | "Closed";
  createdAt: string;
}

export interface WalletTxn {
  id: number;
  parentName: string;
  type: "Credit" | "Debit";
  amount: number;
  reference: string;
  date: string;
}

export interface OtpLog {
  id: number;
  number: string;
  otp: string;
  purpose: string;
  timestamp: string;
  status: "Verified" | "Expired" | "Pending";
}

export interface PaymentTxn {
  id: number;
  invoiceNo: string;
  parentName: string;
  amount: number;
  discount: number;
  paidAmount: number;
  txnStatus: "Success" | "Failed" | "In Process" | "Aborted";
  bookingStatus: "Confirmed" | "Pending" | "Cancelled";
  date: string;
}

export interface SwapLog {
  id: number;
  originalChild: string;
  swappedChild: string;
  originalTherapist: string;
  swappedTherapist: string;
  originalDate: string;
  swappedDate: string;
  branchName: string;
}

export interface Parent {
  id: number;
  name: string;
  contact: string;
  email: string;
  address: string;
  city: string;
  childrenCount: number;
  appointmentsCount: number;
  signupDate: string;
  status: Status;
  locked: boolean;
}

export interface ChildRecord {
  id: number;
  name: string;
  dob: string;
  gender: "Male" | "Female";
  guardian: string;
  phone: string;
  branchName: string;
  planned: number;
  cancelled: number;
  completed: number;
  status: Status;
}

export interface Poster {
  id: number;
  title: string;
  type: string;
  position: "Top" | "Bottom" | "Popup";
  priority: number;
  fromDate: string;
  toDate: string;
  status: Status;
  imageColor: string;
}

export interface AppVersion {
  id: number;
  version: string;
  app: "Doctor & Admin App" | "Parent App";
  store: "Android";
  status: Status;
  forceUpdate: boolean;
  releaseDate: string;
  description: string;
  releasedBy: string;
}

export type AdminRole = "Super Admin" | "Admin" | "Auditor" | "Therapist" | "HR";

export interface AdminUser {
  id: number;
  name: string;
  dob: string;
  contact: string;
  email: string;
  role: AdminRole;
  status: Status;
  avatarColor: string;
  createdAt: string;
}
