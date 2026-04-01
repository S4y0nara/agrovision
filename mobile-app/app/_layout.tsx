import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { I18nextProvider } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from '@/constants/i18n';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CartProvider } from '@/hooks/CartContext';
import { AppFlowProvider } from '@/hooks/AppFlowContext';
import FarmProfileScreen from '@/components/FarmProfileScreen';
import GoalsScreen from '@/components/GoalsScreen';
import OnboardingScreen from '@/components/OnboardingScreen';
import SignUpScreen from '@/components/SignUpScreen';
import SplashScreen from '@/components/SplashScreen';

ExpoSplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

type AppStage = 'loading' | 'splash' | 'onboarding' | 'signup' | 'farm' | 'goals' | 'app';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [stage, setStage] = useState<AppStage>('loading');

  useEffect(() => {
    async function prepare() {
      try {
        await ExpoSplashScreen.hideAsync();
        const userName = await AsyncStorage.getItem('user_name');
        setStage(userName ? 'app' : 'splash');
      } catch (e) {
        console.warn(e);
        setStage('splash');
      }
    }

    prepare();
  }, []);

  if (stage === 'loading') return null;

  const renderCurrentStage = () => {
    switch (stage) {
      case 'splash':
        return <SplashScreen onFinish={() => setStage('onboarding')} />;
      case 'onboarding':
        return (
          <OnboardingScreen
            onGetStarted={() => setStage('signup')}
            onSignIn={() => setStage('signup')}
          />
        );
      case 'signup':
        return (
          <SignUpScreen
            onNext={() => setStage('farm')}
            onBack={() => setStage('onboarding')}
          />
        );
      case 'farm':
        return (
          <FarmProfileScreen
            onNext={() => setStage('goals')}
            onBack={() => setStage('signup')}
          />
        );
      case 'goals':
        return (
          <GoalsScreen
            onFinish={() => setStage('app')}
            onBack={() => setStage('farm')}
          />
        );
      case 'app':
      default:
        return (
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="analytics" options={{ headerShown: false }} />
            <Stack.Screen name="language" options={{ headerShown: false }} />
            <Stack.Screen name="support" options={{ headerShown: false }} />
            <Stack.Screen name="farm-details" options={{ headerShown: false }} />
            <Stack.Screen name="stats" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ presentation: 'modal', title: 'Notifications' }} />
            <Stack.Screen name="diagnosis" options={{ headerShown: false }} />
            <Stack.Screen name="weather" options={{ headerShown: false }} />
            <Stack.Screen name="cart" options={{ title: 'Cart' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        );
    }
  };

  return (
    <I18nextProvider i18n={i18n}>
      <CartProvider>
        <AppFlowProvider value={{ resetToSplash: () => setStage('splash') }}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            {renderCurrentStage()}
            <StatusBar style="auto" />
          </ThemeProvider>
        </AppFlowProvider>
      </CartProvider>
    </I18nextProvider>
  );
}
