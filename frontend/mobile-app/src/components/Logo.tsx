import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme/theme';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 56, showWordmark = true, wordmarkColor = colors.ink }) => {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#F7B733', '#F0655A', '#C1348C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.badge, { width: size, height: size, borderRadius: size * 0.32 }]}
      >
        <MaterialCommunityIcons name="butterfly" size={size * 0.56} color="#fff" />
      </LinearGradient>
      {showWordmark && (
        <Text style={[styles.wordmark, { color: wordmarkColor, fontSize: size * 0.4 }]}>BimBa</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  wordmark: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
