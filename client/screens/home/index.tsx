import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Text,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { createStyles } from './styles';
import { getUserSettings, UserSettings, TITLE_OPTIONS } from '@/utils/settingsStorage';
import { 
  fetchUserStatus, 
  getUserApiKey, 
  getDeviceId,
  formatRemaining,
  UserStatus 
} from '@/utils/userAuth';
import { UpgradeModal } from '@/components/UpgradeModal';

// 输入模式
type InputMode = 'text' | 'url';

// 朗读内容类型
type ReadingContent = 'none' | 'original' | 'summary';

// 将文本按句子分割
function splitIntoSentences(text: string): string[] {
  // 按中文和英文标点符号分割
  const sentences = text.split(/(?<=[。！？!?\n])/g).filter(s => s.trim());
  return sentences;
}

export default function HomeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // 状态
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedTitle, setFetchedTitle] = useState<string | null>(null);
  const [readingContent, setReadingContent] = useState<ReadingContent>('none');
  const [readingProgress, setReadingProgress] = useState(0); // 0-100
  const [audioDuration, setAudioDuration] = useState(0); // 音频总时长（毫秒）

  // 用户状态（次数限制）
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'tts_limit' | 'llm_limit' | 'premium_voice' | 'manual'>('manual');

  // 音频播放器引用
  const soundRef = useRef<Audio.Sound | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 分割后的句子
  const sentences = useMemo(() => {
    if (readingContent === 'original' && text.trim()) {
      return splitIntoSentences(text);
    }
    if (readingContent === 'summary' && summary) {
      return splitIntoSentences(summary);
    }
    return [];
  }, [text, summary, readingContent]);

  // 根据进度计算已朗读的句子数量
  const readSentencesCount = useMemo(() => {
    if (sentences.length === 0 || readingProgress === 0) return 0;
    return Math.ceil((readingProgress / 100) * sentences.length);
  }, [sentences.length, readingProgress]);

  // 加载用户设置
  const loadSettings = useCallback(async () => {
    try {
      const userSettings = await getUserSettings();
      setSettings(userSettings);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  // 加载用户状态
  const loadUserStatus = useCallback(async () => {
    try {
      const status = await fetchUserStatus();
      setUserStatus(status);
    } catch (err) {
      console.error('Failed to load user status:', err);
    }
  }, []);

  // 每次进入页面时刷新设置和用户状态
  useFocusEffect(
    useCallback(() => {
      loadSettings();
      loadUserStatus();
    }, [loadSettings, loadUserStatus])
  );

  // 清理进度定时器
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // 播放音频
  const playAudio = useCallback(async (uri: string, contentType: ReadingContent) => {
    try {
      // 卸载之前的音频
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // 清理之前的进度定时器
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      // 配置音频模式
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      // 加载并播放新音频
      const { sound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setIsPlaying(true);
      setReadingContent(contentType);
      setReadingProgress(0);

      // 获取音频时长
      if (status.isLoaded) {
        const duration = status.durationMillis || 0;
        setAudioDuration(duration);

        // 启动进度更新定时器
        progressIntervalRef.current = setInterval(async () => {
          if (soundRef.current) {
            const currentStatus = await soundRef.current.getStatusAsync();
            if (currentStatus.isLoaded) {
              const position = currentStatus.positionMillis || 0;
              const progress = Math.min(100, (position / duration) * 100);
              setReadingProgress(progress);
            }
          }
        }, 100); // 每100ms更新一次进度
      }

      // 监听播放完成事件
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          setReadingContent('none');
          setReadingProgress(0);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
        }
      });
    } catch (err) {
      console.error('Failed to play audio:', err);
      setError('音频播放失败');
      setIsPlaying(false);
      setReadingContent('none');
      setReadingProgress(0);
    }
  }, []);

  // 从URL获取文本
  const handleFetchUrl = useCallback(async () => {
    if (!url.trim()) {
      setError('请输入网址链接');
      return;
    }

    // 验证URL格式
    let validUrl = url.trim();
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
    }

    setError(null);
    setIsFetchingUrl(true);
    try {
      /**
       * 服务端文件：server/src/routes/fetch.ts
       * 接口：POST /api/v1/fetch/url
       * Body 参数：url: string
       */
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/fetch/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validUrl }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '获取网页内容失败');
        return;
      }

      setText(data.text);
      setFetchedTitle(data.title);
    } catch (err) {
      setError('获取网页内容失败，请检查链接是否正确');
    } finally {
      setIsFetchingUrl(false);
    }
  }, [url]);

  // 原文朗读
  const handleOriginalRead = useCallback(async () => {
    if (!text.trim()) {
      setError('请先输入要朗读的文本');
      return;
    }
    
    // 检查用户是否有API Key（有则不限次数）
    const apiKey = await getUserApiKey();
    if (!apiKey && userStatus) {
      // 检查剩余次数
      if (userStatus.ttsRemaining !== -1 && userStatus.ttsRemaining <= 0) {
        setUpgradeReason('tts_limit');
        setShowUpgradeModal(true);
        return;
      }
    }
    
    setError(null);
    setSummary(null);
    setIsLoading(true);

    // 获取用户称呼
    const title = settings?.title || '老板';
    // 构建带开场白的朗读文本
    const textWithIntro = `${title}，这篇内容原文如下：\n\n${text.trim()}`;

    try {
      /**
       * 服务端文件：server/src/routes/tts.ts
       * 接口：POST /api/v1/tts/synthesize
       * Body 参数：text: string, speaker?: string, speechRate?: number
       * Header 参数：x-device-id?: string, x-api-key?: string
       */
      const deviceId = await getDeviceId();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tts/synthesize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: textWithIntro,
          speaker: settings?.voiceId,
          speechRate: settings?.speechRate,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403 && errorData.error?.includes('TTS使用次数')) {
          setUpgradeReason('tts_limit');
          setShowUpgradeModal(true);
          return;
        }
        throw new Error(errorData.error || '朗读失败');
      }
      
      const data = await response.json();
      if (data.audioUri) {
        await playAudio(data.audioUri, 'original');
        // 刷新用户状态
        loadUserStatus();
      }
    } catch (err: any) {
      setError(err.message || '朗读失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [text, settings?.voiceId, settings?.speechRate, playAudio, userStatus, loadUserStatus]);

  // 归纳汇报
  const handleSummaryRead = useCallback(async () => {
    if (!text.trim()) {
      setError('请先输入要朗读的文本');
      return;
    }
    
    // 检查用户是否有API Key（有则不限次数）
    const apiKey = await getUserApiKey();
    if (!apiKey && userStatus) {
      // 检查LLM剩余次数
      if (userStatus.llmRemaining !== -1 && userStatus.llmRemaining <= 0) {
        setUpgradeReason('llm_limit');
        setShowUpgradeModal(true);
        return;
      }
    }
    
    setError(null);
    setIsLoading(true);
    try {
      const deviceId = await getDeviceId();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }
      
      // 先生成归纳
      /**
       * 服务端文件：server/src/routes/llm.ts
       * 接口：POST /api/v1/llm/summarize
       * Body 参数：text: string, title?: string
       * Header 参数：x-device-id?: string, x-api-key?: string
       */
      const summaryResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/llm/summarize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: text.trim(), title: settings?.title || '老板' }),
      });
      
      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json();
        if (summaryResponse.status === 403 && errorData.error?.includes('归纳使用次数')) {
          setUpgradeReason('llm_limit');
          setShowUpgradeModal(true);
          return;
        }
        throw new Error(errorData.error || '归纳失败');
      }
      
      const summaryData = await summaryResponse.json();
      setSummary(summaryData.summary);

      // 构建带开场白的朗读文本
      const title = settings?.title || '老板';
      const summaryWithIntro = `${title}，这篇内容归纳总结如下：\n\n${summaryData.summary}`;

      // 再朗读
      const ttsResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tts/synthesize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: summaryWithIntro,
          speaker: settings?.voiceId,
          speechRate: settings?.speechRate,
        }),
      });
      
      if (!ttsResponse.ok) {
        // TTS失败不影响归纳结果已生成
        console.error('TTS failed after summary');
      } else {
        const ttsData = await ttsResponse.json();
        if (ttsData.audioUri) {
          await playAudio(ttsData.audioUri, 'summary');
        }
      }
      
      // 刷新用户状态
      loadUserStatus();
    } catch (err: any) {
      setError(err.message || '归纳朗读失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [text, settings?.title, settings?.voiceId, settings?.speechRate, playAudio, userStatus, loadUserStatus]);

  // 停止播放
  const handleStop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
      setReadingContent('none');
      setReadingProgress(0);
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  }, []);

  // 清空内容
  const handleClear = useCallback(() => {
    setText('');
    setUrl('');
    setFetchedTitle(null);
    setSummary(null);
    setError(null);
    setReadingProgress(0);
  }, []);

  // 获取用户称呼
  const userTitle = settings?.title || TITLE_OPTIONS[0].value;

  // 渲染带高亮的文本
  const renderHighlightedText = useCallback(() => {
    if (readingContent !== 'original' || sentences.length === 0) {
      // 非朗读模式，显示普通文本
      return (
        <TextInput
          style={styles.textArea}
          placeholder={inputMode === 'url' ? '网页文本内容将显示在这里...' : '粘贴或输入您想朗读的文字...'}
          placeholderTextColor={theme.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={inputMode === 'url' ? 6 : 8}
          textAlignVertical="top"
          editable={inputMode === 'text' && readingContent !== 'original'}
        />
      );
    }

    // 朗读模式，显示分段高亮文本
    return (
      <View style={styles.highlightedTextContainer}>
        {sentences.map((sentence, index) => {
          const isRead = index < readSentencesCount;
          const isCurrentReading = index === readSentencesCount - 1;
          return (
            <Text
              key={index}
              style={[
                styles.sentenceText,
                isRead && styles.sentenceTextRead,
                isCurrentReading && styles.sentenceTextCurrent,
              ]}
            >
              {sentence}
            </Text>
          );
        })}
      </View>
    );
  }, [readingContent, sentences, readSentencesCount, text, inputMode, theme.textMuted, styles]);

  // 渲染带高亮的摘要
  const renderHighlightedSummary = useCallback(() => {
    if (!summary || readingContent !== 'summary') {
      return (
        <ThemedText variant="body" color={theme.textSecondary} style={styles.summaryText}>
          {summary}
        </ThemedText>
      );
    }

    // 朗读模式，显示分段高亮摘要
    return (
      <View style={styles.highlightedTextContainer}>
        {sentences.map((sentence, index) => {
          const isRead = index < readSentencesCount;
          const isCurrentReading = index === readSentencesCount - 1;
          return (
            <Text
              key={index}
              style={[
                styles.sentenceText,
                isRead && styles.sentenceTextRead,
                isCurrentReading && styles.sentenceTextCurrent,
              ]}
            >
              {sentence}
            </Text>
          );
        })}
      </View>
    );
  }, [summary, readingContent, sentences, readSentencesCount, theme.textSecondary, styles]);

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 头部问候 */}
          <ThemedView level="root" style={styles.header}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={['#6C63FF', '#896BFF']}
                style={styles.avatar}
              >
                <FontAwesome6 name="robot" size={32} color="#FFF" />
              </LinearGradient>
            </View>
            <ThemedText variant="h2" color={theme.textPrimary} style={styles.greeting}>
              {userTitle}，您好！
            </ThemedText>
            <ThemedText variant="cardDesc" color={theme.textSecondary} style={styles.subtitle}>
              您的眼睛也该歇歇了，微微闭上双眼，让我读给您听
            </ThemedText>
            
            {/* 会员状态显示 */}
            {userStatus?.isPremium && !userStatus.hasApiKey && (
              <View style={styles.premiumCard}>
                <FontAwesome6 name="heart" size={14} color="#FF6B6B" />
                <ThemedText variant="small" color="#FF6B6B">
                  付费会员
                  {userStatus.premiumExpiry && ` · ${new Date(userStatus.premiumExpiry).toLocaleDateString()}到期`}
                </ThemedText>
              </View>
            )}
            
            {/* 剩余次数卡片（免费用户和会员） */}
            {userStatus && !userStatus.hasApiKey && (
              <View style={styles.usageCard}>
                <View style={styles.usageItem}>
                  <FontAwesome6 name="book-open" size={14} color={theme.primary} />
                  <ThemedText variant="small" color={theme.textSecondary}>
                    朗读剩余
                  </ThemedText>
                  <ThemedText variant="smallMedium" color={userStatus.ttsRemaining > 0 ? theme.primary : theme.error}>
                    {formatRemaining(userStatus.ttsRemaining)}{userStatus.ttsDailyLimit ? `/${userStatus.ttsDailyLimit}` : ''}
                  </ThemedText>
                </View>
                <View style={styles.usageDivider} />
                <View style={styles.usageItem}>
                  <FontAwesome6 name="wand-magic-sparkles" size={14} color={theme.primary} />
                  <ThemedText variant="small" color={theme.textSecondary}>
                    归纳剩余
                  </ThemedText>
                  <ThemedText variant="smallMedium" color={userStatus.llmRemaining > 0 ? theme.primary : theme.error}>
                    {formatRemaining(userStatus.llmRemaining)}{userStatus.llmDailyLimit ? `/${userStatus.llmDailyLimit}` : ''}
                  </ThemedText>
                </View>
                {!userStatus.isPremium && (
                  <TouchableOpacity 
                    style={styles.upgradeHint}
                    onPress={() => {
                      setUpgradeReason('manual');
                      setShowUpgradeModal(true);
                    }}
                  >
                    <FontAwesome6 name="crown" size={12} color="#FFB800" />
                    <ThemedText variant="caption" color="#FFB800">升级无限</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            {/* API Key已设置提示 */}
            {userStatus?.hasApiKey && (
              <View style={styles.apiKeyHint}>
                <FontAwesome6 name="key" size={14} color={theme.success} />
                <ThemedText variant="small" color={theme.success}>
                  已配置API Key · 无限使用
                </ThemedText>
              </View>
            )}
          </ThemedView>

          {/* 输入模式切换 */}
          <View style={styles.modeSwitchContainer}>
            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'text' && styles.modeButtonActive]}
              onPress={() => setInputMode('text')}
            >
              <FontAwesome6
                name="keyboard"
                size={16}
                color={inputMode === 'text' ? '#FFF' : theme.textPrimary}
              />
              <ThemedText
                variant="smallMedium"
                color={inputMode === 'text' ? '#FFF' : theme.textPrimary}
              >
                文本输入
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'url' && styles.modeButtonActive]}
              onPress={() => setInputMode('url')}
            >
              <FontAwesome6
                name="link"
                size={16}
                color={inputMode === 'url' ? '#FFF' : theme.textPrimary}
              />
              <ThemedText
                variant="smallMedium"
                color={inputMode === 'url' ? '#FFF' : theme.textPrimary}
              >
                网址链接
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* URL输入区域 */}
          {inputMode === 'url' && (
            <View style={styles.urlInputCard}>
              <ThemedText variant="sectionTitle" color={theme.textPrimary} style={styles.sectionTitle}>
                输入网址
              </ThemedText>
              <View style={styles.urlInputRow}>
                <TextInput
                  style={styles.urlInput}
                  placeholder="粘贴网页链接..."
                  placeholderTextColor={theme.textMuted}
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <TouchableOpacity
                  style={styles.fetchButton}
                  onPress={handleFetchUrl}
                  disabled={isFetchingUrl}
                >
                  {isFetchingUrl ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <FontAwesome6 name="arrow-down" size={16} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
              {fetchedTitle && (
                <View style={styles.fetchedInfo}>
                  <FontAwesome6 name="circle-check" size={14} color={theme.success} />
                  <ThemedText variant="small" color={theme.success}>
                    已获取: {fetchedTitle}
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* 文本输入区域 */}
          <View style={[
            styles.inputCard,
            readingContent === 'original' && styles.inputCardHighlight
          ]}>
            <View style={styles.inputCardHeader}>
              <ThemedText variant="sectionTitle" color={theme.textPrimary}>
                {inputMode === 'url' ? '网页内容' : '输入文本内容'}
              </ThemedText>
              {readingContent === 'original' && (
                <View style={styles.readingBadge}>
                  <ActivityIndicator color="#FFF" size="small" />
                  <ThemedText variant="caption" color="#FFF" style={styles.readingBadgeText}>
                    正在朗读 {Math.round(readingProgress)}%
                  </ThemedText>
                </View>
              )}
              {text.length > 0 && readingContent !== 'original' && (
                <TouchableOpacity onPress={handleClear}>
                  <FontAwesome6 name="trash-can" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <View style={[
              styles.textAreaContainer,
              readingContent === 'original' && styles.textAreaHighlight
            ]}>
              {renderHighlightedText()}
            </View>
            <View style={styles.charCount}>
              <ThemedText variant="caption" color={theme.textMuted}>
                {text.length} 字
              </ThemedText>
            </View>
          </View>

          {/* 操作按钮 */}
          <View style={styles.actionContainer}>
            {/* 原文朗读按钮 */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleOriginalRead}
              disabled={isLoading || isPlaying}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#6C63FF', '#896BFF']}
                style={styles.buttonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <FontAwesome6 name="book-open" size={20} color="#FFF" />
                    <ThemedText variant="smallMedium" color="#FFF" style={styles.buttonText}>
                      原文朗读
                    </ThemedText>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* 归纳汇报按钮 */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSummaryRead}
              disabled={isLoading || isPlaying}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF6584', '#FF8BA7']}
                style={styles.buttonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <FontAwesome6 name="wand-magic-sparkles" size={20} color="#FFF" />
                    <ThemedText variant="smallMedium" color="#FFF" style={styles.buttonText}>
                      归纳汇报
                    </ThemedText>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* 正在播放 */}
          {isPlaying && (
            <View style={styles.playingCard}>
              <View style={styles.playingHeader}>
                <ActivityIndicator color={theme.primary} />
                <ThemedText variant="cardTitle" color={theme.textPrimary} style={styles.playingText}>
                  正在为您朗读...
                </ThemedText>
              </View>
              <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                <FontAwesome6 name="stop" size={16} color={theme.error} />
                <ThemedText variant="small" color={theme.error}>停止</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* 归纳结果 */}
          {summary && (
            <View style={[
              styles.summaryCard,
              readingContent === 'summary' && styles.summaryCardHighlight
            ]}>
              <View style={styles.summaryHeader}>
                {readingContent === 'summary' ? (
                  <ActivityIndicator color={theme.primary} size={20} />
                ) : (
                  <FontAwesome6 name="lightbulb" size={20} color={theme.primary} />
                )}
                <ThemedText variant="cardTitle" color={theme.textPrimary} style={styles.summaryTitle}>
                  归纳摘要
                </ThemedText>
                {readingContent === 'summary' && (
                  <View style={styles.readingBadgeSmall}>
                    <ThemedText variant="tiny" color="#FFF">{Math.round(readingProgress)}%</ThemedText>
                  </View>
                )}
              </View>
              {renderHighlightedSummary()}
            </View>
          )}

          {/* 错误提示 */}
          {error && (
            <View style={styles.errorCard}>
              <FontAwesome6 name="circle-exclamation" size={20} color={theme.error} />
              <ThemedText variant="small" color={theme.error} style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          )}

          {/* 使用提示 */}
          <View style={styles.tipCard}>
            <View style={styles.tipIconContainer}>
              <FontAwesome6 name="lightbulb" size={18} color={theme.primary} />
            </View>
            <View style={styles.tipContent}>
              <ThemedText variant="small" color={theme.textSecondary}>
                {inputMode === 'url'
                  ? '粘贴网页链接后点击获取按钮，自动提取网页文本内容'
                  : '在其他应用选中文本，点击分享可选择我们的应用进行朗读'}
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* 付费升级弹窗 */}
      <UpgradeModal
        visible={showUpgradeModal}
        reason={upgradeReason}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={() => {
          setShowUpgradeModal(false);
          loadUserStatus();
        }}
      />
    </Screen>
  );
}
