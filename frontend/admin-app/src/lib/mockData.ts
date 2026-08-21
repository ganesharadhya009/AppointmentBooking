import type {
  Branch,
  Therapy,
  Therapist,
  ConsultantService,
  ConsultantBranch,
  ConsultantDoctor,
  Enquiry,
  Holiday,
  Appointment,
  RefundRequest,
  LeaveRequest,
  SupportTicket,
  WalletTxn,
  OtpLog,
  PaymentTxn,
  SwapLog,
  Parent,
  ChildRecord,
  Poster,
  AppVersion,
  AdminUser,
} from "./types";
import { daysAgo, daysFromNow, nextId, pick, randInt } from "./utils";

const avatarPalette = ["#4f46e5", "#0d9488", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6", "#10b981", "#ec4899"];
const nextColor = () => pick(avatarPalette);

const parentFirstNames = [
  "Rashmi", "Suresh", "Anjali", "Kiran", "Deepa", "Manoj", "Priya", "Ravi", "Lakshmi", "Arjun",
  "Sneha", "Vikram", "Pooja", "Naveen", "Meera", "Ganesh", "Divya", "Rahul", "Swathi", "Anand",
  "Nandini", "Prakash", "Kavya", "Sanjay", "Bhavana", "Karthik", "Shalini", "Vinay", "Asha", "Mahesh",
];
const lastNames = [
  "Rao", "Kumar", "Gowda", "Shetty", "Reddy", "Iyer", "Nair", "Patil", "Desai", "Hegde",
  "Bhat", "Naidu", "Pillai", "Kulkarni", "Menon", "Acharya", "Shastri", "Prabhu", "Kamath", "Murthy",
];
const childFirstNames = [
  "Aarav", "Diya", "Vihaan", "Ananya", "Reyansh", "Ira", "Advait", "Myra", "Kabir", "Saanvi",
  "Arnav", "Aadhya", "Vivaan", "Kiara", "Ayaan", "Riya", "Dhruv", "Prisha", "Rudra", "Anvi",
];
const branchNames = [
  { name: "Banashankari", city: "Bengaluru", state: "Karnataka", location: "Banashankari II Stage" },
  { name: "Kuvempunagar", city: "Mysuru", state: "Karnataka", location: "Kuvempunagar 3rd Stage" },
  { name: "Indiranagar", city: "Bengaluru", state: "Karnataka", location: "100 Feet Road, Indiranagar" },
];
const therapyNames = [
  "Occupational Therapy", "Physiotherapy", "Speech & Language Therapy", "ABA Therapy",
  "Behavioral Therapy", "Special Education", "Play Therapy", "Life Skills Training",
  "Guidance & Counseling", "Light & Music Therapy", "Vocational Training",
];
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function fullName() {
  return `${pick(parentFirstNames)} ${pick(lastNames)}`;
}
function childName() {
  return `${pick(childFirstNames)} ${pick(lastNames)}`;
}
function phone() {
  return `9${randInt(100000000, 999999999)}`;
}

// ---------------- Branches ----------------
export const branches: Branch[] = branchNames.map((b, i) => ({
  id: i + 1,
  name: b.name,
  leadName: fullName(),
  leadContact: phone(),
  contact: phone(),
  dayOff: pick(days),
  discountType: "Amount",
  tiers: [10, 24, 48, 72, 96].map((sessions, idx) => ({
    sessions,
    days: sessions * 3,
    discountPerSession: (idx + 1) * 25,
  })),
  country: "India",
  state: b.state,
  city: b.city,
  location: b.location,
  lat: (12.9 + Math.random()).toFixed(4),
  lng: (77.5 + Math.random()).toFixed(4),
  imageColor: nextColor(),
  status: "Active",
  createdAt: daysAgo(randInt(60, 400)),
}));

// ---------------- Therapy Catalog ----------------
export const therapies: Therapy[] = therapyNames.flatMap((name, i) => {
  const count = i % 3 === 0 ? 2 : 1;
  return Array.from({ length: count }).map((_, j) => {
    const branch = branches[(i + j) % branches.length];
    return {
      id: nextId(),
      name,
      branchId: branch.id,
      branchName: branch.name,
      status: i > 8 ? "Deleted" : "Active",
      createdBy: "Bimba Super Admin",
      createdAt: daysAgo(randInt(30, 300)),
      imageColor: nextColor(),
    } as Therapy;
  });
});

// ---------------- Multi-Therapist ----------------
const specialistDomains = ["Pediatric OT", "Neuro Physiotherapy", "Speech-Language Pathology", "ABA Specialist", "Special Educator"];
const designations = ["Senior Therapist", "Therapist", "Lead Therapist", "Consultant Therapist"];

function makeWindow(label: SessionWindowLabel, start: string, end: string): { label: SessionWindowLabel; start: string; end: string; price: number; enabled: boolean } {
  return { label, start, end, price: randInt(400, 900), enabled: Math.random() > 0.3 };
}
type SessionWindowLabel = "Morning" | "Noon" | "Afternoon" | "Evening";

export const therapists: Therapist[] = Array.from({ length: 14 }).map((_, i) => {
  const isMulti = i % 4 === 0;
  const assignedBranches = isMulti ? branches.slice(0, 2) : [pick(branches)];
  return {
    id: nextId(),
    name: `Dr. ${fullName()}`,
    mobile: phone(),
    email: `therapist${i + 1}@bimbaconnect.in`,
    gender: pick(["Male", "Female"] as const),
    designation: pick(designations),
    domainSpecialist: pick(specialistDomains),
    licenseNumber: `KAR-LIC-${randInt(1000, 9999)}`,
    status: i === 12 ? "Deleted" : "Active",
    assignments: assignedBranches.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      therapyName: pick(therapyNames),
      joiningDate: daysAgo(randInt(60, 500)),
      dayOff: pick(days),
      lunchBreak: "1:00 PM - 2:00 PM",
      windows: [
        makeWindow("Morning", "09:00", "12:00"),
        makeWindow("Noon", "12:00", "14:00"),
        makeWindow("Afternoon", "14:00", "17:00"),
        makeWindow("Evening", "17:00", "20:00"),
      ],
    })),
    avatarColor: nextColor(),
    createdAt: daysAgo(randInt(30, 400)),
  };
});

