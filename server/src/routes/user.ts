import express, { type Request, type Response } from 'express';
import {
  getUserStatus,
  getUserRemaining,
  getUserApiKey,
  setUserApiKey,
  getUserState,
} from '../middleware/usageLimit';

const router = express.Router();

/**
 * GET /api/v1/user/status
 * 获取用户状态
 * Headers: x-device-id
 */
router.get('/status', async (req: Request, res: Response) => {
  const deviceId = req.headers['x-device-id'] as string;

  if (!deviceId) {
    return res.status(400).json({ error: '缺少设备ID' });
  }

  const status = await getUserStatus(deviceId);
  res.json(status);
});

/**
 * POST /api/v1/user/api-key
 * 设置用户API Key
 * Headers: x-device-id
 * Body: { apiKey: string }
 */
router.post('/api-key', (req: Request, res: Response) => {
  const deviceId = req.headers['x-device-id'] as string;
  const { apiKey } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: '缺少设备ID' });
  }

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: '请提供有效的API Key' });
  }

  // 验证API Key格式（简单验证）
  if (apiKey.length < 10) {
    return res.status(400).json({ error: 'API Key格式不正确' });
  }

  setUserApiKey(deviceId, apiKey);
  
  res.json({
    success: true,
    message: 'API Key设置成功',
    hasApiKey: true,
  });
});

/**
 * DELETE /api/v1/user/api-key
 * 删除用户API Key
 * Headers: x-device-id
 */
router.delete('/api-key', (req: Request, res: Response) => {
  const deviceId = req.headers['x-device-id'] as string;

  if (!deviceId) {
    return res.status(400).json({ error: '缺少设备ID' });
  }

  setUserApiKey(deviceId, '');
  
  res.json({
    success: true,
    message: 'API Key已删除',
    hasApiKey: false,
  });
});

/**
 * GET /api/v1/user/remaining
 * 获取用户剩余次数
 * Headers: x-device-id
 */
router.get('/remaining', async (req: Request, res: Response) => {
  const deviceId = req.headers['x-device-id'] as string;

  if (!deviceId) {
    return res.status(400).json({ error: '缺少设备ID' });
  }

  const remaining = await getUserRemaining(deviceId);
  res.json(remaining);
});

export default router;
