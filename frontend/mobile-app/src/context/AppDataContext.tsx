import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  initialSupportTickets,
  initialWalletTransactions,
} from '../data/mockData';
import {
  Appointment,
  Child,
  PendingBooking,
  SupportMessage,
  SupportTicket,
  WalletTransaction,
} from '../types';

const seedChildren: Child[] = [
  { id: 'c1', name: 'Ragu', dob: '2019-03-12', gender: 'Male', guardianRelation: 'Son' },
];

const seedAppointments: Appointment[] = [
  {
    id: 'ap1',
    type: 'therapy',
    childId: 'c1',
    childName: 'Ragu',
    branchName: 'Indira Nagar',
    providerId: 'th2',
    providerName: 'Kiran Shetty',
    serviceName: 'Speech & Language Therapy',
    date: '2026-08-19',
    time: '10:15',
    cost: 500,
    status: 'planned',
    paymentMethod: 'Wallet',
  },
  {
    id: 'ap2',
    type: 'consultation',
    childId: 'c1',
    childName: 'Ragu',
    branchName: 'Bangalore',
    providerId: 'd1',
    providerName: 'Revathi G G',
    serviceName: 'Clinic Appointment',
    date: '2026-08-05',
    time: '11:00',
    cost: 700,
    status: 'completed',
    paymentMethod: 'Online',
  },
];

interface AppDataContextValue {
  children_: Child[];
  addChild: (child: Omit<Child, 'id'>) => Child;
  updateChild: (id: string, child: Omit<Child, 'id'>) => void;
  appointments: Appointment[];
  addAppointment: (appt: Omit<Appointment, 'id'>) => Appointment;
  cancelAppointment: (id: string) => void;
  wallet: WalletTransaction[];
  walletBalance: number;
  addWalletTopUp: (amount: number) => void;
  debitWallet: (amount: number, description: string) => void;
  tickets: SupportTicket[];
  addTicket: (title: string, category: string, message: string) => void;
  replyToTicket: (ticketId: string, message: SupportMessage) => void;
  pendingBooking: PendingBooking | null;
  setPendingBooking: (b: PendingBooking | null) => void;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

let idCounter = 100;
const nextId = (prefix: string) => `${prefix}${idCounter++}`;

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [childrenList, setChildrenList] = useState<Child[]>(seedChildren);
  const [appointments, setAppointments] = useState<Appointment[]>(seedAppointments);
  const [wallet, setWallet] = useState<WalletTransaction[]>(initialWalletTransactions);
  const [tickets, setTickets] = useState<SupportTicket[]>(initialSupportTickets);
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null);

  const walletBalance = wallet.length ? wallet[wallet.length - 1].balanceAfter : 0;

  const addChild: AppDataContextValue['addChild'] = (child) => {
    const newChild: Child = { ...child, id: nextId('c') };
    setChildrenList((prev) => [...prev, newChild]);
    return newChild;
  };

  const updateChild: AppDataContextValue['updateChild'] = (id, child) => {
    setChildrenList((prev) => prev.map((c) => (c.id === id ? { ...child, id } : c)));
  };

  const addAppointment: AppDataContextValue['addAppointment'] = (appt) => {
    const newAppt: Appointment = { ...appt, id: nextId('ap') };
    setAppointments((prev) => [newAppt, ...prev]);
    return newAppt;
  };

  const cancelAppointment = (id: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a))
    );
  };

  const addWalletTopUp = (amount: number) => {
    setWallet((prev) => {
      const balance = (prev.length ? prev[prev.length - 1].balanceAfter : 0) + amount;
      return [
        ...prev,
        {
          id: nextId('w'),
          date: new Date().toISOString().slice(0, 10),
          description: 'Wallet top-up',
          amount,
          direction: 'credit',
          balanceAfter: balance,
        },
      ];
    });
  };

  const debitWallet = (amount: number, description: string) => {
    setWallet((prev) => {
      const balance = (prev.length ? prev[prev.length - 1].balanceAfter : 0) - amount;
      return [
        ...prev,
        {
          id: nextId('w'),
          date: new Date().toISOString().slice(0, 10),
          description,
          amount,
          direction: 'debit',
          balanceAfter: balance,
        },
      ];
    });
  };

  const addTicket: AppDataContextValue['addTicket'] = (title, category, message) => {
    const ticket: SupportTicket = {
      id: nextId('tk'),
      ticketNo: `SPT-${1000 + tickets.length + 1}`,
      title,
      category,
      status: 'Open',
      createdAt: new Date().toISOString().slice(0, 10),
      messages: [
        { id: nextId('m'), sender: 'user', text: message, timestamp: new Date().toLocaleString() },
      ],
    };
    setTickets((prev) => [ticket, ...prev]);
  };

  const replyToTicket = (ticketId: string, message: SupportMessage) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, messages: [...t.messages, message] } : t))
    );
  };

  const value = useMemo(
    () => ({
      children_: childrenList,
      addChild,
      updateChild,
      appointments,
      addAppointment,
      cancelAppointment,
      wallet,
      walletBalance,
      addWalletTopUp,
      debitWallet,
      tickets,
      addTicket,
      replyToTicket,
      pendingBooking,
      setPendingBooking,
    }),
    [childrenList, appointments, wallet, walletBalance, tickets, pendingBooking]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
