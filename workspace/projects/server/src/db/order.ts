import { getPool, isDatabaseAvailable } from './index';
import { activatePremium } from './userState';

export interface Order {
  id: string;
  deviceId: string;
  paymentMethod: 'wechat' | 'alipay';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  transactionId?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewerNote?: string;
}

// 内存存储后备方案
const memoryOrders = new Map<string, Order>();

// 生成订单ID
function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VB${timestamp}${random}`;
}

// 创建订单
export async function createOrder(data: {
  deviceId: string;
  paymentMethod: 'wechat' | 'alipay';
  amount: number;
  transactionId: string;
  note?: string;
}): Promise<Order> {
  if (!isDatabaseAvailable()) {
    return createOrderInMemory(data);
  }

  const pool = getPool();
  const id = generateOrderId();
  const now = new Date();

  const result = await pool.query(
    `INSERT INTO orders (id, device_id, payment_method, amount, status, transaction_id, note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)
     RETURNING *`,
    [id, data.deviceId, data.paymentMethod, data.amount, data.transactionId.trim(), data.note?.trim(), now, now]
  );

  return result.rows[0];
}

// 获取订单
export async function getOrder(id: string): Promise<Order | undefined> {
  if (!isDatabaseAvailable()) {
    return memoryOrders.get(id);
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM orders WHERE id = $1',
    [id]
  );

  return result.rows[0];
}

// 获取用户的所有订单
export async function getOrdersByDeviceId(deviceId: string): Promise<Order[]> {
  if (!isDatabaseAvailable()) {
    return Array.from(memoryOrders.values())
      .filter(order => order.deviceId === deviceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM orders WHERE device_id = $1 ORDER BY created_at DESC',
    [deviceId]
  );

  return result.rows;
}

// 获取所有待审核订单
export async function getPendingOrders(): Promise<Order[]> {
  if (!isDatabaseAvailable()) {
    return Array.from(memoryOrders.values())
      .filter(order => order.status === 'pending')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC"
  );

  return result.rows;
}

// 获取所有订单
export async function getAllOrders(): Promise<Order[]> {
  if (!isDatabaseAvailable()) {
    return Array.from(memoryOrders.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM orders ORDER BY created_at DESC'
  );

  return result.rows;
}

// 审核订单
export async function reviewOrder(
  id: string,
  approved: boolean,
  reviewerNote?: string
): Promise<Order | undefined> {
  if (!isDatabaseAvailable()) {
    return reviewOrderInMemory(id, approved, reviewerNote);
  }

  const pool = getPool();
  const now = new Date();

  const result = await pool.query(
    `UPDATE orders 
     SET status = $1, reviewed_at = $2, reviewer_note = $3, updated_at = $4
     WHERE id = $5
     RETURNING *`,
    [approved ? 'approved' : 'rejected', now, reviewerNote, now, id]
  );

  if (result.rows.length === 0) return undefined;

  // 如果通过审核，激活会员
  if (approved) {
    const days = getMembershipDays(result.rows[0].amount);
    if (days > 0) {
      await activatePremium(result.rows[0].deviceId, undefined, days);
    }
  }

  return result.rows[0];
}

// 获取订单统计
export async function getOrderStats() {
  if (!isDatabaseAvailable()) {
    const allOrders = Array.from(memoryOrders.values());
    const total = allOrders.length;
    const pending = allOrders.filter(o => o.status === 'pending').length;
    const approved = allOrders.filter(o => o.status === 'approved').length;
    const rejected = allOrders.filter(o => o.status === 'rejected').length;
    const totalAmount = allOrders
      .filter(o => o.status === 'approved')
      .reduce((sum, o) => sum + o.amount, 0);

    return { total, pending, approved, rejected, totalAmount };
  }

  const pool = getPool();
  const result = await pool.query(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
       SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
       COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as totalAmount
     FROM orders`
  );

  return result.rows[0];
}

// 内存存储实现
function createOrderInMemory(data: {
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
    transactionId: data.transactionId.trim(),
    note: data.note?.trim(),
    createdAt: now,
    updatedAt: now,
  };

  memoryOrders.set(id, order);
  return order;
}

function reviewOrderInMemory(
  id: string,
  approved: boolean,
  reviewerNote?: string
): Order | undefined {
  const order = memoryOrders.get(id);
  if (!order) return undefined;

  const now = new Date();
  order.status = approved ? 'approved' : 'rejected';
  order.reviewedAt = now;
  order.reviewerNote = reviewerNote;
  order.updatedAt = now;

  // 如果通过审核，激活会员
  if (approved) {
    const days = getMembershipDays(order.amount);
    if (days > 0) {
      activatePremium(order.deviceId, undefined, days);
    }
  }

  return order;
}

function getMembershipDays(amount: number): number {
  if (amount >= 300) return 365; // 年费
  if (amount >= 30) return 30;   // 月费
  return 0;
}
