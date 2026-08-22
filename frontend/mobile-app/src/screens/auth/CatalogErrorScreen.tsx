import React from 'react';
import { StyleSheet, View } from 'react-native';
import { EmptyState } from '../../components/EmptyState';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useCatalog } from '../../context/CatalogContext';
import { colors, spacing } from '../../theme/theme';

export const CatalogErrorScreen: React.FC = () => {
  const { error, reload } = useCatalog();
  return (
    <View style={styles.wrap}>
      <EmptyState
        icon="cloud-offline"
        title="Couldn't load the app catalog"
        subtitle={error ?? "Couldn't reach directory-api. Make sure it's running."}
      />
      <PrimaryButton label="Retry" onPress={reload} style={styles.retry} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  retry: { width: 160 },
});