// ---------------- Consultants ----------------
export const consultantServices: ConsultantService[] = [
  "Paediatry", "ENT", "Psychiatric Consultation", "Dermatology", "Orthopaedics", "Nutrition & Diet",
].map((name) => ({ id: nextId(), name, status: "Active", imageColor: nextColor() }));

export const consultantBranches: ConsultantBranch[] = [
  "Manipal Hospital", "Apollo Clinic", "Columbia Asia", "Sagar Hospitals", "Fortis Clinic",
].map((name) => ({
  id: nextId(),
  name,
  leadName: fullName(),
  leadContact: phone(),
  state: "Karnataka",
  city: pick(["Bengaluru", "Mysuru"]),
  status: "Active",
}));

export const consultantDoctors: ConsultantDoctor[] = Array.from({ length: 10 }).map(() => {
  const service = pick(consultantServices);
  const clinic = pick(consultantBranches);
  return {
    id: nextId(),
    name: `Dr. ${fullName()}`,
    serviceId: service.id,
    serviceName: service.name,
    clinicId: clinic.id,
    clinicName: clinic.name,
    city: clinic.city,
    status: "Active",
    fee: randInt(400, 1200),
  };
});

// ---------------- Enquiries ----------------
const concernsBank = [
  "Delayed speech development", "Difficulty with social interaction", "Sensory sensitivity",
  "Fine motor skill delay", "Attention & focus concerns", "Repetitive behaviors",
];
export const enquiries: Enquiry[] = Array.from({ length: 22 }).map((_, i) => ({
  id: nextId(),
  parentName: fullName(),
  contact: phone(),
  childName: childName(),
  childDob: daysAgo(randInt(365 * 2, 365 * 9)),
  childGender: pick(["Male", "Female"] as const),
  preferredTherapy: pick(therapyNames),
  branchName: pick(branches).name,
  city: pick(branches).city,
  status: pick(["Enquiry", "Follow-up", "Converted", "Closed"] as const),
  followUpAt: i % 2 === 0 ? daysFromNow(randInt(1, 10)) : undefined,
  createdBy: "Bimba Super Admin",
  createdAt: daysAgo(randInt(0, 60)),
  isDraft: i % 6 === 0,
  concerns: Array.from({ length: randInt(1, 3) }, () => pick(concernsBank)),
}));

// ---------------- Holidays ----------------
export const holidays: Holiday[] = [
  { reason: "Ganesh Chaturthi" }, { reason: "Independence Day" }, { reason: "Gandhi Jayanti" },
  { reason: "Diwali" }, { reason: "Branch Maintenance" }, { reason: "Local Festival" },
].map((h, i) => {
  const b = branches[i % branches.length];
  return {
    id: nextId(),
    date: daysFromNow(randInt(-20, 45)),
    branchId: b.id,
    branchName: b.name,
    reason: h.reason,
  };
});

