import AsyncStorage from '@react-native-async-storage/async-storage';

// 用户设置接口
export interface UserSettings {
  // 用户称呼
  title: string;
  // 声音类型（voice identifier）
  voiceId: string | null;
  // 朗读速度（0.5 - 2.0）
  speechRate: number;
  // 朗读音调（0.5 - 2.0）
  pitch: number;
}

// 预设称呼选项
export const TITLE_OPTIONS = [
  { label: '老板', value: '老板' },
  { label: '亲', value: '亲' },
  { label: '先生', value: '先生' },
  { label: '女士', value: '女士' },
  { label: '皇上', value: '皇上' },
  { label: '殿下', value: '殿下' },
  { label: '女王', value: '女王' },
  { label: '陛下', value: '陛下' },
  { label: '主人', value: '主人' },
];

// 默认设置
const DEFAULT_SETTINGS: UserSettings = {
  title: '老板',
  voiceId: null,
  speechRate: 1.0,
  pitch: 1.0,
};

const STORAGE_KEY = '@voice_butler_settings';

// 获取用户设置
export async function getUserSettings(): Promise<UserSettings> {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    if (jsonValue === null) {
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(jsonValue) };
  } catch (error) {
    console.error('Error reading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

// 保存用户设置
export async function saveUserSettings(settings: Partial<UserSettings>): Promise<void> {
  try {
    const currentSettings = await getUserSettings();
    const newSettings = { ...currentSettings, ...settings };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

// 重置为默认设置
export async function resetSettings(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  } catch (error) {
    console.error('Error resetting settings:', error);
    throw error;
  }
}
