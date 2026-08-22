import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { CatalogErrorScreen } from '../screens/auth/CatalogErrorScreen';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';

export const RootNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { loading: catalogLoading, error: catalogError, branches } = useCatalog();

  if (isLoading || catalogLoading) {
    return <SplashScreen />;
  }

  // The catalog (branches/therapy catalog/therapists/consultants) is what admin-console-configured
  // data flows through -- screens below this point assume it's loaded and non-empty (e.g. Home
  // picks branches[0] as the default branch), so surface a retry screen instead of crashing.
  if (catalogError || branches.length === 0) {
    return <CatalogErrorScreen />;
  }

  return (
    <NavigationContainer>
      {user ? <MainTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};
