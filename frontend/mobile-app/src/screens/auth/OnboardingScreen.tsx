import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, View, ViewToken } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'people' as const,
    title: 'Accessible Excellence',
    subtitle: "Empowering every child's potential with a connected care team behind them.",
  },
  {
    icon: 'calendar' as const,
    title: 'Book in a Few Taps',
    subtitle: 'Find therapy sessions and doctor consultations, then pick a slot that works for you.',
  },
  {
    icon: 'heart' as const,
    title: 'Your Family, Organised',
    subtitle: 'Track appointments, payments and progress for every child in one place.',
  },
];

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { completeOnboarding } = useAuth();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const finish = () => {
    completeOnboarding();
    navigation.replace('Login');
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={64} color={colors.primary} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.footer}>
        <PrimaryButton label={isLast ? 'Get Started' : 'Next'} onPress={isLast ? finish : () => {
          listRef.current?.scrollToIndex({ index: index + 1 });
        }} />
        {!isLast && <PrimaryButton label="Skip" variant="ghost" onPress={finish} style={styles.skip} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceSoft },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingTop: 60 },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', lineHeight: 21 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: 4 },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  skip: { marginTop: 14, alignSelf: 'center' },
});
