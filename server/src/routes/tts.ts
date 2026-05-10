import express, { type Request, type Response } from 'express';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { checkTtsLimit } from '../middleware/usageLimit';

const router = express.Router();

// 默认语音
const DEFAULT_SPEAKER = 'zh_female_xiaohe_uranus_bigtts';

/**
 * POST /api/v1/tts/synthesize
 * 文本转语音合成
 * Body: { text: string, speaker?: string }
 * Headers: x-device-id, x-api-key (optional)
 */
router.post('/synthesize', checkTtsLimit, async (req: Request, res: Response) => {
  try {
    const { text, speaker, speechRate } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供要合成的文本' });
    }

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);

    // 如果用户提供了API Key，使用用户的Key
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      customHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    // 创建TTS客户端
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);

    // 调用TTS合成
    const response = await ttsClient.synthesize({
      uid: 'voice-butler-user',
      text: text.trim(),
      speaker: speaker || DEFAULT_SPEAKER,
      audioFormat: 'mp3',
      sampleRate: 24000,
      speechRate: speechRate ? Math.round((speechRate - 1) * 100) : 0, // 转换为-50到100的范围
    });

    res.json({
      success: true,
      audioUri: response.audioUri,
      audioSize: response.audioSize,
    });
  } catch (error: any) {
    console.error('TTS synthesis error:', error);
    res.status(500).json({
      error: '语音合成失败',
      message: error.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/tts/voices
 * 获取可用的语音列表
 */
router.get('/voices', (_req: Request, res: Response) => {
  const voices = [
    { id: 'zh_female_xiaohe_uranus_bigtts', name: '温柔女声', gender: 'female', style: 'gentle' },
    { id: 'zh_female_vv_uranus_bigtts', name: '活力女声', gender: 'female', style: 'energetic' },
    { id: 'zh_male_m191_uranus_bigtts', name: '阳光男声', gender: 'male', style: 'sunny' },
    { id: 'zh_male_taocheng_uranus_bigtts', name: '磁性男声', gender: 'male', style: 'magnetic' },
    { id: 'zh_female_xueayi_saturn_bigtts', name: '儿童故事', gender: 'female', style: 'storytelling' },
    { id: 'zh_male_dayi_saturn_bigtts', name: '大气男声', gender: 'male', style: 'dignified' },
    { id: 'zh_female_mizai_saturn_bigtts', name: '甜美女声', gender: 'female', style: 'sweet' },
    { id: 'zh_female_jitangnv_saturn_bigtts', name: '元气女声', gender: 'female', style: 'motivational' },
    { id: 'zh_female_meilinvyou_saturn_bigtts', name: '邻家女友', gender: 'female', style: 'friendly' },
    { id: 'saturn_zh_female_tiaopigongzhu_tob', name: '俏皮公主', gender: 'female', style: 'playful' },
    { id: 'saturn_zh_male_shuanglangshaonian_tob', name: '爽朗少年', gender: 'male', style: 'cheerful' },
  ];

  res.json({ voices });
});

export default router;