// ---------------- Appointments ----------------
const apptStatuses = ["Planned", "Completed", "Cancelled"] as const;
export const appointments: Appointment[] = Array.from({ length: 60 }).map((_, i) => {
  const branch = pick(branches);
  const therapist = pick(therapists);
  const type = i % 5 === 0 ? "Consultation" : "Therapy";
  return {
    id: nextId(),
    type,
    childName: childName(),
    parentName: fullName(),
    branchName: branch.name,
    therapistName: type === "Therapy" ? therapist.name : `Dr. ${fullName()}`,
    therapyName: type === "Therapy" ? pick(therapyNames) : pick(consultantServices).name,
    date: daysFromNow(randInt(-30, 14)),
    time: `${randInt(9, 18)}:${pick(["00", "15", "30", "45"])}`,
    amount: randInt(400, 1500),
    bookedBy: pick(["Parent App", "Admin Console", "Doctor & Admin App"]),
    status: pick(apptStatuses),
  };
});

// ---------------- Activity Desk ----------------
export const refundRequests: RefundRequest[] = Array.from({ length: 9 }).map(() => ({
  id: nextId(),
  parentName: fullName(),
  childName: childName(),
  doctorName: pick(therapists).name,
  branchName: pick(branches).name,
  amount: randInt(500, 2000),
  cancelledAt: daysAgo(randInt(0, 15)),
  status: pick(["Under Process", "Approved", "Rejected"] as const),
}));

export const leaveRequests: LeaveRequest[] = Array.from({ length: 7 }).map(() => {
  const from = daysFromNow(randInt(0, 10));
  return {
    id: nextId(),
    therapistName: pick(therapists).name,
    branchName: pick(branches).name,
    fromDate: from,
    toDate: daysFromNow(randInt(11, 15)),
    reason: pick(["Personal", "Medical", "Family function", "Travel"]),
    status: pick(["Pending", "Approved", "Rejected"] as const),
  };
});

export const parentTickets: SupportTicket[] = Array.from({ length: 8 }).map((_, i) => ({
  id: nextId(),
  ticketNo: `PT-${2000 + i}`,
  title: pick(["Payment not reflecting", "Unable to reschedule", "Wallet balance issue", "App crash on booking", "Refund delay"]),
  category: pick(["Payment", "Booking", "Technical", "Account"]),
  raisedBy: fullName(),
  waitingFor: pick(["Admin reply", "User reply"] as const),
  status: pick(["Open", "Resolved", "Closed"] as const),
  createdAt: daysAgo(randInt(0, 20)),
}));

export const therapistTickets: SupportTicket[] = Array.from({ length: 6 }).map((_, i) => ({
  id: nextId(),
  ticketNo: `TT-${3000 + i}`,
  title: pick(["Schedule conflict", "Payout query", "Leave not approved", "Profile update request"]),
  category: pick(["Schedule", "Payout", "Account"]),
  raisedBy: pick(therapists).name,
  waitingFor: pick(["Admin reply", "User reply"] as const),
  status: pick(["Open", "Resolved", "Closed"] as const),
  createdAt: daysAgo(randInt(0, 20)),
}));

// ---------------- Reports ----------------
export const walletTxns: WalletTxn[] = Array.from({ length: 20 }).map(() => ({
  id: nextId(),
  parentName: fullName(),
  type: pick(["Credit", "Debit"] as const),
  amount: randInt(100, 3000),
  reference: `APT-${randInt(10000, 99999)}`,
  date: daysAgo(randInt(0, 30)),
}));

export const otpLogs: OtpLog[] = Array.from({ length: 18 }).map(() => ({
  id: nextId(),
  number: phone(),
  otp: String(randInt(100000, 999999)),
  purpose: pick(["Login", "Signup", "Password Reset", "Payment Verification"]),
  timestamp: daysAgo(randInt(0, 5)),
  status: pick(["Verified", "Expired", "Pending"] as const),
}));

export const paymentTxns: PaymentTxn[] = Array.from({ length: 24 }).map((_, i) => {
  const amount = randInt(500, 3000);
  const discount = randInt(0, 200);
  return {
    id: nextId(),
    invoiceNo: `INV-${2026}${String(i + 1).padStart(4, "0")}`,
    parentName: fullName(),
    amount,
    discount,
    paidAmount: amount - discount,
    txnStatus: pick(["Success", "Failed", "In Process", "Aborted"] as const),
    bookingStatus: pick(["Confirmed", "Pending", "Cancelled"] as const),
    date: daysAgo(randInt(0, 20)),
  };
});

