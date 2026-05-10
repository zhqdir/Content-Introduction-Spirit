// 用户认证与状态管理工具

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'voice_butler_device_id';
const API_KEY_KEY = 'voice_butler_api_key';

// 用户状态类型
export interface UserStatus {
  deviceId: string;
  isPremium: boolean;
  premiumExpiry?: string;
  afdianUsername?: string;
  hasApiKey: boolean;
  ttsRemaining: number;  // -1 表示无限
  llmRemaining: number;  // -1 表示无限
  ttsUsed: number;
  llmUsed: number;
  ttsDailyLimit?: number;  // 每日限额
  llmDailyLimit?: number;  // 每日限额
}

// 获取或创建设备ID
export async function getDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = Crypto.randomUUID();
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('Failed to get device ID:', error);
    // 返回临时ID
    return Crypto.randomUUID();
  }
}

// 获取用户API Key
export async function getUserApiKey(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(API_KEY_KEY);
  } catch (error) {
    console.error('Failed to get API key:', error);
    return null;
  }
}

// 设置用户API Key
export async function setUserApiKey(apiKey: string): Promise<void> {
  try {
    await AsyncStorage.setItem(API_KEY_KEY, apiKey);
  } catch (error) {
    console.error('Failed to save API key:', error);
    throw error;
  }
}

// 删除用户API Key
export async function deleteUserApiKey(): Promise<void> {
  try {
    await AsyncStorage.removeItem(API_KEY_KEY);
  } catch (error) {
    console.error('Failed to delete API key:', error);
    throw error;
  }
}

// 获取用户状态
export async function fetchUserStatus(): Promise<UserStatus> {
  const deviceId = await getDeviceId();
  
  /**
   * 服务端文件：server/src/routes/user.ts
   * 接口：GET /api/v1/user/status
   * Header 参数：x-device-id: string
   */
  const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/user/status`, {
    headers: {
      'x-device-id': deviceId,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user status');
  }

  return response.json();
}

// 格式化剩余次数
export function formatRemaining(remaining: number): string {
  if (remaining === -1) {
    return '无限';
  }
  return `${remaining}次`;
}

// 会员价格配置
export const MEMBERSHIP_PRICES = {
  monthly: 9.9,
  quarterly: 24.9,
  yearly: 89.9,
};

// 会员计划
export const MEMBERSHIP_PLANS = [
  { id: 'monthly', name: '月度会员', price: 9.9, days: 30 },
  { id: 'quarterly', name: '季度会员', price: 24.9, days: 90 },
  { id: 'yearly', name: '年度会员', price: 89.9, days: 365 },
] as const;
