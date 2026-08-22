import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppDataProvider } from './src/context/AppDataContext';
import { AuthProvider } from './src/context/AuthContext';
import { CatalogProvider } from './src/context/CatalogContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CatalogProvider>
          <AppDataProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </AppDataProvider>
        </CatalogProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
