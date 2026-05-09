import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { MEMBERSHIP_PLANS, getDeviceId } from '@/utils/userAuth';

type UpgradeReason = 'tts_limit' | 'llm_limit' | 'premium_voice' | 'manual';

interface UpgradeModalProps {
  visible: boolean;
  reason: UpgradeReason;
  onClose: () => void;
  onSuccess: () => void;
}

// 收款码图片（本地资源）
const WECHAT_PAY_IMAGE = require('@/assets/skmwx.jpg');
const ALIPAY_IMAGE = require('@/assets/skmzfb.jpg');
const WECHAT_CONTACT_IMAGE = require('@/assets/wxqglt.jpg');

export function UpgradeModal({ visible, reason, onClose, onSuccess }: UpgradeModalProps) {
  const { theme, isDark } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<'wechat' | 'alipay' | 'apikey'>('wechat');
  const [selectedPlan, setSelectedPlan] = useState(0); // 默认选择第一个计划
  const [transactionId, setTransactionId] = useState('');
  const [note, setNote] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 计算动态maxHeight（屏幕高度的85%，最大600，最小400）
  const dynamicMaxHeight = Math.min(600, Math.max(400, screenHeight * 0.85));

  // 根据原因显示不同的提示
  const reasonMessages = useMemo(() => ({
    tts_limit: '今日朗读次数已用完，升级会员或配置API Key获取更多使用次数',
    llm_limit: '今日归纳次数已用完，升级会员或配置API Key获取更多使用次数',
    premium_voice: '该语音为会员专属，升级会员解锁更多精彩语音',
    manual: '升级会员，解锁更多朗读与归纳次数',
  }), []);

  // 重置状态
  useEffect(() => {
    if (visible) {
      setTransactionId('');
      setNote('');
      setApiKey('');
      setError(null);
      setSuccess(false);
    }
  }, [visible]);

  // 提交订单
  const handleSubmitOrder = async () => {
    if (!transactionId.trim()) {
      setError('请输入交易单号');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const deviceId = await getDeviceId();
      const plan = MEMBERSHIP_PLANS[selectedPlan];

      /**
       * 服务端文件：server/src/routes/payment.ts
       * 接口：POST /api/v1/payment/order
       * Header 参数：x-device-id: string
       * Body 参数：paymentMethod: 'wechat' | 'alipay', amount: number, transactionId: string, note?: string
       */
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/payment/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({
          paymentMethod: activeTab as 'wechat' | 'alipay',
          amount: plan.price,
          transactionId: transactionId.trim(),
          note: note.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '提交失败');
      }

      setSuccess(true);
      setTransactionId('');
      setNote('');
    } catch (err: any) {
      setError(err.message || '提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 保存API Key
  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setError('请输入API Key');
      return;
    }

    if (apiKey.trim().length < 10) {
      setError('API Key格式不正确');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const deviceId = await getDeviceId();

      /**
       * 服务端文件：server/src/routes/user.ts
       * 接口：POST /api/v1/user/api-key
       * Header 参数：x-device-id: string
       * Body 参数：apiKey: string
       */
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/user/api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || '保存失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = useMemo(() => ({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    modalContent: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 20,
      width: '90%' as const,
      maxWidth: 400,
      maxHeight: dynamicMaxHeight, // 动态高度适配不同屏幕
      overflow: 'hidden' as const,
    },
    header: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: theme.textPrimary,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    body: {
      padding: 20,
    },
    reasonBox: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    reasonIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FF6584',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginRight: 12,
    },
    tabContainer: {
      flexDirection: 'row' as const,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: 12,
      padding: 4,
      marginBottom: 20,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center' as const,
    },
    tabActive: {
      backgroundColor: theme.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500' as const,
    },
    tabTextActive: {
      color: '#FFF',
    },
    tabTextInactive: {
      color: theme.textSecondary,
    },
    planContainer: {
      marginBottom: 20,
    },
    planLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 10,
    },
    planOptions: {
      flexDirection: 'row' as const,
      gap: 8,
    },
    planOption: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center' as const,
    },
    planOptionSelected: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}10`,
    },
    planName: {
      fontSize: 13,
      color: theme.textPrimary,
      fontWeight: '500' as const,
    },
    planPrice: {
      fontSize: 18,
      color: theme.primary,
      fontWeight: '700' as const,
      marginTop: 4,
    },
    qrContainer: {
      alignItems: 'center' as const,
      marginBottom: 20,
    },
    qrImage: {
      width: 180,
      height: 180,
      borderRadius: 12,
      backgroundColor: '#FFF',
    },
    qrLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 12,
    },
    contactContainer: {
      alignItems: 'center' as const,
      marginBottom: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    contactLabel: {
      fontSize: 13,
      color: theme.primary,
      marginBottom: 12,
    },
    contactImage: {
      width: 120,
      height: 120,
      borderRadius: 8,
      backgroundColor: '#FFF',
    },
    input: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.textPrimary,
      marginBottom: 12,
    },
    inputNote: {
      height: 60,
      textAlignVertical: 'top' as const,
    },
    submitButton: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center' as const,
      marginTop: 8,
    },
    submitButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600' as const,
    },
    errorBox: {
      backgroundColor: '#FFEBEE',
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
    },
    errorText: {
      color: '#F44336',
      fontSize: 14,
      textAlign: 'center' as const,
    },
    successBox: {
      backgroundColor: '#E8F5E9',
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
    },
    successText: {
      color: '#4CAF50',
      fontSize: 14,
      textAlign: 'center' as const,
    },
    tipText: {
      fontSize: 12,
      color: theme.textMuted,
      textAlign: 'center' as const,
      marginTop: 16,
      lineHeight: 18,
    },
  }), [theme, dynamicMaxHeight]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>升级会员</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <FontAwesome6 name="xmark" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                {/* 原因提示 */}
                <View style={styles.reasonBox}>
                  <View style={styles.reasonIcon}>
                    <FontAwesome6 name="crown" size={18} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="small" color={theme.textSecondary}>
                      {reasonMessages[reason]}
                    </ThemedText>
                  </View>
                </View>

                {/* 支付方式Tab */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'wechat' && styles.tabActive]}
                  onPress={() => setActiveTab('wechat')}
                >
                  <Text style={[styles.tabText, activeTab === 'wechat' ? styles.tabTextActive : styles.tabTextInactive]}>
                    微信支付
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'alipay' && styles.tabActive]}
                  onPress={() => setActiveTab('alipay')}
                >
                  <Text style={[styles.tabText, activeTab === 'alipay' ? styles.tabTextActive : styles.tabTextInactive]}>
                    支付宝
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'apikey' && styles.tabActive]}
                  onPress={() => setActiveTab('apikey')}
                >
                  <Text style={[styles.tabText, activeTab === 'apikey' ? styles.tabTextActive : styles.tabTextInactive]}>
                    API Key
                  </Text>
                </TouchableOpacity>
              </View>

              {/* API Key 方式 */}
              {activeTab === 'apikey' ? (
                <>
                  <ThemedText variant="small" color={theme.textSecondary} style={{ marginBottom: 12 }}>
                    配置您自己的API Key，可无限使用所有功能（不会消耗服务器资源）
                  </ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="输入您的API Key..."
                    placeholderTextColor={theme.textMuted}
                    value={apiKey}
                    onChangeText={setApiKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSaveApiKey}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>保存API Key</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.tipText}>
                    API Key将安全存储在您的设备上，不会上传到服务器
                  </Text>
                </>
              ) : (
                <>
                  {/* 会员计划选择 */}
                  <View style={styles.planContainer}>
                    <Text style={styles.planLabel}>选择会员时长</Text>
                    <View style={styles.planOptions}>
                      {MEMBERSHIP_PLANS.map((plan, index) => (
                        <TouchableOpacity
                          key={plan.id}
                          style={[styles.planOption, selectedPlan === index && styles.planOptionSelected]}
                          onPress={() => setSelectedPlan(index)}
                        >
                          <Text style={styles.planName}>{plan.name}</Text>
                          <Text style={styles.planPrice}>¥{plan.price}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* 收款码 */}
                  <View style={styles.qrContainer}>
                    <Image
                      style={styles.qrImage}
                      source={activeTab === 'wechat' ? WECHAT_PAY_IMAGE : ALIPAY_IMAGE}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrLabel}>
                      {activeTab === 'wechat' ? '使用微信扫码支付' : '使用支付宝扫码支付'}
                    </Text>
                  </View>
                  
                  {/* 微信联系二维码 */}
                  {activeTab === 'wechat' && (
                    <View style={styles.contactContainer}>
                      <Text style={styles.contactLabel}>支付后添加微信，备注「会员」快速激活</Text>
                      <Image
                        style={styles.contactImage}
                        source={WECHAT_CONTACT_IMAGE}
                        resizeMode="contain"
                      />
                    </View>
                  )}

                  {/* 订单提交 */}
                  <TextInput
                    style={styles.input}
                    placeholder="请输入交易单号（支付后查看）"
                    placeholderTextColor={theme.textMuted}
                    value={transactionId}
                    onChangeText={setTransactionId}
                  />
                  <TextInput
                    style={[styles.input, styles.inputNote]}
                    placeholder="备注（选填）"
                    placeholderTextColor={theme.textMuted}
                    value={note}
                    onChangeText={setNote}
                    multiline
                  />

                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSubmitOrder}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>提交订单</Text>
                    )}
                  </TouchableOpacity>

                  {error && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  {success && (
                    <View style={styles.successBox}>
                      <Text style={styles.successText}>订单提交成功！请等待审核，审核通过后自动激活会员</Text>
                    </View>
                  )}

                  <Text style={styles.tipText}>
                    支付后请在24小时内提交订单，管理员将尽快审核
                  </Text>
                </>
              )}
            </ScrollView>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
