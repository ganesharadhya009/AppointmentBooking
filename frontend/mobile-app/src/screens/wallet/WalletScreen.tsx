import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../components/EmptyState';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAppData } from '../../context/AppDataContext';
import { colors, gradientLocations, gradients, radius, shadow, spacing } from '../../theme/theme';

export const WalletScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { wallet, walletBalance, addWalletTopUp } = useAppData();
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');

  const closeModal = () => {
    setModalVisible(false);
    setAmount('');
  };

  const onAddMoney = () => {
    const value = Number(amount);
    if (value > 0) {
      addWalletTopUp(value);
      closeModal();
    }
  };

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={gradients.primary}
        locations={gradientLocations.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>&#8377;{walletBalance.toFixed(2)}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={16} color={colors.action} />
            <Text style={styles.addBtnText}>Add Money</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <Text style={styles.sectionTitle}>Transaction History</Text>
      <FlatList
        data={[...wallet].reverse()}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="wallet-outline" title="No transactions yet" />}
        renderItem={({ item }) => (
          <View style={styles.txnRow}>
            <View style={[styles.txnIcon, { backgroundColor: item.direction === 'credit' ? colors.successSoft : colors.dangerSoft }]}>
              <Ionicons
                name={item.direction === 'credit' ? 'arrow-down' : 'arrow-up'}
                size={16}
                color={item.direction === 'credit' ? colors.success : colors.danger}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txnDesc}>{item.description}</Text>
              <Text style={styles.txnDate}>{item.date}</Text>
            </View>
            <Text style={[styles.txnAmount, { color: item.direction === 'credit' ? colors.success : colors.danger }]}>
              {item.direction === 'credit' ? '+' : '-'}&#8377;{item.amount.toFixed(2)}
            </Text>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <Pressable style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Money to Wallet</Text>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.inkFaint} />
              </TouchableOpacity>
            </View>
            <FormField
              label="Amount"
              icon="cash"
              keyboardType="numeric"
              placeholder="Enter amount"
              value={amount}
              onChangeText={setAmount}
              returnKeyType="done"
              autoFocus
            />
            <View style={styles.modalActions}>
              <PrimaryButton label="Cancel" variant="outline" onPress={closeModal} style={{ flex: 1 }} />
              <PrimaryButton label="Add" onPress={onAddMoney} disabled={!amount || Number(amount) <= 0} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 16 },
  balanceCard: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, padding: spacing.lg },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  balanceValue: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 4, marginBottom: 12 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
  },
  addBtnText: { color: colors.action, fontWeight: '700', fontSize: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, paddingHorizontal: spacing.xl, marginTop: 20, marginBottom: 8 },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 24, gap: 4, flexGrow: 1 },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  txnIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txnDesc: { fontSize: 13, fontWeight: '600', color: colors.ink },
  txnDate: { fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  txnAmount: { fontSize: 14, fontWeight: '800' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, ...shadow.raised },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
