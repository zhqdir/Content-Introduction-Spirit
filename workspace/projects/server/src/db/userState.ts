import { getPool, isDatabaseAvailable } from './index';

export interface UserState {
  deviceId: string;
  ttsUsed: number;
  llmUsed: number;
  lastResetDate: string; // ISO 8601 日期字符串
  apiKey?: string;
  premiumExpiry?: string; // ISO 8601 日期字符串
  afdianUsername?: string;
}

// 内存存储后备方案
const memoryUserStates = new Map<string, UserState>();

// 获取用户状态（自动选择数据库或内存）
export async function getUserState(deviceId: string): Promise<UserState> {
  if (!isDatabaseAvailable()) {
    return getUserStateFromMemory(deviceId);
  }

  const pool = getPool();
  const today = new Date().toISOString().split('T')[0];

  const result = await pool.query(
    'SELECT * FROM user_states WHERE device_id = $1',
    [deviceId]
  );

  if (result.rows.length === 0) {
    // 创建新用户
    const insertResult = await pool.query(
      `INSERT INTO user_states (device_id, tts_used, llm_used, last_reset_date, created_at, updated_at)
       VALUES ($1, 0, 0, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [deviceId, today]
    );
    return insertResult.rows[0];
  }

  // 检查是否需要重置计数器
  const state = result.rows[0];
  if (state.last_reset_date !== today) {
    const updateResult = await pool.query(
      `UPDATE user_states 
       SET tts_used = 0, llm_used = 0, last_reset_date = $1, updated_at = CURRENT_TIMESTAMP
       WHERE device_id = $2
       RETURNING *`,
      [today, deviceId]
    );
    return updateResult.rows[0];
  }

  return state;
}

// 更新用户状态
export async function updateUserState(
  deviceId: string,
  updates: Partial<UserState>
): Promise<void> {
  if (!isDatabaseAvailable()) {
    updateUserStateInMemory(deviceId, updates);
    return;
  }

  const pool = getPool();
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.ttsUsed !== undefined) {
    fields.push(`tts_used = $${paramIndex++}`);
    values.push(updates.ttsUsed);
  }
  if (updates.llmUsed !== undefined) {
    fields.push(`llm_used = $${paramIndex++}`);
    values.push(updates.llmUsed);
  }
  if (updates.apiKey !== undefined) {
    fields.push(`api_key = $${paramIndex++}`);
    values.push(updates.apiKey);
  }
  if (updates.premiumExpiry !== undefined) {
    fields.push(`premium_expiry = $${paramIndex++}`);
    values.push(updates.premiumExpiry);
  }
  if (updates.afdianUsername !== undefined) {
    fields.push(`afdian_username = $${paramIndex++}`);
    values.push(updates.afdianUsername);
  }

  if (fields.length === 0) return;

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(deviceId);

  await pool.query(
    `UPDATE user_states SET ${fields.join(', ')} WHERE device_id = $${paramIndex}`,
    values
  );
}

// 获取用户 API Key
export async function getUserApiKey(deviceId: string): Promise<string | undefined> {
  if (!isDatabaseAvailable()) {
    return getUserApiKeyFromMemory(deviceId);
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT api_key FROM user_states WHERE device_id = $1',
    [deviceId]
  );

  return result.rows[0]?.api_key;
}

// 设置用户 API Key
export async function setUserApiKey(deviceId: string, apiKey: string): Promise<void> {
  if (!isDatabaseAvailable()) {
    setUserApiKeyInMemory(deviceId, apiKey);
    return;
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO user_states (device_id, api_key, created_at, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (device_id) 
     DO UPDATE SET api_key = $2, updated_at = CURRENT_TIMESTAMP`,
    [deviceId, apiKey]
  );
}

// 激活会员
export async function activatePremium(
  deviceId: string,
  afdianUsername?: string,
  days: number = 30
): Promise<void> {
  if (!isDatabaseAvailable()) {
    activatePremiumInMemory(deviceId, afdianUsername, days);
    return;
  }

  const pool = getPool();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);

  await pool.query(
    `INSERT INTO user_states (device_id, premium_expiry, afdian_username, created_at, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (device_id) 
     DO UPDATE SET 
       premium_expiry = $2,
       afdian_username = $3,
       updated_at = CURRENT_TIMESTAMP`,
    [deviceId, expiry.toISOString(), afdianUsername]
  );
}

// 获取用户剩余次数
export async function getUserRemaining(deviceId: string) {
  const state = await getUserState(deviceId);
  const hasApiKey = !!state.apiKey;

  // 如果用户有 API Key，返回无限
  if (hasApiKey) {
    return {
      ttsRemaining: -1,
      llmRemaining: -1,
      hasApiKey: true,
      isPremium: false,
    };
  }

  // 检查会员状态
  const isPremium = isPremiumValid(state);

  const ttsLimit = isPremium ? 100 : 5;
  const llmLimit = isPremium ? 50 : 3;

  return {
    ttsRemaining: Math.max(0, ttsLimit - state.ttsUsed),
    llmRemaining: Math.max(0, llmLimit - state.llmUsed),
    hasApiKey,
    isPremium,
  };
}

// 检查会员是否有效
export function isPremiumValid(state: UserState): boolean {
  if (!state.premiumExpiry) return false;
  return new Date(state.premiumExpiry) > new Date();
}

// 内存存储实现
function getUserStateFromMemory(deviceId: string): UserState {
  let state = memoryUserStates.get(deviceId);
  const today = new Date().toISOString().split('T')[0];

  if (!state) {
    state = {
      deviceId,
      ttsUsed: 0,
      llmUsed: 0,
      lastResetDate: today,
    };
    memoryUserStates.set(deviceId, state);
  } else if (state.lastResetDate !== today) {
    state.ttsUsed = 0;
    state.llmUsed = 0;
    state.lastResetDate = today;
  }

  return state;
}

function updateUserStateInMemory(deviceId: string, updates: Partial<UserState>): void {
  const state = memoryUserStates.get(deviceId);
  if (state) {
    Object.assign(state, updates);
  }
}

function getUserApiKeyFromMemory(deviceId: string): string | undefined {
  const state = memoryUserStates.get(deviceId);
  return state?.apiKey;
}

function setUserApiKeyInMemory(deviceId: string, apiKey: string): void {
  let state = memoryUserStates.get(deviceId);
  if (!state) {
    state = {
      deviceId,
      ttsUsed: 0,
      llmUsed: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    };
  }
  state.apiKey = apiKey;
  memoryUserStates.set(deviceId, state);
}

function activatePremiumInMemory(deviceId: string, afdianUsername?: string, days: number = 30): void {
  const now = new Date();
  const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  let state = memoryUserStates.get(deviceId);
  if (!state) {
    state = {
      deviceId,
      ttsUsed: 0,
      llmUsed: 0,
      lastResetDate: now.toISOString().split('T')[0],
    };
  }
  state.premiumExpiry = expiry.toISOString();
  state.afdianUsername = afdianUsername;
  memoryUserStates.set(deviceId, state);
}
