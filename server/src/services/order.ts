// 订单服务 - 处理二维码收款订单

export interface Order {
  id: string;
  deviceId: string;
  paymentMethod: 'wechat' | 'alipay';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  transactionId?: string; // 用户提供的交易单号
  note?: string; // 用户备注
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewerNote?: string;
}

// 内存存储订单（生产环境建议使用数据库）
const orderStore = new Map<string, Order>();

// 生成订单ID
function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VB${timestamp}${random}`;
}

// 创建订单
export function createOrder(data: {
  deviceId: string;
  paymentMethod: 'wechat' | 'alipay';
  amount: number;
  transactionId: string;
  note?: string;
}): Order {
  const id = generateOrderId();
  const now = new Date();
  
  const order: Order = {
    id,
    deviceId: data.deviceId,
    paymentMethod: data.paymentMethod,
    amount: data.amount,
    status: 'pending',
    transactionId: data.transactionId,
    note: data.note,
    createdAt: now,
    updatedAt: now,
  };
  
  orderStore.set(id, order);
  return order;
}

// 获取订单
export function getOrder(id: string): Order | undefined {
  return orderStore.get(id);
}

// 获取用户的所有订单
export function getOrdersByDeviceId(deviceId: string): Order[] {
  return Array.from(orderStore.values())
    .filter(order => order.deviceId === deviceId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// 获取所有待审核订单
export function getPendingOrders(): Order[] {
  return Array.from(orderStore.values())
    .filter(order => order.status === 'pending')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// 获取所有订单（管理用）
export function getAllOrders(): Order[] {
  return Array.from(orderStore.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// 审核订单
export function reviewOrder(
  id: string, 
  approved: boolean, 
  reviewerNote?: string
): Order | undefined {
  const order = orderStore.get(id);
  if (!order) return undefined;
  
  order.status = approved ? 'approved' : 'rejected';
  order.updatedAt = new Date();
  order.reviewedAt = new Date();
  order.reviewerNote = reviewerNote;
  
  orderStore.set(id, order);
  return order;
}

// 获取订单统计
export function getOrderStats() {
  const orders = Array.from(orderStore.values());
  return {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    approved: orders.filter(o => o.status === 'approved').length,
    rejected: orders.filter(o => o.status === 'rejected').length,
    totalAmount: orders
      .filter(o => o.status === 'approved')
      .reduce((sum, o) => sum + o.amount, 0),
  };
}

// 会员价格配置
export const MEMBERSHIP_PRICES = {
  monthly: 9.9,   // 月度会员
  quarterly: 24.9, // 季度会员
  yearly: 89.9,   // 年度会员
};

// 根据金额获取会员天数
export function getMembershipDays(amount: number): number {
  if (amount >= MEMBERSHIP_PRICES.yearly) return 365;
  if (amount >= MEMBERSHIP_PRICES.quarterly) return 90;
  if (amount >= MEMBERSHIP_PRICES.monthly) return 30;
  return 0;
}
