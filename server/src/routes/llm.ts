import express, { type Request, type Response } from 'express';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { checkLlmLimit } from '../middleware/usageLimit';

const router = express.Router();

/**
 * 生成拟人化汇报文本
 * @param summary 原始摘要
 * @param title 用户称呼
 */
function generatePersonalizedReport(summary: string, title: string): string {
  const greetings = [
    `${title}，为您总结如下：`,
    `${title}，以下是本次内容要点：`,
    `${title}，我来为您汇报：`,
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  return `${greeting}\n\n${summary}`;
}

/**
 * POST /api/v1/llm/summarize
 * 文本归纳总结
 * Body: { text: string, title?: string }
 * Headers: x-device-id, x-api-key (optional)
 */
router.post('/summarize', checkLlmLimit, async (req: Request, res: Response) => {
  try {
    const { text, title = '老板' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供要总结的文本' });
    }

    // 文本过长时截断
    const maxLength = 8000;
    const truncatedText = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);

    // 如果用户提供了API Key，使用用户的Key
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      customHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    // 创建LLM客户端
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 构建提示词
    const systemPrompt = `你是一位专业的语音管家助手，擅长为用户总结和汇报内容。

你的任务是将用户提供的文本内容进行简洁、清晰的归纳总结，便于语音朗读。

总结要求：
1. 提取核心要点，去除冗余信息
2. 保持语言简洁流畅，适合语音朗读
3. 控制在3-5个要点，每个要点不超过50字
4. 使用清晰的结构，如"第一..."、"第二..."等
5. 语气温和亲切，像管家向主人汇报工作一样

请直接输出总结内容，不要有任何前缀或解释。`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `请总结以下内容：\n\n${truncatedText}` },
    ];

    // 调用LLM生成总结
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-6-lite-251015',
      temperature: 0.7,
    });

    // 生成拟人化汇报文本
    const personalizedReport = generatePersonalizedReport(response.content, title);

    res.json({
      success: true,
      summary: personalizedReport,
      originalLength: text.length,
      summaryLength: personalizedReport.length,
    });
  } catch (error: any) {
    console.error('LLM summarization error:', error);
    res.status(500).json({
      error: '文本总结失败',
      message: error.message || 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/llm/stream-summarize
 * 流式文本归纳总结（SSE）
 * Body: { text: string, title?: string }
 * Headers: x-device-id, x-api-key (optional)
 */
router.post('/stream-summarize', checkLlmLimit, async (req: Request, res: Response) => {
  try {
    const { text, title = '老板' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供要总结的文本' });
    }

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
    res.setHeader('Connection', 'keep-alive');

    // 文本过长时截断
    const maxLength = 8000;
    const truncatedText = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);

    // 如果用户提供了API Key，使用用户的Key
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      customHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    // 创建LLM客户端
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 构建提示词
    const systemPrompt = `你是一位专业的语音管家助手，擅长为用户总结和汇报内容。

你的任务是将用户提供的文本内容进行简洁、清晰的归纳总结，便于语音朗读。

总结要求：
1. 提取核心要点，去除冗余信息
2. 保持语言简洁流畅，适合语音朗读
3. 控制在3-5个要点，每个要点不超过50字
4. 使用清晰的结构，如"第一..."、"第二..."等
5. 语气温和亲切，像管家向主人汇报工作一样

请直接输出总结内容，不要有任何前缀或解释。`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `请总结以下内容：\n\n${truncatedText}` },
    ];

    // 先发送问候语
    const greeting = `${title}，为您总结如下：\n\n`;
    res.write(`data: ${JSON.stringify({ content: greeting })}\n\n`);

    // 流式生成总结
    const stream = llmClient.stream(messages, {
      model: 'doubao-seed-1-6-lite-251015',
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        res.write(`data: ${JSON.stringify({ content: chunk.content.toString() })}\n\n`);
      }
    }

    // 发送结束标记
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('LLM stream summarization error:', error);
    res.write(`data: ${JSON.stringify({ error: '文本总结失败' })}\n\n`);
    res.end();
  }
});

export default router;
