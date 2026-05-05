import {
  registerExpoPushToken,
  updateNotificationStatus,
  useNotificationStatus
} from '@/api/notification';
import { addKeyword, KeywordResponse, removeKeyword, useKeywords } from '@/api/keyword';
import BackHeader from '@/common/components/BackHeader';
import PageLayout from '@/common/components/PageLayout';
import { useTheme } from '@/common/contexts/ThemeContext';
import FontText from '@/common/text/FontText';
import colors from '@/constants/colors';
import { useDeviceId } from '@/utils/device';
import { registerForPushNotificationsAsync } from '@/utils/pushNotifications';
import { getData, storeData } from '@/utils/storage';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';

const MAX_KEYWORDS = 10;
const MIN_KEYWORD_LENGTH = 2;
const MAX_KEYWORD_LENGTH = 10;

const KeywordPage = () => {
  const { theme } = useTheme();
  const { deviceId } = useDeviceId();
  const { data: statusData, mutate: mutateStatus } = useNotificationStatus();
  const turnOn = statusData?.turnOn ?? false;
  const { data: keywords = [], mutate: mutateKeywords, isLoading } = useKeywords();
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(true);

  const syncPushState = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    const granted = status === 'granted';
    setPermissionGranted(granted);
    if (!granted || !turnOn || !deviceId) return;

    const existingToken = await getData('expoPushToken');
    if (existingToken) return;

    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await registerExpoPushToken(deviceId, token);
        await storeData('expoPushToken', token);
      }
    } catch {
      // 무시 - 다음 활성화 때 재시도
    }
  };

  useEffect(() => {
    syncPushState();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncPushState();
    });
    return () => subscription.remove();
  }, [turnOn, deviceId]);

  const openSystemSettings = () => {
    Linking.openSettings();
  };

  const handleToggle = async (value: boolean) => {
    if (!deviceId || toggling) return;
    setToggling(true);
    try {
      if (value) {
        let token: string | undefined;
        try {
          token = await registerForPushNotificationsAsync();
        } catch {
          token = undefined;
        }
        if (token) {
          await registerExpoPushToken(deviceId, token);
          await storeData('expoPushToken', token);
        }
      }
      await mutateStatus({ turnOn: value }, { revalidate: false });
      await updateNotificationStatus(deviceId, value);
      await mutateStatus();
      await syncPushState();
    } catch {
      Alert.alert('오류', '알림 설정 변경에 실패했어요.');
      await mutateStatus();
    } finally {
      setToggling(false);
    }
  };

  const handleAdd = async () => {
    const normalized = input.trim().toLowerCase();
    if (!normalized) return;
    if (!deviceId) return;
    if (keywords.length >= MAX_KEYWORDS) {
      Alert.alert('키워드 등록 불가', `키워드는 최대 ${MAX_KEYWORDS}개까지 등록할 수 있어요.`);
      return;
    }
    if (normalized.length < MIN_KEYWORD_LENGTH || normalized.length > MAX_KEYWORD_LENGTH) {
      Alert.alert('키워드 등록 불가', `키워드는 ${MIN_KEYWORD_LENGTH}자 이상 ${MAX_KEYWORD_LENGTH}자 이하여야 해요.`);
      return;
    }
    if (keywords.some((k) => k.keyword === normalized)) {
      Alert.alert('이미 등록된 키워드예요.');
      return;
    }

    setSubmitting(true);
    try {
      await addKeyword(deviceId, normalized);
      setInput('');
      Keyboard.dismiss();
      await mutateKeywords();
    } catch (e: any) {
      const message = e?.response?.data?.message ?? '키워드 추가에 실패했어요.';
      Alert.alert('오류', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (keyword: KeywordResponse) => {
    if (!deviceId) return;
    try {
      await removeKeyword(deviceId, keyword.keyword);
      await mutateKeywords();
    } catch (e: any) {
      const message = e?.response?.data?.message ?? '키워드 삭제에 실패했어요.';
      Alert.alert('오류', message);
    }
  };

  return (
    <PageLayout edges={['top']}>
      <BackHeader title="키워드 알림" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <View style={[styles.toggleRow, { borderBottomColor: colors[theme].gray300 }]}>
            <View style={{ flex: 1 }}>
              <FontText fontWeight="500" style={[styles.toggleLabel, { color: colors[theme].contrast }]}>
                키워드 알림 받기
              </FontText>
              <FontText style={[styles.toggleHelper, { color: colors[theme].gray100 }]}>
                새 공지 제목에 키워드가 포함되면 푸시로 알려드려요
              </FontText>
            </View>
            <Switch
              value={turnOn}
              onValueChange={handleToggle}
              disabled={toggling}
              trackColor={{ true: colors[theme].blue, false: colors[theme].gray200 }}
            />
          </View>

          {turnOn && !permissionGranted && (
            <Pressable
              onPress={openSystemSettings}
              style={[styles.permissionBanner, {
                backgroundColor: colors[theme].background,
                borderColor: colors[theme].gray300
              }]}
            >
              <FontText style={[styles.permissionText, { color: colors[theme].contrast }]}>
                푸시 알림 권한이 꺼져있어요. 알림 내역은 쌓이지만 푸시는 오지 않아요.
              </FontText>
              <FontText fontWeight="600" style={[styles.permissionAction, { color: colors[theme].blue }]}>
                설정 열기 →
              </FontText>
            </Pressable>
          )}

          <View style={[styles.section, { opacity: turnOn ? 1 : 0.4 }]} pointerEvents={turnOn ? 'auto' : 'none'}>
            <FontText fontWeight="600" style={[styles.sectionTitle, { color: colors[theme].contrast }]}>
              키워드 ({keywords.length}/{MAX_KEYWORDS})
            </FontText>
            <FontText style={[styles.helper, { color: colors[theme].gray100 }]}>
              관심 있는 단어를 등록하세요. 최대 {MAX_KEYWORDS}개, 각 {MIN_KEYWORD_LENGTH}~{MAX_KEYWORD_LENGTH}자까지 등록할 수 있어요.
            </FontText>

            <View style={styles.inputRow}>
              <View style={[styles.inputBox, {
                backgroundColor: colors[theme].background,
                borderColor: colors[theme].gray300
              }]}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="예: 장학금"
                  placeholderTextColor={colors[theme].gray200}
                  style={[styles.input, { color: colors[theme].contrast }]}
                  maxLength={MAX_KEYWORD_LENGTH}
                  returnKeyType="done"
                  onSubmitEditing={handleAdd}
                  editable={turnOn}
                />
              </View>
              <Pressable
                style={[styles.addButton, {
                  backgroundColor: input.trim() && !submitting ? colors[theme].blue : colors[theme].gray200
                }]}
                disabled={!input.trim() || submitting}
                onPress={handleAdd}
              >
                <FontText fontWeight="600" style={styles.addButtonText}>추가</FontText>
              </Pressable>
            </View>

            {!isLoading && keywords.length === 0 ? (
              <FontText style={[styles.empty, { color: colors[theme].gray200 }]}>
                아직 등록한 키워드가 없어요.
              </FontText>
            ) : (
              <View style={styles.chipContainer}>
                {keywords.map((item) => (
                  <Pressable
                    key={item.keyword}
                    style={[styles.chip, {
                      backgroundColor: colors[theme].background,
                      borderColor: colors[theme].gray300
                    }]}
                    onPress={() => handleRemove(item)}
                  >
                    <FontText style={[styles.chipText, { color: colors[theme].contrast }]}>
                      {item.keyword}
                    </FontText>
                    <FontText style={[styles.chipRemove, { color: colors[theme].gray100 }]}>✕</FontText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </PageLayout>
  );
};

export default KeywordPage;

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 20
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1
  },
  toggleLabel: {
    fontSize: 17,
    marginBottom: 4
  },
  toggleHelper: {
    fontSize: 13,
    lineHeight: 18
  },
  permissionBanner: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  permissionText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6
  },
  permissionAction: {
    fontSize: 13
  },
  section: {
    paddingTop: 20
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 8
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 20
  },
  inputBox: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  input: {
    fontSize: 16,
    paddingVertical: 10
  },
  addButton: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14
  },
  empty: {
    fontSize: 14,
    marginTop: 8
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6
  },
  chipText: {
    fontSize: 14
  },
  chipRemove: {
    fontSize: 12
  }
});
