import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NotificationItem,
  useNotifications
} from '@/api/notification';
import BackHeader from '@/common/components/BackHeader';
import PageLayout from '@/common/components/PageLayout';
import { useTheme } from '@/common/contexts/ThemeContext';
import FontText from '@/common/text/FontText';
import colors from '@/constants/colors';
import { useDeviceId } from '@/utils/device';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

const NotificationPage = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { deviceId } = useDeviceId();
  const { data, isLoading, mutate } = useNotifications();
  const { autoOpenUrl, autoOpenNotificationId } = useLocalSearchParams<{
    autoOpenUrl?: string;
    autoOpenNotificationId?: string;
  }>();
  const handledAutoOpenRef = useRef(false);

  const notifications = useMemo(() => data ?? [], [data]);
  const hasUnread = useMemo(() => notifications.some((n) => !n.read), [notifications]);

  useEffect(() => {
    if (pathname === '/notification') {
      mutate();
    }
  }, [pathname]);

  useEffect(() => {
    if (handledAutoOpenRef.current) return;
    if (!autoOpenUrl) return;
    if (autoOpenNotificationId && !deviceId) return;
    handledAutoOpenRef.current = true;

    if (deviceId && autoOpenNotificationId) {
      markNotificationAsRead(deviceId, autoOpenNotificationId)
        .then(() => mutate())
        .catch(() => {});
    }

    router.push({
      pathname: '/announcement/details',
      params: {
        url: autoOpenUrl,
        id: '',
        isBookmark: 'false',
        isAd: 'false'
      }
    });
  }, [autoOpenUrl, autoOpenNotificationId, deviceId]);

  const onPressItem = async (item: NotificationItem) => {
    if (deviceId && !item.read) {
      try {
        await markNotificationAsRead(deviceId, item.notificationId);
        await mutate();
      } catch {
        // 무시 - 라우팅은 진행
      }
    }
    if (item.notificationUrl) {
      router.push({
        pathname: '/announcement/details',
        params: {
          url: item.notificationUrl,
          id: '',
          isBookmark: 'false',
          isAd: 'false'
        }
      });
    }
  };

  const onPressMarkAll = () => {
    if (!deviceId || !hasUnread) return;
    Alert.alert(
      '전체 읽음 처리',
      '받은 알림을 모두 읽음으로 표시할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            try {
              await markAllNotificationsAsRead(deviceId);
              await mutate();
            } catch {
              // 무시
            }
          }
        }
      ]
    );
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, '0');
    const dd = `${date.getDate()}`.padStart(2, '0');
    const hh = `${date.getHours()}`.padStart(2, '0');
    const mi = `${date.getMinutes()}`.padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
  };

  const markAllButton = (
    <Pressable onPress={onPressMarkAll} disabled={!hasUnread} style={{ paddingHorizontal: 8 }}>
      <FontText
        fontWeight="500"
        style={{ fontSize: 14, color: hasUnread ? colors[theme].blue : colors[theme].gray200 }}
      >
        전체 읽음
      </FontText>
    </Pressable>
  );

  return (
    <PageLayout edges={['top']}>
      <BackHeader title="알림" button={markAllButton} />
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.notificationId}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPressItem(item)}
            style={[styles.row, {
              borderBottomColor: colors[theme].gray300,
              backgroundColor: item.read ? 'transparent' : colors[theme].background
            }]}
          >
            <View style={styles.rowInner}>
              <View style={[styles.unreadDot, { backgroundColor: item.read ? 'transparent' : colors[theme].blue }]} />
              <View style={{ flex: 1 }}>
                <FontText fontWeight="600" style={[styles.title, { color: colors[theme].contrast }]} numberOfLines={1}>
                  {item.notificationTitle}
                </FontText>
                <FontText style={[styles.body, { color: colors[theme].gray100 }]} numberOfLines={2}>
                  {item.notificationBody}
                </FontText>
                <FontText style={[styles.date, { color: colors[theme].gray200 }]}>
                  {formatDate(item.notificationDate)}
                </FontText>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={() => (
          !isLoading ? (
            <View style={styles.empty}>
              <FontText style={{ color: colors[theme].gray200 }}>받은 알림이 없어요.</FontText>
            </View>
          ) : null
        )}
        refreshControl={
          <RefreshControl
            tintColor={colors[theme].gray100}
            refreshing={isLoading}
            onRefresh={() => mutate()}
          />
        }
      />
    </PageLayout>
  );
};

export default NotificationPage;

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: 1
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6
  },
  title: {
    fontSize: 15,
    marginBottom: 4
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6
  },
  date: {
    fontSize: 12
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 80
  }
});
