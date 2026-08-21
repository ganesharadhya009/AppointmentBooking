import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Logo } from '../../components/Logo';
import { colors } from '../../theme/theme';

export const SplashScreen: React.FC = () => (
  <View style={styles.wrap}>
    <Logo size={96} />
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
