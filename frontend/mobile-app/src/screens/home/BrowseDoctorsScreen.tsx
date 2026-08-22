import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useCatalog } from '../../context/CatalogContext';
import { HomeStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'BrowseDoctors'>;

export const BrowseDoctorsScreen: React.FC<Props> = ({ navigation }) => {
  const { consultingDoctors } = useCatalog();
  return (
    <View style={styles.wrap}>
      <ScreenHeader title="Consulting Doctors" subtitle="Book an in-clinic appointment" />
      <FlatList
        data={consultingDoctors}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('DoctorProfile', { doctorId: item.id })}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Avatar name={item.name} size={56} />
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.specialty}>{item.specialty}</Text>
                  <Text style={styles.qual} numberOfLines={1}>{item.qualifications}</Text>
                </View>
              </View>
              <View style={styles.footerRow}>
                <View style={styles.metaGroup}>
                  <Ionicons name="star" size={13} color={colors.warn} />
                  <Text style={styles.metaText}>{item.rating} &middot; {item.experienceYears} yrs</Text>
                </View>
                {item.verified && <StatusChip label="Verified Clinic" tone="success" />}
                <Text style={styles.fee}>&#8377;{item.fee}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.xl, gap: 12 },
  card: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  specialty: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 },
  qual: { fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  metaGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  fee: { fontSize: 13, fontWeight: '800', color: colors.ink },
});
