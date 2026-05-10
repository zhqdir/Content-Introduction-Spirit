import express, { type Request, type Response } from 'express';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = express.Router();

/**
 * POST /api/v1/fetch/url
 * 从URL获取文本内容
 * Body: { url: string }
 */
router.post('/url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: '请提供有效的网址链接' });
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: '请提供有效的网址链接' });
    }

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);

    // 创建Fetch客户端
    const config = new Config();
    const fetchClient = new FetchClient(config, customHeaders);

    // 获取网页内容
    const response = await fetchClient.fetch(url);

    if (response.status_code !== 0) {
      return res.status(400).json({
        error: '无法获取网页内容',
        message: response.status_message || 'Unknown error',
      });
    }

    // 提取文本内容
    const textContent = response.content
      .filter(item => item.type === 'text' && item.text)
      .map(item => item.text)
      .join('\n\n');

    if (!textContent.trim()) {
      return res.status(400).json({ error: '该网页未找到可朗读的文本内容' });
    }

    res.json({
      success: true,
      title: response.title || '未知标题',
      url: response.url || url,
      text: textContent,
      textLength: textContent.length,
    });
  } catch (error: any) {
    console.error('Fetch URL error:', error);
    res.status(500).json({
      error: '获取网页内容失败',
      message: error.message || 'Unknown error',
    });
  }
});

export default router;
