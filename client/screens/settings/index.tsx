import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { createStyles } from './styles';
import {
  getUserSettings,
  saveUserSettings,
  UserSettings,
  TITLE_OPTIONS,
} from '@/utils/settingsStorage';

// 可用的声音选项
const VOICE_OPTIONS = [
  { label: '温柔女声', value: 'zh_female_xiaohe_uranus_bigtts' },
  { label: '活力女声', value: 'zh_female_vv_uranus_bigtts' },
  { label: '阳光男声', value: 'zh_male_m191_uranus_bigtts' },
  { label: '磁性男声', value: 'zh_male_taocheng_uranus_bigtts' },
  { label: '儿童故事', value: 'zh_female_xueayi_saturn_bigtts' },
  { label: '大气男声', value: 'zh_male_dayi_saturn_bigtts' },
  { label: '甜美女声', value: 'zh_female_mizai_saturn_bigtts' },
  { label: '元气女声', value: 'zh_female_jitangnv_saturn_bigtts' },
  { label: '邻家女友', value: 'zh_female_meilinvyou_saturn_bigtts' },
  { label: '俏皮公主', value: 'saturn_zh_female_tiaopigongzhu_tob' },
  { label: '爽朗少年', value: 'saturn_zh_male_shuanglangshaonian_tob' },
];

export default function SettingsScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();

  const [settings, setSettings] = useState<UserSettings>({
    title: '老板',
    voiceId: 'zh_female_xiaohe_uranus_bigtts',
    speechRate: 1.0,
    pitch: 1.0,
  });
  const [customTitle, setCustomTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 加载设置
  const loadSettings = useCallback(async () => {
    try {
      const userSettings = await getUserSettings();
      setSettings(userSettings);
      // 检查是否是自定义称呼
      const isPresetTitle = TITLE_OPTIONS.some(opt => opt.value === userSettings.title);
      if (!isPresetTitle) {
        setCustomTitle(userSettings.title);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  // 选择称呼
  const handleSelectTitle = useCallback(async (title: string) => {
    try {
      await saveUserSettings({ title });
      setSettings(prev => ({ ...prev, title }));
      setCustomTitle('');
    } catch (err) {
      console.error('Failed to save title:', err);
    }
  }, []);

  // 保存自定义称呼
  const handleSaveCustomTitle = useCallback(async () => {
    if (!customTitle.trim()) {
      Alert.alert('提示', '请输入自定义称呼');
      return;
    }
    try {
      await saveUserSettings({ title: customTitle.trim() });
      setSettings(prev => ({ ...prev, title: customTitle.trim() }));
      Alert.alert('成功', '自定义称呼已保存');
    } catch (err) {
      console.error('Failed to save custom title:', err);
      Alert.alert('错误', '保存失败，请重试');
    }
  }, [customTitle]);

  // 选择声音
  const handleSelectVoice = useCallback(async (voiceId: string) => {
    try {
      await saveUserSettings({ voiceId });
      setSettings(prev => ({ ...prev, voiceId }));
    } catch (err) {
      console.error('Failed to save voice:', err);
    }
  }, []);

  // 调整语速
  const handleSpeechRateChange = useCallback(async (rate: number) => {
    try {
      await saveUserSettings({ speechRate: rate });
      setSettings(prev => ({ ...prev, speechRate: rate }));
    } catch (err) {
      console.error('Failed to save speech rate:', err);
    }
  }, []);

  // 重置设置
  const handleReset = useCallback(() => {
    Alert.alert(
      '确认重置',
      '确定要恢复默认设置吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            const defaultSettings = {
              title: '老板',
              voiceId: 'zh_female_xiaohe_uranus_bigtts',
              speechRate: 1.0,
              pitch: 1.0,
            };
            await saveUserSettings(defaultSettings);
            setSettings(defaultSettings);
            setCustomTitle('');
            Alert.alert('成功', '已恢复默认设置');
          },
        },
      ]
    );
  }, []);

  // 返回上一页
  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      {/* 顶部导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <FontAwesome6 name="arrow-left" size={18} color={theme.textPrimary} />
          <ThemedText variant="smallMedium" color={theme.textPrimary}>返回</ThemedText>
        </TouchableOpacity>
        <ThemedText variant="h4" color={theme.textPrimary}>设置中心</ThemedText>
        <View style={styles.navRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 称呼设置 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <FontAwesome6 name="crown" size={18} color={theme.primary} />
            </View>
            <ThemedText variant="sectionTitle" color={theme.textPrimary}>
              我的称呼
            </ThemedText>
          </View>

          <View style={styles.optionsGrid}>
            {TITLE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionChip,
                  settings.title === option.value && styles.optionChipSelected,
                ]}
                onPress={() => handleSelectTitle(option.value)}
              >
                <ThemedText
                  variant="tagText"
                  color={settings.title === option.value ? '#FFF' : theme.textPrimary}
                >
                  {option.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* 自定义称呼 */}
          <View style={styles.customTitleContainer}>
            <ThemedText variant="small" color={theme.textSecondary} style={styles.customTitleLabel}>
              自定义称呼：
            </ThemedText>
            <View style={styles.customTitleInputRow}>
              <TextInput
                style={styles.customTitleInput}
                placeholder="输入您喜欢的称呼"
                placeholderTextColor={theme.textMuted}
                value={customTitle}
                onChangeText={setCustomTitle}
              />
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveCustomTitle}>
                <ThemedText variant="smallMedium" color="#FFF">保存</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 声音设置 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <FontAwesome6 name="microphone" size={18} color={theme.accent} />
            </View>
            <ThemedText variant="sectionTitle" color={theme.textPrimary}>
              声音类型
            </ThemedText>
          </View>

          <View style={styles.voiceList}>
            {VOICE_OPTIONS.map((voice) => (
              <TouchableOpacity
                key={voice.value}
                style={[
                  styles.voiceOption,
                  settings.voiceId === voice.value && styles.voiceOptionSelected,
                ]}
                onPress={() => handleSelectVoice(voice.value)}
              >
                <View style={styles.voiceOptionContent}>
                  <FontAwesome6
                    name={settings.voiceId === voice.value ? 'circle-check' : 'circle'}
                    size={20}
                    color={settings.voiceId === voice.value ? theme.primary : theme.textMuted}
                  />
                  <ThemedText
                    variant="smallMedium"
                    color={settings.voiceId === voice.value ? theme.primary : theme.textPrimary}
                  >
                    {voice.label}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 语速设置 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <FontAwesome6 name="gauge-high" size={18} color={theme.success} />
            </View>
            <ThemedText variant="sectionTitle" color={theme.textPrimary}>
              朗读语速
            </ThemedText>
          </View>

          <View style={styles.rateOptions}>
            {[
              { label: '慢速', value: 0.7 },
              { label: '正常', value: 1.0 },
              { label: '快速', value: 1.3 },
              { label: '极快', value: 1.5 },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.rateOption,
                  Math.abs(settings.speechRate - option.value) < 0.1 && styles.rateOptionSelected,
                ]}
                onPress={() => handleSpeechRateChange(option.value)}
              >
                <ThemedText
                  variant="smallMedium"
                  color={Math.abs(settings.speechRate - option.value) < 0.1 ? '#FFF' : theme.textPrimary}
                >
                  {option.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 重置按钮 */}
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <FontAwesome6 name="rotate-left" size={16} color={theme.textMuted} />
          <ThemedText variant="small" color={theme.textMuted} style={styles.resetButtonText}>
            恢复默认设置
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}
