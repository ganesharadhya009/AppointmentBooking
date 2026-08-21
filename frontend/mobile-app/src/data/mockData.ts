import {
  Branch,
  ConsultingDoctor,
  SupportTicket,
  Therapist,
  Therapy,
  WalletTransaction,
} from '../types';

export const branches: Branch[] = [
  { id: 'b1', name: 'Indira Nagar', city: 'Bangalore', address: '12th Main, Indira Nagar, Bangalore' },
  { id: 'b2', name: 'Banashankari', city: 'Bangalore', address: 'Banashankari II Stage, Bangalore' },
  { id: 'b3', name: 'Kuvempunagar', city: 'Mysore', address: 'Kuvempunagar, Mysore' },
];

export const therapies: Therapy[] = [
  { id: 't1', name: 'Occupational Therapy', branchId: 'b1', icon: 'hand-left', description: 'Builds everyday motor and self-care skills through guided, playful activity.' },
  { id: 't2', name: 'Speech & Language Therapy', branchId: 'b1', icon: 'chatbubbles', description: 'Improves communication, articulation and language development.' },
  { id: 't3', name: 'Physiotherapy', branchId: 'b1', icon: 'body', description: 'Strength, coordination and mobility support for developing children.' },
  { id: 't4', name: 'ABA Therapy', branchId: 'b1', icon: 'happy', description: 'Applied Behavioral Analysis for behavioral and social skill growth.' },
  { id: 't5', name: 'Speech & Language Therapy', branchId: 'b2', icon: 'chatbubbles', description: 'Improves communication, articulation and language development.' },
  { id: 't6', name: 'Special Education', branchId: 'b2', icon: 'school', description: 'Individualised learning plans for diverse developmental needs.' },
];

export const therapists: Therapist[] = [
  { id: 'th1', name: 'Dr. Ananya Rao', designation: 'Senior Occupational Therapist', therapyId: 't1', branchId: 'b1', experienceYears: 8, rating: 4.7, specialties: ['Occupational Therapy', 'Sensory Integration', 'Fine Motor Skills'] },
  { id: 'th2', name: 'Kiran Shetty', designation: 'Speech Language Pathologist', therapyId: 't2', branchId: 'b1', experienceYears: 6, rating: 4.8, specialties: ['Speech Therapy', 'Language Development', 'Articulation'] },
  { id: 'th3', name: 'Meera Iyer', designation: 'Physiotherapist', therapyId: 't3', branchId: 'b1', experienceYears: 5, rating: 4.6, specialties: ['Physiotherapy', 'Gross Motor Skills', 'Balance Training'] },
  { id: 'th4', name: 'Rahul Nair', designation: 'Behavioral Therapist', therapyId: 't4', branchId: 'b1', experienceYears: 7, rating: 4.9, specialties: ['ABA Therapy', 'Behavioral Therapy', 'Social Skills', 'Guidance & Counseling'] },
];

export const consultingDoctors: ConsultingDoctor[] = [
  {
    id: 'd1',
    name: 'Revathi G G',
    qualifications: 'MDS - Paedodontics and Preventive Dentistry, BDS',
    specialty: 'Pediatric Neurologist',
    experienceYears: 12,
    rating: 4.5,
    fee: 700,
    clinicName: 'Pragyan Child Development Centre',
    clinicCity: 'Bangalore',
    clinicAddress: 'Multi Speciality Clinic, Bangalore',
    timings: 'All days except Sunday, 10:30 AM to 8:30 PM',
    verified: true,
  },
  {
    id: 'd2',
    name: 'Arvind Bhat',
    qualifications: 'MBBS, MD - Pediatrics',
    specialty: 'Pediatric Neurologist',
    experienceYears: 15,
    rating: 4.8,
    fee: 900,
    clinicName: 'CDC Connect Clinic',
    clinicCity: 'Bangalore',
    clinicAddress: 'Indira Nagar, Bangalore',
    timings: 'Mon - Sat, 9:00 AM to 6:00 PM',
    verified: true,
  },
];

export const initialWalletTransactions: WalletTransaction[] = [
  { id: 'w1', date: '2026-08-02', description: 'Wallet top-up', amount: 1000, direction: 'credit', balanceAfter: 1000 },
  { id: 'w2', date: '2026-08-05', description: 'Speech Therapy session - Ragu', amount: 500, direction: 'debit', balanceAfter: 500 },
  { id: 'w3', date: '2026-08-09', description: 'Wallet top-up', amount: 300, direction: 'credit', balanceAfter: 800 },
];

export const initialSupportTickets: SupportTicket[] = [
  {
    id: 'tk1',
    ticketNo: 'SPT-1042',
    title: 'Refund not received for cancelled session',
    category: 'Payments',
    status: 'Waiting for Admin',
    createdAt: '2026-08-10',
    messages: [
      { id: 'm1', sender: 'user', text: 'I cancelled a session on 8th Aug but the refund has not reflected in my wallet yet.', timestamp: '2026-08-10 10:14 AM' },
      { id: 'm2', sender: 'admin', text: 'Thanks for reaching out, we are checking with the finance team and will update you shortly.', timestamp: '2026-08-10 03:40 PM' },
    ],
  },
];
