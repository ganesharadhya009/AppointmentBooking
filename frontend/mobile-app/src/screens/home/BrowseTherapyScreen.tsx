import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { therapies } from '../../data/mockData';
import { HomeStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'BrowseTherapy'>;

export const BrowseTherapyScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <View style={styles.wrap}>
      <ScreenHeader title="Therapy Services" subtitle="Browse and book a session" />
      <FlatList
        data={therapies}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('TherapistList', { therapyId: item.id })}>
            <Card style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon as any} size={26} color={colors.primary} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
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
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 0 },
  iconWrap: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  desc: { fontSize: 12, color: colors.inkSoft, marginTop: 3, lineHeight: 17 },
});
