import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../theme/theme';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  minDate?: Date;
}

export const MonthCalendar: React.FC<Props> = ({ selectedDate, onSelectDate, minDate }) => {
  const [visibleMonth, setVisibleMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const today = startOfDay(new Date());
  const floor = minDate ? startOfDay(minDate) : today;

  const cells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const list: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(year, month, d));
    return list;
  }, [visibleMonth]);

  return (
    <View>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTH_NAMES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</Text>
        <TouchableOpacity
          onPress={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={i} style={styles.cell} />;
          const disabled = date < floor;
          const selected = isSameDay(date, selectedDate);
          return (
            <TouchableOpacity
              key={i}
              style={styles.cell}
              disabled={disabled}
              onPress={() => onSelectDate(date)}
            >
              <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                <Text style={[styles.dayText, disabled && styles.dayTextDisabled, selected && styles.dayTextSelected]}>
                  {date.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.inkFaint },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  dayCircle: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  dayTextDisabled: { color: colors.inkFaint, opacity: 0.4 },
  dayTextSelected: { color: '#fff', fontWeight: '800' },
});
