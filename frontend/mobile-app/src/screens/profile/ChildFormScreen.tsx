import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppData } from '../../context/AppDataContext';
import { colors, radius, spacing } from '../../theme/theme';

const GENDERS = ['Male', 'Female'] as const;
const RELATIONS = ['Son', 'Daughter', 'Self', 'Other'];

export const ChildFormScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const childId: string | undefined = route.params?.childId;
  const { children_, addChild, updateChild } = useAppData();
  const existing = children_.find((c) => c.id === childId);

  const [name, setName] = useState(existing?.name ?? '');
  const [dob, setDob] = useState(existing?.dob ?? '');
  const [gender, setGender] = useState<(typeof GENDERS)[number]>(existing?.gender ?? 'Male');
  const [relation, setRelation] = useState(existing?.guardianRelation ?? 'Son');

  const canSave = name.trim().length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(dob);

  const onSave = () => {
    const payload = { name: name.trim(), dob, gender, guardianRelation: relation };
    if (existing) updateChild(existing.id, payload);
    else addChild(payload);
    navigation.goBack();
  };

  return (
    <View style={styles.wrap}>
      <ScreenHeader title={existing ? 'Edit Family Member' : 'Add Family Member'} />
      <ScrollView contentContainerStyle={styles.content}>
        <FormField label="Full Name" icon="person" placeholder="Child's full name" value={name} onChangeText={setName} />
        <FormField label="Date of Birth" icon="calendar" placeholder="YYYY-MM-DD" value={dob} onChangeText={setDob} />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.optionRow}>
          {GENDERS.map((g) => (
            <TouchableOpacity key={g} style={[styles.chip, gender === g && styles.chipActive]} onPress={() => setGender(g)}>
              <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Relationship</Text>
        <View style={styles.optionRow}>
          {RELATIONS.map((r) => (
            <TouchableOpacity key={r} style={[styles.chip, relation === r && styles.chipActive]} onPress={() => setRelation(r)}>
              <Text style={[styles.chipText, relation === r && styles.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <PrimaryButton label={existing ? 'Save Changes' : 'Add Family Member'} onPress={onSave} disabled={!canSave} style={styles.submit} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, marginBottom: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: '#fff' },
  submit: { marginTop: 8 },
});
