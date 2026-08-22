import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 56, showWordmark = true, wordmarkColor = colors.ink }) => {
  return (
    <View style={styles.wrap}>
      <Image
        source={require('../../assets/logo-mark.png')}
        style={{ width: size, height: size, marginBottom: 8 }}
        resizeMode="contain"
      />
      {showWordmark && (
        <Text style={[styles.wordmark, { color: wordmarkColor, fontSize: size * 0.4 }]}>BimBa</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  wordmark: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
