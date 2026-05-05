import CampusSetting from '@/app/more/components/CampusSetting';
import NotificationSetting from '@/app/more/components/NotificationSetting';
import ThemeSetting from '@/app/more/components/ThemeSetting';
import PageLayout from '@/common/components/PageLayout';
import TabHeader from '@/common/components/TabHeader';
import { useTheme } from '@/common/contexts/ThemeContext';
import FontText from '@/common/text/FontText';
import colors from '@/constants/colors';
import * as Application from 'expo-application';
import { StyleSheet, View } from 'react-native';

const More = () => {
  const { theme } = useTheme();

  return (
    <PageLayout edges={['top']}>
      <TabHeader>
        <FontText fontWeight="700" style={styles.title}>더보기</FontText>
      </TabHeader>
      <View style={styles.settingContainer}>
        <FontText fontWeight="600"
                  style={[styles.settingTitle, { color: colors[theme].gray100 }]}>캠퍼스</FontText>
        <CampusSetting />
        <FontText fontWeight="600" style={[styles.settingTitle, { color: colors[theme].gray100 }]}>화면 테마</FontText>
        <ThemeSetting />
        <FontText fontWeight="600" style={[styles.settingTitle, { color: colors[theme].gray100 }]}>알림</FontText>
        <NotificationSetting />
        <FontText style={[styles.version, { color: colors[theme].gray200 }]}>
          버전 {Application.nativeApplicationVersion} ({Application.nativeBuildVersion})
        </FontText>
      </View>
    </PageLayout>
  );
};

export default More;

const styles = StyleSheet.create({
  title: {
    fontSize: 22
  },
  settingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10
  },
  settingTitle: {
    fontSize: 18
  },
  version: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10
  }
});
