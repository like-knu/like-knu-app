import CampusContextProvider from '@/common/contexts/CampusContext';
import FavoriteContextProvider from '@/common/contexts/FavoriteContext';
import ThemeContextProvider, { useTheme } from '@/common/contexts/ThemeContext';
import colors from '@/constants/colors';
import Fonts from '@/constants/fonts';
import useInitializeDevice from '@/utils/device';
import http from '@/utils/http';
import '@/utils/pushNotifications';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import analytics from '@react-native-firebase/analytics';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import * as Updates from 'expo-updates';
import React, { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import mobileAds from 'react-native-google-mobile-ads';
import { RootSiblingParent } from 'react-native-root-siblings';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateStatus } from 'react-native/Libraries/AppState/AppState';
import { SWRConfig } from 'swr';

SplashScreen.preventAutoHideAsync();

const AppLayout = () => {
  const [fontsLoaded, fontError] = useFonts(Fonts);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await checkForUpdates();

      setTimeout(async () => {
        await SplashScreen.hideAsync();
      }, 800);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const handleInitFocus = (callback: VoidFunction) => {
    let currentState = AppState.currentState;

    const onAppStateChange = (nextState: AppStateStatus) => {
      if (currentState.match(/inactive|background/) && nextState === 'active') {
        callback();
      }
      currentState = nextState;
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      subscription.remove();
    };
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider onLayout={onLayoutRootView}>
        <ActionSheetProvider>
          <SWRConfig value={{
            provider: () => new Map(),
            isVisible: () => true,
            initFocus: (callback) => handleInitFocus(callback)
          }}>
            <RootSiblingParent>
              <ThemeContextProvider>
                <CampusContextProvider>
                  <FavoriteContextProvider>
                    <Content />
                  </FavoriteContextProvider>
                </CampusContextProvider>
              </ThemeContextProvider>
            </RootSiblingParent>
          </SWRConfig>
        </ActionSheetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default AppLayout;

export async function checkForUpdates() {
  if (__DEV__) {
    return;
  }

  const update = await Updates.checkForUpdateAsync();

  if (update.isAvailable) {
    Updates.fetchUpdateAsync()
      .then(() => {
        Updates.reloadAsync();
      });
  }
}

const Content = () => {
  const { theme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  useInitializeDevice();

  useEffect(() => {
    http.get('/actuator/health')
      .then(value => {
        if (value.status === 200) {
          return;
        }

        router.replace('/maintenance');
      })
      .catch(() => {
        router.replace('/maintenance');
      });
  }, []);

  useEffect(() => {
    requestTrackingPermissionsAsync()
      .then(() => {
      });

    mobileAds()
      .initialize()
      .then(() => {
      });

    analytics().logScreenView({
      screen_name: pathname,
      screen_class: pathname
    }).then(() => {
    });
  }, [pathname]);

  useEffect(() => {
    const HANDLED_KEY = 'handledNotificationIds';

    const handleResponse = async (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      // Android cold start에서 id=null인 phantom response가 매번 발화하는 이슈 차단
      if (!id) return;

      const raw = await AsyncStorage.getItem(HANDLED_KEY);
      const handled: string[] = raw ? JSON.parse(raw) : [];
      if (handled.includes(id)) return;

      await AsyncStorage.setItem(
        HANDLED_KEY,
        JSON.stringify([...handled, id].slice(-50))
      );

      const data = response.notification.request.content.data as {
        url?: string;
        notificationId?: string | number;
      } | undefined;
      router.push({
        pathname: '/notification',
        params: {
          autoOpenUrl: data?.url ?? '',
          autoOpenNotificationId: data?.notificationId != null ? String(data.notificationId) : ''
        }
      });
    };

    const response = Notifications.getLastNotificationResponse();
    if (response) {
      handleResponse(response);
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, []);

  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors[theme][pathname === '/' ? 'background' : 'container'] }
    }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="restaurant-map/index" options={{ presentation: 'containedModal', headerShown: false }} />
    </Stack>
  );
};
