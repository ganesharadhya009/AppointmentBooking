import { SlotState, TimeSlot } from '../types';

const DAY_TIMES = [
  '09:30', '10:15', '11:00', '11:45',
  '12:30', '13:15', '14:00', '14:45',
  '15:30', '16:15', '17:00', '17:45',
  '18:30',
];

// Deterministic pseudo-random state per date+time so the grid looks
// realistic but is stable across re-renders instead of reshuffling.
function seededState(dateKey: string, time: string): SlotState {
  const seed = `${dateKey}-${time}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000;
  }
  if (hash % 7 === 0) return 'bookedByOther';
  if (hash % 11 === 0) return 'unavailable';
  return 'available';
}

export function buildSlotsForDate(date: Date): TimeSlot[] {
  const dateKey = date.toISOString().slice(0, 10);
  const now = new Date();
  const isToday = dateKey === now.toISOString().slice(0, 10);
  const isPast = date < new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return DAY_TIMES.map((time) => {
    if (isPast) return { time, state: 'past' as SlotState };
    if (isToday) {
      const [h, m] = time.split(':').map(Number);
      const slotDate = new Date(now);
      slotDate.setHours(h, m, 0, 0);
      if (slotDate < now) return { time, state: 'past' as SlotState };
    }
    return { time, state: seededState(dateKey, time) };
  });
}
