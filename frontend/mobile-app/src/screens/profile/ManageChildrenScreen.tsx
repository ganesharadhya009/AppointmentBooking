import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppData } from '../../context/AppDataContext';
import { colors, radius, spacing } from '../../theme/theme';

function calcAge(dob: string) {
  const diff = Date.now() - new Date(dob).getTime();
  const years = diff / (1000 * 60 * 60 * 24 * 365.25);
  return years < 1 ? `${Math.round(years * 12)} mo` : `${Math.floor(years)} yrs`;
}

export const ManageChildrenScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { children_ } = useAppData();

  return (
    <View style={styles.wrap}>
      <ScreenHeader
        title="Family Members"
        rightIcon="person-add"
        onRightPress={() => navigation.navigate('ChildForm')}
      />
      <FlatList
        data={children_}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No children added" subtitle="Add a family member to start booking appointments." />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('ChildForm', { childId: item.id })}>
            <Card style={styles.card}>
              <Avatar name={item.name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.guardianRelation} &middot; {calcAge(item.dob)} &middot; {item.gender}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
            </Card>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('ChildForm')}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.xl, gap: 12, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  fab: {
    position: 'absolute', right: spacing.xl, bottom: spacing.xl, width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center',
  },
});
