import express, { type Request, type Response } from 'express';
import { reviewOrder, getAllOrders, getPendingOrders, getOrderStats } from '../db/order';
import { activatePremium } from '../db/userState';

const router = express.Router();

// 简单的管理员密码验证
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function verifyAdmin(req: Request, res: Response, next: () => void): boolean {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    res.status(401).json({ error: '需要管理员权限' });
    return false;
  }

  const [type, credentials] = authHeader.split(' ');
  
  if (type !== 'Bearer' || credentials !== ADMIN_PASSWORD) {
    res.status(401).json({ error: '无效的管理员密码' });
    return false;
  }

  next();
  return true;
}

/**
 * GET /api/v1/admin/orders
 * 获取所有订单（管理员）
 * Headers: Authorization: Bearer <admin_password>
 * Query: status?: 'pending' | 'approved' | 'rejected'
 */
router.get('/orders', (req: Request, res: Response) => {
  if (!verifyAdmin(req, res, () => {})) return;

  const { status } = req.query;

  const fetchOrders = async () => {
    try {
      let orders;
      
      if (status === 'pending') {
        orders = await getPendingOrders();
      } else {
        orders = await getAllOrders();
      }

      // 过滤状态
      if (status && status !== 'pending') {
        orders = orders.filter(order => order.status === status);
      }

      res.json({ orders });
    } catch (error) {
      res.status(500).json({ error: '获取订单列表失败' });
    }
  };

  fetchOrders();
});

/**
 * GET /api/v1/admin/stats
 * 获取订单统计（管理员）
 * Headers: Authorization: Bearer <admin_password>
 */
router.get('/stats', (req: Request, res: Response) => {
  if (!verifyAdmin(req, res, () => {})) return;

  const fetchStats = async () => {
    try {
      const stats = await getOrderStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: '获取统计数据失败' });
    }
  };

  fetchStats();
});

/**
 * POST /api/v1/admin/order/:id/review
 * 审核订单（管理员）
 * Headers: Authorization: Bearer <admin_password>
 * Body: { approved: boolean, note?: string }
 */
router.post('/order/:id/review', (req: Request, res: Response) => {
  if (!verifyAdmin(req, res, () => {})) return;

  const { id } = req.params;
  const { approved, note } = req.body;

  const review = async () => {
    try {
      const order = await reviewOrder(id, approved, note);

      if (!order) {
        return res.status(404).json({ error: '订单不存在' });
      }

      res.json({
        success: true,
        order,
        message: approved ? '订单已通过审核' : '订单已拒绝',
      });
    } catch (error) {
      res.status(500).json({ error: '审核订单失败' });
    }
  };

  review();
});

/**
 * POST /api/v1/admin/activate
 * 手动激活用户会员（管理员）
 * Headers: Authorization: Bearer <admin_password>
 * Body: { deviceId: string, days?: number }
 */
router.post('/activate', (req: Request, res: Response) => {
  if (!verifyAdmin(req, res, () => {})) return;

  const { deviceId, days = 30 } = req.body;

  const activate = async () => {
    try {
      await activatePremium(deviceId, undefined, days);

      res.json({
        success: true,
        message: `用户 ${deviceId} 会员已激活 ${days} 天`,
      });
    } catch (error) {
      res.status(500).json({ error: '激活会员失败' });
    }
  };

  activate();
});

/**
 * POST /api/v1/admin/afdian/activate
 * 激活爱发电会员（管理员）
 * Headers: Authorization: Bearer <admin_password>
 * Body: { deviceId: string, username: string }
 */
router.post('/afdian/activate', (req: Request, res: Response) => {
  if (!verifyAdmin(req, res, () => {})) return;

  const { deviceId, username } = req.body;

  const activate = async () => {
    try {
      await activatePremium(deviceId, username);

      res.json({
        success: true,
        message: `爱发电会员 ${username} 已绑定到设备 ${deviceId}`,
      });
    } catch (error) {
      res.status(500).json({ error: '激活爱发电会员失败' });
    }
  };

  activate();
});

export default router;
