import { type Request, type Response, type NextFunction } from 'express';
import { getUserState, updateUserState, isPremiumValid, getUserApiKey } from '../db/userState';
import { getUserRemaining } from '../db/userState';

// 额度配置
export const FREE_LIMITS = {
  TTS_DAILY_LIMIT: 5,    // 免费用户每日TTS次数
  LLM_DAILY_LIMIT: 3,    // 免费用户每日LLM次数
};

export const PREMIUM_LIMITS = {
  TTS_DAILY_LIMIT: 100,  // 会员每日TTS次数
  LLM_DAILY_LIMIT: 50,   // 会员每日LLM次数
};

// TTS使用次数检查中间件
export async function checkTtsLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const deviceId = req.headers['x-device-id'] as string;
  const apiKey = req.headers['x-api-key'] as string;

  // 如果提供了API Key，跳过限制检查
  if (apiKey) {
    next();
    return;
  }

  if (!deviceId) {
    res.status(400).json({ error: '缺少设备ID' });
    return;
  }

  const state = await getUserState(deviceId);
  
  // 如果用户设置了API Key，无限使用
  if (state.apiKey) {
    next();
    return;
  }
  
  // 判断用户类型和限额
  const isPremium = isPremiumValid(state);
  const dailyLimit = isPremium ? PREMIUM_LIMITS.TTS_DAILY_LIMIT : FREE_LIMITS.TTS_DAILY_LIMIT;
  const remaining = dailyLimit - state.ttsUsed;
  
  if (remaining <= 0) {
    // 会员超过每日限制，返回统一错误提示
    if (isPremium) {
      res.status(500).json({ error: '访问网络服务器异常' });
    } else {
      // 免费用户显示正常提示
      res.status(403).json({ 
        error: `免费用户今日TTS次数已用完（${dailyLimit}次/天）。请升级会员或配置自己的API Key获取更多使用次数。`,
        code: 'TTS_LIMIT_EXCEEDED',
        remaining: 0,
        dailyLimit,
      });
    }
    return;
  }

  // 增加使用次数
  await updateUserState(deviceId, { ttsUsed: state.ttsUsed + 1 });
  next();
}

// LLM使用次数检查中间件
export async function checkLlmLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const deviceId = req.headers['x-device-id'] as string;
  const apiKey = req.headers['x-api-key'] as string;

  // 如果提供了API Key，跳过限制检查
  if (apiKey) {
    next();
    return;
  }

  if (!deviceId) {
    res.status(400).json({ error: '缺少设备ID' });
    return;
  }

  const state = await getUserState(deviceId);
  
  // 如果用户设置了API Key，无限使用
  if (state.apiKey) {
    next();
    return;
  }
  
  // 判断用户类型和限额
  const isPremium = isPremiumValid(state);
  const dailyLimit = isPremium ? PREMIUM_LIMITS.LLM_DAILY_LIMIT : FREE_LIMITS.LLM_DAILY_LIMIT;
  const remaining = dailyLimit - state.llmUsed;
  
  if (remaining <= 0) {
    // 会员超过每日限制，返回统一错误提示
    if (isPremium) {
      res.status(500).json({ error: '访问网络服务器异常' });
    } else {
      // 免费用户显示正常提示
      res.status(403).json({ 
        error: `免费用户今日归纳次数已用完（${dailyLimit}次/天）。请升级会员或配置自己的API Key获取更多使用次数。`,
        code: 'LLM_LIMIT_EXCEEDED',
        remaining: 0,
        dailyLimit,
      });
    }
    return;
  }

  // 增加使用次数
  await updateUserState(deviceId, { llmUsed: state.llmUsed + 1 });
  next();
}

// 获取用户完整状态（用于API响应）
export async function getUserStatus(deviceId: string) {
  const state = await getUserState(deviceId);
  const { ttsRemaining, llmRemaining, hasApiKey } = await getUserRemaining(deviceId);
  const premiumValid = isPremiumValid(state);
  
  return {
    deviceId,
    isPremium: premiumValid,
    premiumExpiry: state.premiumExpiry,
    afdianUsername: state.afdianUsername,
    hasApiKey,
    ttsRemaining,
    llmRemaining,
    ttsUsed: state.ttsUsed,
    llmUsed: state.llmUsed,
    ttsDailyLimit: hasApiKey ? -1 : (premiumValid ? PREMIUM_LIMITS.TTS_DAILY_LIMIT : FREE_LIMITS.TTS_DAILY_LIMIT),
    llmDailyLimit: hasApiKey ? -1 : (premiumValid ? PREMIUM_LIMITS.LLM_DAILY_LIMIT : FREE_LIMITS.LLM_DAILY_LIMIT),
  };
}