export const swapLogs: SwapLog[] = Array.from({ length: 10 }).map(() => ({
  id: nextId(),
  originalChild: childName(),
  swappedChild: childName(),
  originalTherapist: pick(therapists).name,
  swappedTherapist: pick(therapists).name,
  originalDate: daysAgo(randInt(1, 20)),
  swappedDate: daysFromNow(randInt(1, 10)),
  branchName: pick(branches).name,
}));

// ---------------- Clients & Children ----------------
export const parents: Parent[] = Array.from({ length: 40 }).map(() => {
  const cCount = randInt(1, 3);
  return {
    id: nextId(),
    name: fullName(),
    contact: phone(),
    email: `parent${randInt(100, 999)}@gmail.com`,
    address: `${randInt(1, 200)}, ${pick(["MG Road", "Ring Road", "Church Street", "JP Nagar"])}`,
    city: pick(branches).city,
    childrenCount: cCount,
    appointmentsCount: randInt(2, 40),
    signupDate: daysAgo(randInt(5, 400)),
    status: "Active",
    locked: Math.random() < 0.1,
  };
});

export const children: ChildRecord[] = Array.from({ length: 45 }).map(() => ({
  id: nextId(),
  name: childName(),
  dob: daysAgo(randInt(365 * 2, 365 * 10)),
  gender: pick(["Male", "Female"] as const),
  guardian: fullName(),
  phone: phone(),
  branchName: pick(branches).name,
  planned: randInt(0, 5),
  cancelled: randInt(0, 3),
  completed: randInt(2, 30),
  status: "Active",
}));

// ---------------- Banners & Posters ----------------
export const posters: Poster[] = Array.from({ length: 8 }).map((_, i) => ({
  id: nextId(),
  title: pick(["New Year Offer", "Free Screening Camp", "Refer & Earn", "Speech Therapy Week", "Holiday Notice"]),
  type: "Poster Image",
  position: pick(["Top", "Bottom", "Popup"] as const),
  priority: i + 1,
  fromDate: daysAgo(randInt(0, 10)),
  toDate: daysFromNow(randInt(5, 30)),
  status: "Active",
  imageColor: nextColor(),
}));

// ---------------- App Versions ----------------
export const appVersions: AppVersion[] = [
  { version: "2.4.1", app: "Parent App" as const, forceUpdate: false },
  { version: "2.3.0", app: "Parent App" as const, forceUpdate: true },
  { version: "1.9.2", app: "Doctor & Admin App" as const, forceUpdate: false },
  { version: "1.8.0", app: "Doctor & Admin App" as const, forceUpdate: true },
].map((v) => ({
  id: nextId(),
  version: v.version,
  app: v.app,
  store: "Android" as const,
  status: "Active" as const,
  forceUpdate: v.forceUpdate,
  releaseDate: daysAgo(randInt(5, 120)),
  description: "Bug fixes and performance improvements.",
  releasedBy: "Bimba Super Admin",
}));

// ---------------- Admin Users ----------------
export const adminUsers: AdminUser[] = [
  { name: "Bimba Super Admin", role: "Super Admin" as const },
  { name: "Rashmi K Rao", role: "Admin" as const },
  { name: "Suresh Kumar", role: "Admin" as const },
  { name: "Anjali Gowda", role: "Auditor" as const },
  { name: "Kiran Shetty", role: "Admin" as const },
  { name: "Deepa Reddy", role: "Auditor" as const },
  { name: "Manoj Iyer", role: "Admin" as const },
  { name: "Priya Nair", role: "Admin" as const },
  { name: "Ravi Patil", role: "Auditor" as const },
].map((u) => ({
  id: nextId(),
  name: u.name,
  dob: daysAgo(randInt(365 * 25, 365 * 45)),
  contact: phone(),
  email: `${u.name.split(" ")[0].toLowerCase()}@bimbaconnect.in`,
  role: u.role,
  status: "Active" as const,
  avatarColor: nextColor(),
  createdAt: daysAgo(randInt(30, 500)),
}));

export const therapyNamesList = therapyNames;
export const branchNameList = branches.map((b) => b.name);
export const dayList = days;

export function makeId() {
  return nextId();
}
