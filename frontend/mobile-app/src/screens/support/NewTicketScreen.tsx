import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppData } from '../../context/AppDataContext';
import { colors, radius, spacing } from '../../theme/theme';

const CATEGORIES = ['Payments', 'Booking', 'Therapist', 'App Issue', 'Other'];

export const NewTicketScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { addTicket } = useAppData();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [message, setMessage] = useState('');

  const canSubmit = title.trim().length > 3 && message.trim().length > 5;

  const onSubmit = () => {
    addTicket(title.trim(), category, message.trim());
    navigation.goBack();
  };

  return (
    <View style={styles.wrap}>
      <ScreenHeader title="Raise a Ticket" />
      <ScrollView contentContainerStyle={styles.content}>
        <FormField label="Subject" placeholder="Briefly describe the issue" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Message</Text>
        <View style={styles.messageBox}>
          <FormField
            label=""
            placeholder="Describe your issue in detail..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            style={{ height: 120, textAlignVertical: 'top' }}
          />
        </View>

        <PrimaryButton label="Submit Ticket" onPress={onSubmit} disabled={!canSubmit} style={styles.submit} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, marginBottom: 8 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: '#fff' },
  messageBox: { marginBottom: 4 },
  submit: { marginTop: 12 },
});
