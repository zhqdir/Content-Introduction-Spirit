import express, { type Request, type Response } from 'express';
import { createOrder, getOrder, getOrdersByDeviceId } from '../db/order';
import { activatePremium } from '../db/userState';

const router = express.Router();

const MEMBERSHIP_PRICES = {
  monthly: 30,
  quarterly: 80,
  yearly: 300,
};

function getMembershipDays(amount: number): number {
  if (amount >= MEMBERSHIP_PRICES.yearly) return 365;
  if (amount >= MEMBERSHIP_PRICES.quarterly) return 90;
  if (amount >= MEMBERSHIP_PRICES.monthly) return 30;
  return 0;
}

/**
 * GET /api/v1/payment/prices
 * 获取会员价格信息
 */
router.get('/prices', (_req: Request, res: Response) => {
  res.json({
    prices: MEMBERSHIP_PRICES,
    plans: [
      { id: 'monthly', name: '月度会员', price: MEMBERSHIP_PRICES.monthly, days: 30 },
      { id: 'quarterly', name: '季度会员', price: MEMBERSHIP_PRICES.quarterly, days: 90 },
      { id: 'yearly', name: '年度会员', price: MEMBERSHIP_PRICES.yearly, days: 365 },
    ],
  });
});

/**
 * POST /api/v1/payment/order
 * 创建订单（用户提交付款信息）
 * Headers: x-device-id
 * Body: { paymentMethod: 'wechat' | 'alipay', amount: number, transactionId: string, note?: string }
 */
router.post('/order', async (req: Request, res: Response) => {
  const deviceId = req.headers['x-device-id'] as string;
  const { paymentMethod, amount, transactionId, note } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: '缺少设备ID' });
  }

  if (!paymentMethod || !['wechat', 'alipay'].includes(paymentMethod)) {
    return res.status(400).json({ error: '请选择支付方式（微信或支付宝）' });
  }

  if (!amount || amount < MEMBERSHIP_PRICES.monthly) {
    return res.status(400).json({ error: `金额不能低于${MEMBERSHIP_PRICES.monthly}元` });
  }

  if (!transactionId || typeof transactionId !== 'string') {
    return res.status(400).json({ error: '请提供交易单号' });
  }

  try {
    const order = await createOrder({
      deviceId,
      paymentMethod,
      amount,
      transactionId: transactionId.trim(),
      note: note?.trim(),
    });

    res.json({
      success: true,
      message: '订单提交成功，请等待审核',
      order: {
        id: order.id,
        amount: order.amount,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败' });
  }
});

/**
 * GET /api/v1/payment/orders
 * 获取用户的所有订单
 * Headers: x-device-id
 */
router.get('/orders', async (req: Request, res: Response) => {
  const deviceId = req.headers['x-device-id'] as string;

  if (!deviceId) {
    return res.status(400).json({ error: '缺少设备ID' });
  }

  try {
    const orders = await getOrdersByDeviceId(deviceId);
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: '获取订单失败' });
  }
});

/**
 * GET /api/v1/payment/order/:id
 * 获取订单详情
 */
router.get('/order/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const orderId = Array.isArray(id) ? id[0] : id;
  const deviceId = req.headers['x-device-id'] as string;

  try {
    const order = await getOrder(orderId);

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    // 检查权限
    if (order.deviceId !== deviceId) {
      return res.status(403).json({ error: '无权查看此订单' });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: '获取订单详情失败' });
  }
});

/**
 * POST /api/v1/payment/afdian
 * 爱发电会员激活
 * Headers: x-device-id
 * Body: { username: string }
 */
router.post('/afdian', async (req: Request, res: Response) => {
  const deviceId = req.headers['x-device-id'] as string;
  const { username } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: '缺少设备ID' });
  }

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: '请提供爱发电用户名' });
  }

  try {
    await activatePremium(deviceId, username);
    
    res.json({
      success: true,
      message: '爱发电会员激活成功',
      afdianUsername: username,
    });
  } catch (error) {
    console.error('爱发电激活失败:', error);
    res.status(500).json({ error: '爱发电激活失败' });
  }
});

export default router;
