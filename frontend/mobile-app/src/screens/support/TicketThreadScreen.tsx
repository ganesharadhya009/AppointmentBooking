import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAppData } from '../../context/AppDataContext';
import { colors, radius, spacing } from '../../theme/theme';
import { TicketStatus } from '../../types';

const TONE: Record<TicketStatus, 'info' | 'warn' | 'success'> = {
  Open: 'info',
  'Waiting for Admin': 'warn',
  Resolved: 'success',
};

export const TicketThreadScreen: React.FC = () => {
  const route = useRoute<any>();
  const { ticketId } = route.params as { ticketId: string };
  const { tickets, replyToTicket } = useAppData();
  const ticket = tickets.find((t) => t.id === ticketId);
  const [draft, setDraft] = useState('');

  if (!ticket) return null;

  const onSend = () => {
    if (!draft.trim()) return;
    replyToTicket(ticket.id, {
      id: `m${Date.now()}`,
      sender: 'user',
      text: draft.trim(),
      timestamp: new Date().toLocaleString(),
    });
    setDraft('');
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={ticket.ticketNo} subtitle={ticket.title} />
      <View style={styles.statusRow}>
        <StatusChip label={ticket.status} tone={TONE[ticket.status]} />
        <Text style={styles.category}>{ticket.category}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.messages}>
        {ticket.messages.map((m) => (
          <View key={m.id} style={[styles.bubbleRow, m.sender === 'user' && styles.bubbleRowUser]}>
            <View style={[styles.bubble, m.sender === 'user' ? styles.bubbleUser : styles.bubbleAdmin]}>
              <Text style={[styles.bubbleText, m.sender === 'user' && { color: '#fff' }]}>{m.text}</Text>
            </View>
            <Text style={styles.timestamp}>{m.timestamp}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.inkFaint}
          value={draft}
          onChangeText={setDraft}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={onSend}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.xl, paddingVertical: 12 },
  category: { fontSize: 12, color: colors.inkFaint, fontWeight: '600' },
  messages: { padding: spacing.xl, gap: 14 },
  bubbleRow: { maxWidth: '82%', alignSelf: 'flex-start' },
  bubbleRowUser: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: radius.lg, padding: 12 },
  bubbleAdmin: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  bubbleText: { fontSize: 13, color: colors.ink, lineHeight: 19 },
  timestamp: { fontSize: 10, color: colors.inkFaint, marginTop: 4 },
  composer: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, fontSize: 14, color: colors.ink,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
