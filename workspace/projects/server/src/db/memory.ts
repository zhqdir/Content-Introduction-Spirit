// 内存存储后备方案（本地开发时使用）
interface UserState {
  deviceId: string;
  ttsUsed: number;
  llmUsed: number;
  lastResetDate: string; // ISO 8601 日期字符串
  apiKey?: string;
  premiumExpiry?: string; // ISO 8601 日期字符串
  afdianUsername?: string;
}

interface Order {
  id: string;
  deviceId: string;
  paymentMethod: 'wechat' | 'alipay';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  transactionId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewerNote?: string;
}

const userStates = new Map<string, UserState>();
const orders = new Map<string, Order>();

export async function getUserState(deviceId: string): Promise<UserState> {
  let state = userStates.get(deviceId);
  const today = new Date().toISOString().split('T')[0];

  if (!state) {
    state = {
      deviceId,
      ttsUsed: 0,
      llmUsed: 0,
      lastResetDate: today,
    };
    userStates.set(deviceId, state);
  } else if (state.lastResetDate !== today) {
    // 新的一天，重置计数器
    state.ttsUsed = 0;
    state.llmUsed = 0;
    state.lastResetDate = today;
    userStates.set(deviceId, state);
  }

  return state;
}

export async function updateUserState(
  deviceId: string,
  updates: Partial<UserState>
): Promise<void> {
  const state = userStates.get(deviceId);
  if (state) {
    Object.assign(state, updates);
    userStates.set(deviceId, state);
  }
}

export async function getUserApiKey(deviceId: string): Promise<string | undefined> {
  const state = userStates.get(deviceId);
  return state?.apiKey;
}

export async function setUserApiKey(deviceId: string, apiKey: string): Promise<void> {
  let state = userStates.get(deviceId);
  if (!state) {
    state = {
      deviceId,
      ttsUsed: 0,
      llmUsed: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    };
  }
  state.apiKey = apiKey;
  userStates.set(deviceId, state);
}

export async function activatePremium(
  deviceId: string,
  afdianUsername?: string,
  days: number = 30
): Promise<void> {
  const now = new Date();
  const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  let state = userStates.get(deviceId);
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
  userStates.set(deviceId, state);
}

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
  const isPremium = state.premiumExpiry
    ? new Date(state.premiumExpiry) > new Date()
    : false;

  const ttsLimit = isPremium ? 100 : 5;
  const llmLimit = isPremium ? 50 : 3;

  return {
    ttsRemaining: Math.max(0, ttsLimit - state.ttsUsed),
    llmRemaining: Math.max(0, llmLimit - state.llmUsed),
    hasApiKey,
    isPremium,
  };
}

export function isPremiumValid(state: UserState): boolean {
  if (!state.premiumExpiry) return false;
  return new Date(state.premiumExpiry) > new Date();
}

// 订单相关函数
export async function createOrder(data: {
  deviceId: string;
  paymentMethod: 'wechat' | 'alipay';
  amount: number;
  transactionId: string;
  note?: string;
}): Promise<Order> {
  const id = `VB${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();

  const order: Order = {
    id,
    deviceId: data.deviceId,
    paymentMethod: data.paymentMethod,
    amount: data.amount,
    status: 'pending',
    transactionId: data.transactionId.trim(),
    note: data.note?.trim(),
    createdAt: now,
    updatedAt: now,
  };

  orders.set(id, order);
  return order;
}

export async function getOrder(id: string): Promise<Order | undefined> {
  return orders.get(id);
}

export async function getOrdersByDeviceId(deviceId: string): Promise<Order[]> {
  return Array.from(orders.values())
    .filter(order => order.deviceId === deviceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPendingOrders(): Promise<Order[]> {
  return Array.from(orders.values())
    .filter(order => order.status === 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAllOrders(): Promise<Order[]> {
  return Array.from(orders.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function reviewOrder(
  id: string,
  approved: boolean,
  reviewerNote?: string
): Promise<Order | undefined> {
  const order = orders.get(id);
  if (!order) return undefined;

  const now = new Date().toISOString();
  order.status = approved ? 'approved' : 'rejected';
  order.reviewedAt = now;
  order.reviewerNote = reviewerNote;
  order.updatedAt = now;

  // 如果通过审核，激活会员
  if (approved) {
    const days = getMembershipDays(order.amount);
    if (days > 0) {
      await activatePremium(order.deviceId, undefined, days);
    }
  }

  return order;
}

export async function getOrderStats() {
  const allOrders = getAllOrders();
  const total = allOrders.length;
  const pending = allOrders.filter(o => o.status === 'pending').length;
  const approved = allOrders.filter(o => o.status === 'approved').length;
  const rejected = allOrders.filter(o => o.status === 'rejected').length;
  const totalAmount = allOrders
    .filter(o => o.status === 'approved')
    .reduce((sum, o) => sum + o.amount, 0);

  return { total, pending, approved, rejected, totalAmount };
}

function getMembershipDays(amount: number): number {
  if (amount >= 300) return 365; // 年费
  if (amount >= 30) return 30;   // 月费
  return 0;
}
